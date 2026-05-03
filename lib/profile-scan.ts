import { randomUUID } from "crypto";
import { optionalEnv } from "./env";
import { getSupabaseAdmin } from "./supabase";
import { getCharacterPvpBracket, parsePvpBracketStats } from "./blizzard";
import { activityStatusFromMinutes } from "./team-detect";

function minutesAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function scanIntervalMinutes(bracket: string, rating: number) {
  if (bracket === "2v2") {
    if (rating >= 2700) return 5;
    if (rating >= 2399) return 10;
    return 15;
  }

  if (bracket === "3v3") {
    if (rating >= 2200) return 5;
    return 10;
  }

  if (bracket === "5v5") {
    return 5;
  }

  return 15;
}

function nextScanAt(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function safeLower(value: string) {
  return String(value || "").toLowerCase();
}

export async function runProfileScan() {
  const supabase = getSupabaseAdmin();
  const pollId = randomUUID();
  const now = new Date().toISOString();
  const limit = Number(optionalEnv("PROFILE_SCAN_LIMIT", "60"));

  const { data: dueRows, error } = await supabase
    .from("latest_activity")
    .select(`
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
    `)
    .gte("rating", 2100)
    .or(`profile_next_scan_at.is.null,profile_next_scan_at.lte.${now}`)
    .order("rating", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const scanned: any[] = [];
  const changed: any[] = [];
  const failed: any[] = [];

  for (const row of dueRows || []) {
    const player = row.players || {};
    const playerId = row.player_id;
    const bracket = row.bracket;
    const interval = scanIntervalMinutes(bracket, row.rating);
    const nextDue = nextScanAt(interval);

    try {
      const bracketData = await getCharacterPvpBracket(
        player.realm_slug,
        safeLower(player.name),
        bracket
      );

      const stats = parsePvpBracketStats(bracketData);

      if (!stats.rating && !stats.wins && !stats.losses) {
        failed.push({ playerId, bracket, name: player.name, reason: "empty_stats" });

        await supabase
          .from("latest_activity")
          .update({
            profile_last_scan_at: now,
            profile_next_scan_at: nextDue,
            profile_scan_error: "empty_stats",
          })
          .eq("player_id", playerId)
          .eq("bracket", bracket);

        continue;
      }

      const { data: previous } = await supabase
        .from("profile_pvp_snapshots")
        .select("*")
        .eq("player_id", playerId)
        .eq("bracket", bracket)
        .maybeSingle();

      const ratingDelta = previous ? stats.rating - previous.rating : 0;
      const winsDelta = previous ? stats.wins - previous.wins : 0;
      const lossesDelta = previous ? stats.losses - previous.losses : 0;
      const gamesDelta = winsDelta + lossesDelta;
      const isChanged = Boolean(previous && (ratingDelta || winsDelta || lossesDelta));

      await supabase.from("profile_pvp_snapshots").upsert({
        player_id: playerId,
        bracket,
        rating: stats.rating,
        wins: stats.wins,
        losses: stats.losses,
        last_scanned_at: now,
        raw: bracketData,
      });

      await supabase
        .from("latest_activity")
        .update({
          rating: stats.rating || row.rating,
          wins: stats.wins || row.wins,
          losses: stats.losses || row.losses,
          rating_delta: ratingDelta,
          wins_delta: winsDelta,
          losses_delta: lossesDelta,
          games_delta: gamesDelta,
          last_active_at: isChanged ? now : row.last_active_at,
          profile_last_scan_at: now,
          profile_next_scan_at: nextDue,
          profile_scan_error: null,
          activity_status: activityStatusFromMinutes(minutesAgo(isChanged ? now : row.last_active_at)),
        })
        .eq("player_id", playerId)
        .eq("bracket", bracket);

      if (isChanged) {
        await supabase.from("activity_events").insert({
          poll_id: pollId,
          bracket,
          player_id: playerId,
          rank: row.rank,
          rating: stats.rating,
          wins: stats.wins,
          losses: stats.losses,
          rating_delta: ratingDelta,
          wins_delta: winsDelta,
          losses_delta: lossesDelta,
          games_delta: gamesDelta,
          detected_at: now,
        });

        changed.push({
          playerId,
          bracket,
          name: player.name,
          rating: stats.rating,
          ratingDelta,
          winsDelta,
          lossesDelta,
          gamesDelta,
        });
      }

      scanned.push({
        playerId,
        bracket,
        name: player.name,
        rating: stats.rating,
        wins: stats.wins,
        losses: stats.losses,
        changed: isChanged,
        nextScanAt: nextDue,
      });
    } catch (e: any) {
      const reason = e?.message || "unknown_error";

      failed.push({
        playerId,
        bracket,
        name: player.name,
        reason,
      });

      await supabase
        .from("latest_activity")
        .update({
          profile_last_scan_at: now,
          profile_next_scan_at: nextDue,
          profile_scan_error: reason.slice(0, 500),
        })
        .eq("player_id", playerId)
        .eq("bracket", bracket);
    }
  }

  return {
    ok: true,
    pollId,
    due: dueRows?.length || 0,
    scanned: scanned.length,
    changed: changed.length,
    failed: failed.length,
    changedItems: changed.slice(0, 20),
    failedItems: failed.slice(0, 10),
  };
}
