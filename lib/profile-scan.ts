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
  const limit = Number(optionalEnv("PROFILE_SCAN_LIMIT", "75"));

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
  const unchanged: any[] = [];

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

      // If the profile endpoint returns no useful stats, do not overwrite good data.
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

      const isChanged = Boolean(
        previous &&
          (ratingDelta !== 0 || winsDelta !== 0 || lossesDelta !== 0)
      );

      // Always update the profile snapshot after comparison.
      await supabase.from("profile_pvp_snapshots").upsert({
        player_id: playerId,
        bracket,
        rating: stats.rating,
        wins: stats.wins,
        losses: stats.losses,
        last_scanned_at: now,
        raw: bracketData,
      });

      const lastActiveAt = isChanged ? now : row.last_active_at || null;

      // Critical fix:
      // If unchanged, reset displayed deltas to 0 so stale +12 / +4W spam disappears.
      await supabase
        .from("latest_activity")
        .update({
          rating: stats.rating || row.rating,
          wins: stats.wins,
          losses: stats.losses,
          rating_delta: isChanged ? ratingDelta : 0,
          wins_delta: isChanged ? winsDelta : 0,
          losses_delta: isChanged ? lossesDelta : 0,
          games_delta: isChanged ? gamesDelta : 0,
          last_active_at: lastActiveAt,
          profile_last_scan_at: now,
          profile_next_scan_at: nextDue,
          profile_scan_error: null,
          activity_status: activityStatusFromMinutes(minutesAgo(lastActiveAt)),
        })
        .eq("player_id", playerId)
        .eq("bracket", bracket);

      if (isChanged) {
        const activityEvent = {
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
        };

        // Upsert prevents duplicate exact same snapshots if a retry happens.
        const { error: activityError } = await supabase
          .from("activity_events")
          .upsert(activityEvent, {
            onConflict: "player_id,bracket,rating,wins,losses",
            ignoreDuplicates: true,
          });

        if (activityError) throw activityError;

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
      } else {
        unchanged.push({
          playerId,
          bracket,
          name: player.name,
          rating: stats.rating,
          wins: stats.wins,
          losses: stats.losses,
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
    unchanged: unchanged.length,
    failed: failed.length,
    changedItems: changed.slice(0, 20),
    failedItems: failed.slice(0, 10),
  };
}
