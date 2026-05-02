import { randomUUID } from "crypto";
import { getMinRating } from "./env";
import { getSupabaseAdmin } from "./supabase";
import {
  getPvpLeaderboard,
  getCharacterProfile,
  getCharacterSpecializations,
  inferSpec,
  parseLeaderboardRows,
  parseProfile,
} from "./blizzard";
import { inferLikelyTeams } from "./team-detect";

async function hydratePlayer(row: any) {
  let profileData = {
    faction: "Unknown",
    race: "Unknown",
    className: "Unknown",
    gender: "Unknown",
    spec: "Unknown",
  };

  try {
    const profile = await getCharacterProfile(row.realmSlug, row.name);
    const parsed = parseProfile(profile);
    const specs = await getCharacterSpecializations(row.realmSlug, row.name);

    profileData = {
      ...parsed,
      spec: inferSpec(parsed.className, specs),
    };
  } catch (e) {
    console.warn(`Failed to hydrate ${row.name}-${row.realmSlug}`, e);
  }

  return profileData;
}

export async function pollBracket(seasonId: string, bracket: string) {
  const supabase = getSupabaseAdmin();
  const pollId = randomUUID();
  const minRating = getMinRating();

  const data = await getPvpLeaderboard(seasonId, bracket);
  const rows = parseLeaderboardRows(data).filter((x: any) => x.rating >= minRating);
  const changedRows: any[] = [];

  for (const row of rows) {
    const playerId = row.id || `${row.realmSlug}-${row.name}`.toLowerCase();

    const { data: existingPlayer } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .maybeSingle();

    let profile = {
      faction: existingPlayer?.faction || "Unknown",
      race: existingPlayer?.race || "Unknown",
      className: existingPlayer?.class_name || "Unknown",
      gender: existingPlayer?.gender || "Unknown",
      spec: existingPlayer?.spec || "Unknown",
    };

    const lastRefresh = existingPlayer?.last_profile_refresh
      ? new Date(existingPlayer.last_profile_refresh).getTime()
      : 0;

    const shouldHydrate =
      !existingPlayer ||
      Date.now() - lastRefresh > 1000 * 60 * 60 * 24 ||
      profile.className === "Unknown";

    if (shouldHydrate) {
      profile = await hydratePlayer(row);
    }

    await supabase.from("players").upsert({
      id: playerId,
      name: row.name,
      realm_slug: row.realmSlug,
      realm_name: row.realmName,
      faction: profile.faction,
      race: profile.race,
      class_name: profile.className,
      spec: profile.spec,
      gender: profile.gender,
      last_profile_refresh: shouldHydrate ? new Date().toISOString() : existingPlayer?.last_profile_refresh,
      updated_at: new Date().toISOString(),
    });

    const { data: latest } = await supabase
      .from("latest_activity")
      .select("*")
      .eq("player_id", playerId)
      .eq("bracket", bracket)
      .maybeSingle();

    const ratingDelta = latest ? row.rating - latest.rating : 0;
    const winsDelta = latest ? row.wins - latest.wins : 0;
    const lossesDelta = latest ? row.losses - latest.losses : 0;
    const active = Boolean(latest && (ratingDelta || winsDelta || lossesDelta));
    const now = new Date().toISOString();

    await supabase.from("ladder_entries").insert({
      poll_id: pollId,
      bracket,
      player_id: playerId,
      rank: row.rank,
      rating: row.rating,
      wins: row.wins,
      losses: row.losses,
      rating_delta: ratingDelta,
      wins_delta: winsDelta,
      losses_delta: lossesDelta,
      active,
      detected_at: now,
    });

    await supabase.from("latest_activity").upsert({
      player_id: playerId,
      bracket,
      rank: row.rank,
      rating: row.rating,
      wins: row.wins,
      losses: row.losses,
      rating_delta: ratingDelta,
      wins_delta: winsDelta,
      losses_delta: lossesDelta,
      last_active_at: active ? now : latest?.last_active_at || null,
      last_seen_at: now,
      session_record: `${Math.max(0, winsDelta)}-${Math.max(0, lossesDelta)}`,
    });

    if (active) {
      changedRows.push({
        player_id: playerId,
        name: row.name,
        rating_delta: ratingDelta,
        wins_delta: winsDelta,
        losses_delta: lossesDelta,
      });
    }
  }

  const teams = inferLikelyTeams(changedRows, bracket);
  for (const [playerId, team] of teams.entries()) {
    await supabase
      .from("latest_activity")
      .update({ likely_team: team })
      .eq("player_id", playerId)
      .eq("bracket", bracket);
  }

  return { bracket, pollId, totalTracked: rows.length, changed: changedRows.length };
}
