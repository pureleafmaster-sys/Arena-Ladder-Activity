import { randomUUID } from "crypto";
import { getMinRating } from "./env";
import { getSupabaseAdmin } from "./supabase";
import { getPvpLeaderboard, parseLeaderboardRows } from "./blizzard";
import { activityStatusFromMinutes, inferLikelyTeams } from "./team-detect";

function minutesAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function cutoff(total: number, pct: number) {
  return Math.max(1, Math.floor(total * pct));
}

export async function pollBracket(seasonId: string, bracket: string) {
  const supabase = getSupabaseAdmin();
  const pollId = randomUUID();
  const minRating = getMinRating();
  const now = new Date().toISOString();

  const data = await getPvpLeaderboard(seasonId, bracket);
  const allRows = parseLeaderboardRows(data);
  const rows = allRows.filter((x: any) => x.rating >= minRating);

  const totalEntries = allRows.length;

  await supabase.from("title_cutoffs").upsert({
    bracket,
    total_entries: totalEntries,
    rank_one_cutoff: cutoff(totalEntries, 0.001),
    gladiator_cutoff: cutoff(totalEntries, 0.005),
    duelist_cutoff: cutoff(totalEntries, 0.03),
    rival_cutoff: cutoff(totalEntries, 0.10),
    challenger_cutoff: cutoff(totalEntries, 0.35),
    updated_at: now,
  });

  const playerIds = rows.map((row: any) => row.id || `${row.realmSlug}-${row.name}`.toLowerCase());

  const latestMap = new Map<string, any>();

  for (const ids of chunk(playerIds, 300)) {
    const { data: latestRows, error } = await supabase
      .from("latest_activity")
      .select("*")
      .eq("bracket", bracket)
      .in("player_id", ids);

    if (error) throw error;

    for (const item of latestRows || []) {
      latestMap.set(item.player_id, item);
    }
  }

  const playersUpsert: any[] = [];
  const latestUpsert: any[] = [];
  const ladderEntries: any[] = [];
  const activityEvents: any[] = [];
  const changedRows: any[] = [];

  for (const row of rows) {
    const playerId = row.id || `${row.realmSlug}-${row.name}`.toLowerCase();
    const latest = latestMap.get(playerId);

    const ratingDelta = latest ? row.rating - latest.rating : 0;
    const winsDelta = latest ? row.wins - latest.wins : 0;
    const lossesDelta = latest ? row.losses - latest.losses : 0;
    const gamesDelta = winsDelta + lossesDelta;

    // Positive rankDelta means the player improved upward, e.g. rank 10 -> rank 5 = +5.
    const rankDelta = latest?.rank ? latest.rank - row.rank : 0;

    const active = Boolean(latest && (ratingDelta || winsDelta || lossesDelta));
    const lastActiveAt = active ? now : latest?.last_active_at || null;
    const status = activityStatusFromMinutes(minutesAgo(lastActiveAt));

    playersUpsert.push({
      id: playerId,
      name: row.name,
      realm_slug: row.realmSlug,
      realm_name: row.realmName,
      updated_at: now,
    });

    ladderEntries.push({
      poll_id: pollId,
      bracket,
      player_id: playerId,
      rank: row.rank,
      rank_delta: rankDelta,
      rating: row.rating,
      wins: row.wins,
      losses: row.losses,
      rating_delta: ratingDelta,
      wins_delta: winsDelta,
      losses_delta: lossesDelta,
      active,
      detected_at: now,
    });

    latestUpsert.push({
      player_id: playerId,
      bracket,
      rank: row.rank,
      rank_delta: rankDelta,
      rating: row.rating,
      wins: row.wins,
      losses: row.losses,
      rating_delta: ratingDelta,
      wins_delta: winsDelta,
      losses_delta: lossesDelta,
      games_delta: gamesDelta,
      last_active_at: lastActiveAt,
      last_seen_at: now,
      session_record: `${Math.max(0, winsDelta)}-${Math.max(0, lossesDelta)}`,
      activity_status: status,
    });

    if (active) {
      activityEvents.push({
        poll_id: pollId,
        bracket,
        player_id: playerId,
        rank: row.rank,
        rank_delta: rankDelta,
        rating: row.rating,
        wins: row.wins,
        losses: row.losses,
        rating_delta: ratingDelta,
        wins_delta: winsDelta,
        losses_delta: lossesDelta,
        games_delta: gamesDelta,
        detected_at: now,
      });

      changedRows.push({
        player_id: playerId,
        name: row.name,
        rating: row.rating,
        rating_delta: ratingDelta,
        wins_delta: winsDelta,
        losses_delta: lossesDelta,
        games_delta: gamesDelta,
      });
    }
  }

  for (const group of chunk(playersUpsert, 500)) {
    const { error } = await supabase
      .from("players")
      .upsert(group, { onConflict: "id", ignoreDuplicates: false });

    if (error) throw error;
  }

  for (const group of chunk(ladderEntries, 500)) {
    const { error } = await supabase.from("ladder_entries").insert(group);
    if (error) throw error;
  }

  for (const group of chunk(latestUpsert, 500)) {
    const { error } = await supabase
      .from("latest_activity")
      .upsert(group, { onConflict: "player_id,bracket" });

    if (error) throw error;
  }

  for (const group of chunk(activityEvents, 500)) {
    const { error } = await supabase.from("activity_events").insert(group);
    if (error) throw error;
  }

  const teams = inferLikelyTeams(changedRows, bracket);

  for (const [playerId, result] of teams.entries()) {
    await supabase
      .from("latest_activity")
      .update({
        likely_team: result.team,
        team_confidence: result.confidence,
      })
      .eq("player_id", playerId)
      .eq("bracket", bracket);
  }

  return {
    bracket,
    pollId,
    totalEntries,
    totalTracked: rows.length,
    changed: changedRows.length,
    activityEvents: activityEvents.length,
  };
}
