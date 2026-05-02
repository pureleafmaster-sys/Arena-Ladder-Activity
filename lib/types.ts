export type Bracket = "2v2" | "3v3" | "5v5";

export type ActivityPlayer = {
  playerId: string;
  rank: number | null;
  rankDelta: number;
  name: string;
  realm: string;
  realmSlug: string;
  faction: string;
  race: string;
  className: string;
  spec: string;
  bracket: Bracket;
  wins: number;
  losses: number;
  rating: number;
  ratingDelta: number;
  winsDelta: number;
  lossesDelta: number;
  trackedMinutesAgo: number | null;
  team: string[];
  session: string;
};
