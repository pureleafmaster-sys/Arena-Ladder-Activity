import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMinRating } from "@/lib/env";
import { activityStatusFromMinutes } from "@/lib/team-detect";

export const dynamic = "force-dynamic";

function minutesAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function titleFromRank(rank: number | null, cutoffs: any) {
  if (!rank || !cutoffs) return { title: "", tier: "none" };

  if (rank <= cutoffs.rank_one_cutoff) return { title: "Rank 1", tier: "rank1" };
  if (rank <= cutoffs.gladiator_cutoff) return { title: "Gladiator", tier: "gladiator" };
  if (rank <= cutoffs.duelist_cutoff) return { title: "Duelist", tier: "duelist" };
  if (rank <= cutoffs.rival_cutoff) return { title: "Rival", tier: "rival" };
  if (rank <= cutoffs.challenger_cutoff) return { title: "Challenger", tier: "challenger" };

  return { title: "", tier: "none" };
}

function capRealm(value: string) {
  if (!value) return value;
  return value
    .split(/[-\s]/)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part)
    .join(value.includes("-") ? "-" : " ");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bracket = url.searchParams.get("bracket") || "3v3";
  const mode = url.searchParams.get("mode") || "ladder";
  const minRating = Number(url.searchParams.get("minRating") || getMinRating());
  const q = (url.searchParams.get("q") || "").toLowerCase();

  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(25, Number(url.searchParams.get("pageSize") || 100)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = getSupabaseAdmin();

  const { data: latestScanRow } = await supabase
    .from("latest_activity")
    .select("last_seen_at")
    .eq("bracket", bracket)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { data: cutoffs } = await supabase
    .from("title_cutoffs")
    .select("*")
    .eq("bracket", bracket)
    .maybeSingle();

  if (mode === "activity") {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data, error, count } = await supabase
      .from("activity_events")
      .select(
        `
        *,
        players:player_id (
          id,
          name,
          realm_slug,
          realm_name,
          faction,
          race,
          class_name,
          spec
        )
      `,
        { count: "exact" }
      )
      .eq("bracket", bracket)
      .gte("rating", minRating)
      .gte("detected_at", twelveHoursAgo)
      .order("rating", { ascending: false })
      .order("detected_at", { ascending: false })
      .range(from, to);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (data || []).map((x: any) => {
      const p = x.players || {};
      const activeMinutes = minutesAgo(x.detected_at);
      const title = titleFromRank(x.rank, cutoffs);

      return {
        playerId: x.player_id,
        rank: x.rank,
        rankDelta: x.rank_delta || 0,
        title: title.title,
        titleTier: title.tier,
        name: p.name || "Unknown",
        realm: capRealm(p.realm_name || p.realm_slug || "Unknown"),
        realmSlug: p.realm_slug || "",
        faction: p.faction || "Unknown",
        race: p.race || "Unknown",
        className: p.class_name || "Unknown",
        spec: p.spec || "Unknown",
        bracket: x.bracket,
        wins: x.wins,
        losses: x.losses,
        rating: x.rating,
        ratingDelta: x.rating_delta || 0,
        winsDelta: x.wins_delta || 0,
        lossesDelta: x.losses_delta || 0,
        gamesDelta: x.games_delta || 0,
        trackedMinutesAgo: activeMinutes,
        activeMinutesAgo: activeMinutes,
        seenMinutesAgo: null,
        lastSeenAt: null,
        lastActiveAt: x.detected_at,
        lastDetectedAt: x.detected_at,
        team: [p.name].filter(Boolean),
        teamConfidence: 0,
        session: `${Math.max(0, x.wins_delta || 0)}-${Math.max(0, x.losses_delta || 0)}`,
        activityStatus: activityStatusFromMinutes(activeMinutes),
      };
    });

    const filtered = q
      ? items.filter((p: any) =>
          `${p.name} ${p.realm} ${p.faction} ${p.race} ${p.className} ${p.spec} ${p.title}`
            .toLowerCase()
            .includes(q)
        )
      : items;

    return NextResponse.json({
      items: filtered,
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
      mode,
      refreshedAt: latestScanRow?.last_seen_at || null,
      cutoffs,
    });
  }

  const { data, error, count } = await supabase
    .from("latest_activity")
    .select(
      `
      *,
      players:player_id (
        id,
        name,
        realm_slug,
        realm_name,
        faction,
        race,
        class_name,
        spec
      )
    `,
      { count: "exact" }
    )
    .eq("bracket", bracket)
    .gte("rating", minRating)
    .order("rating", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data || []).map((x: any) => {
    const p = x.players || {};
    const seenMinutes = minutesAgo(x.last_seen_at);
    const title = titleFromRank(x.rank, cutoffs);

    return {
      playerId: x.player_id,
      rank: x.rank,
      rankDelta: x.rank_delta || 0,
      title: title.title,
      titleTier: title.tier,
      name: p.name || "Unknown",
      realm: capRealm(p.realm_name || p.realm_slug || "Unknown"),
      realmSlug: p.realm_slug || "",
      faction: p.faction || "Unknown",
      race: p.race || "Unknown",
      className: p.class_name || "Unknown",
      spec: p.spec || "Unknown",
      bracket: x.bracket,
      wins: x.wins,
      losses: x.losses,
      rating: x.rating,
      ratingDelta: x.rating_delta || 0,
      winsDelta: x.wins_delta || 0,
      lossesDelta: x.losses_delta || 0,
      gamesDelta: x.games_delta || 0,
      trackedMinutesAgo: null,
      activeMinutesAgo: null,
      seenMinutesAgo: seenMinutes,
      lastSeenAt: x.last_seen_at,
      lastActiveAt: x.last_active_at,
      lastDetectedAt: x.last_active_at || null,
      team: x.likely_team?.length ? x.likely_team : [p.name].filter(Boolean),
      teamConfidence: x.team_confidence || 0,
      session: x.session_record || "0-0",
      activityStatus: activityStatusFromMinutes(minutesAgo(x.last_active_at)),
    };
  });

  const filtered = q
    ? items.filter((p: any) =>
        `${p.name} ${p.realm} ${p.faction} ${p.race} ${p.className} ${p.spec} ${p.title}`
          .toLowerCase()
          .includes(q)
      )
    : items;

  return NextResponse.json({
    items: filtered,
    count: count || 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    mode,
    refreshedAt: latestScanRow?.last_seen_at || null,
    cutoffs,
  });
}
