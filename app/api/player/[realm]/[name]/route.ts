import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCharacterEquipment, parseEquipment } from "@/lib/blizzard";

export const dynamic = "force-dynamic";

function capRealm(value: string) {
  if (!value) return value;
  return value
    .split(/[-\s]/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(value.includes("-") ? "-" : " ");
}

function titleFromRank(rank: number | null, cutoffs: any) {
  if (!rank || !cutoffs) return { title: "", tier: "none" };

  if (cutoffs.rank_one_cutoff && rank <= cutoffs.rank_one_cutoff) {
    return { title: "Infernal Gladiator", tier: "rank1" };
  }

  if (cutoffs.gladiator_cutoff && rank <= cutoffs.gladiator_cutoff) {
    return { title: "Gladiator", tier: "gladiator" };
  }

  if (cutoffs.duelist_cutoff && rank <= cutoffs.duelist_cutoff) {
    return { title: "Duelist", tier: "duelist" };
  }

  if (cutoffs.rival_cutoff && rank <= cutoffs.rival_cutoff) {
    return { title: "Rival", tier: "rival" };
  }

  if (cutoffs.challenger_cutoff && rank <= cutoffs.challenger_cutoff) {
    return { title: "Challenger", tier: "challenger" };
  }

  return { title: "", tier: "none" };
}

async function fetchAndCacheGear(supabase: any, player: any) {
  try {
    const equipment = await getCharacterEquipment(player.realm_slug, player.name);
    const parsed = parseEquipment(equipment);

    await supabase.from("gear_snapshots").upsert({
      player_id: player.id,
      equipment: parsed.gear,
      average_item_level: parsed.averageItemLevel,
      equipped_item_level: parsed.equippedItemLevel,
      fetched_at: new Date().toISOString(),
      source: "blizzard-equipment",
    });

    return {
      gear: parsed.gear,
      averageItemLevel: parsed.averageItemLevel,
      equippedItemLevel: parsed.equippedItemLevel,
      fetchedAt: new Date().toISOString(),
      source: "live",
      error: null,
    };
  } catch (e: any) {
    const { data: cached } = await supabase
      .from("gear_snapshots")
      .select("*")
      .eq("player_id", player.id)
      .maybeSingle();

    return {
      gear: cached?.equipment || [],
      averageItemLevel: cached?.average_item_level || null,
      equippedItemLevel: cached?.equipped_item_level || null,
      fetchedAt: cached?.fetched_at || null,
      source: cached ? "cached" : "none",
      error: e?.message || "Equipment fetch failed",
    };
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ realm: string; name: string }> }
) {
  const { realm, name } = await ctx.params;
  const realmSlug = decodeURIComponent(realm).toLowerCase();
  const playerName = decodeURIComponent(name);

  const supabase = getSupabaseAdmin();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("realm_slug", realmSlug)
    .ilike("name", playerName)
    .maybeSingle();

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 500 });
  }

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const { data: latestRows, error: latestError } = await supabase
    .from("latest_activity")
    .select("*")
    .eq("player_id", player.id)
    .order("rating", { ascending: false });

  if (latestError) {
    return NextResponse.json({ error: latestError.message }, { status: 500 });
  }

  const { data: cutoffsRows } = await supabase
    .from("title_cutoffs")
    .select("*");

  const cutoffsByBracket = new Map((cutoffsRows || []).map((x: any) => [x.bracket, x]));

  const brackets = ["2v2", "3v3", "5v5"].map((bracket) => {
    const row = (latestRows || []).find((x: any) => x.bracket === bracket);
    const title = titleFromRank(row?.rank || null, cutoffsByBracket.get(bracket));

    return {
      bracket,
      rank: row?.rank || null,
      rankDelta: row?.rank_delta || 0,
      rating: row?.rating || 0,
      ratingDelta: row?.rating_delta || 0,
      wins: row?.wins || 0,
      losses: row?.losses || 0,
      winsDelta: row?.wins_delta || 0,
      lossesDelta: row?.losses_delta || 0,
      lastSeenAt: row?.last_seen_at || null,
      lastActiveAt: row?.last_active_at || null,
      profileLastScanAt: row?.profile_last_scan_at || null,
      title: title.title,
      titleTier: title.tier,
    };
  });

  const { data: events, error: eventsError } = await supabase
    .from("activity_events")
    .select("*")
    .eq("player_id", player.id)
    .or("rating_delta.neq.0,wins_delta.neq.0,losses_delta.neq.0")
    .order("detected_at", { ascending: false })
    .limit(100);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const { data: snapshots } = await supabase
    .from("profile_pvp_snapshots")
    .select("*")
    .eq("player_id", player.id)
    .order("last_scanned_at", { ascending: false });

  const gear = await fetchAndCacheGear(supabase, player);

  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      realmSlug: player.realm_slug,
      realmName: capRealm(player.realm_name || player.realm_slug),
      faction: player.faction || "Unknown",
      race: player.race || "Unknown",
      className: player.class_name || "Unknown",
      spec: player.spec || "Unknown",
      gender: player.gender || "Unknown",
      lastProfileRefresh: player.last_profile_refresh,
    },
    brackets,
    events: events || [],
    snapshots: snapshots || [],
    gear,
  });
}
