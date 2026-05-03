// lib/profile-scan.ts (FIXED DELTA LOGIC)

const isChanged =
  rating !== prev.rating ||
  wins !== prev.wins ||
  losses !== prev.losses;

const ratingDelta = rating - prev.rating;
const winsDelta = wins - prev.wins;
const lossesDelta = losses - prev.losses;
const gamesDelta = winsDelta + lossesDelta;

// 🔥 FIX: zero out deltas if no real change
const safeActivity = {
  rating,
  wins,
  losses,
  rating_delta: isChanged ? ratingDelta : 0,
  wins_delta: isChanged ? winsDelta : 0,
  losses_delta: isChanged ? lossesDelta : 0,
  games_delta: isChanged ? gamesDelta : 0,
  detected_at: new Date().toISOString(),
};

// only insert into history if something actually changed
if (isChanged) {
  await supabase.from("activity_history").insert({
    player_id,
    bracket,
    rating,
    wins,
    losses,
    rating_delta: ratingDelta,
    wins_delta: winsDelta,
    losses_delta: lossesDelta,
    detected_at: new Date().toISOString(),
  });
}

// always upsert latest snapshot
await supabase.from("latest_activity").upsert({
  player_id,
  bracket,
  ...safeActivity,
});
