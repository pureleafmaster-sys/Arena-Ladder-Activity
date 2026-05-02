export function inferLikelyTeams(
  players: Array<{ player_id: string; name: string; rating_delta: number; wins_delta: number; losses_delta: number }>,
  bracket: string
) {
  const size = bracket === "5v5" ? 5 : bracket === "3v3" ? 3 : 2;
  const active = players.filter((p) => p.wins_delta || p.losses_delta || p.rating_delta);
  const teams = new Map<string, string[]>();

  for (const player of active) {
    const candidates = active
      .filter((p) => p.player_id !== player.player_id)
      .filter((p) => {
        const sameResult =
          (player.wins_delta > 0 && p.wins_delta > 0) ||
          (player.losses_delta > 0 && p.losses_delta > 0);
        const similarDelta = Math.abs(p.rating_delta - player.rating_delta) <= 12;
        return sameResult || similarDelta;
      })
      .sort((a, b) => Math.abs(a.rating_delta - player.rating_delta) - Math.abs(b.rating_delta - player.rating_delta))
      .slice(0, size - 1)
      .map((p) => p.name);

    teams.set(player.player_id, [player.name, ...candidates].slice(0, size));
  }

  return teams;
}
