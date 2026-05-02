import { env, optionalEnv } from "./env";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getBlizzardToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token;

  const region = optionalEnv("BLIZZARD_REGION", "us");
  const clientId = env("BLIZZARD_CLIENT_ID");
  const clientSecret = env("BLIZZARD_CLIENT_SECRET");

  const res = await fetch(`https://${region}.battle.net/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Blizzard OAuth failed ${res.status}: ${await res.text()}`);

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.token;
}

function namespaceForPath(path: string) {
  if (path.startsWith("/profile/wow")) {
    return optionalEnv("BLIZZARD_PROFILE_NAMESPACE", "profile-classicann-us");
  }

  return optionalEnv("BLIZZARD_NAMESPACE", "dynamic-classicann-us");
}

export async function blizzardGet(path: string) {
  const region = optionalEnv("BLIZZARD_REGION", "us");
  const namespace = namespaceForPath(path);
  const locale = optionalEnv("BLIZZARD_LOCALE", "en_US");
  const token = await getBlizzardToken();

  const url = new URL(`https://${region}.api.blizzard.com${path}`);

  if (!url.searchParams.has("namespace")) url.searchParams.set("namespace", namespace);
  if (!url.searchParams.has("locale")) url.searchParams.set("locale", locale);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Blizzard GET failed ${res.status} ${url.pathname}: ${await res.text()}`);
  }

  return res.json();
}

export async function getPvpSeasonsIndex() {
  return blizzardGet("/data/wow/pvp-season/index");
}

export async function getPvpLeaderboard(seasonId: string, bracket: string) {
  return blizzardGet(`/data/wow/pvp-season/${seasonId}/pvp-leaderboard/${bracket}`);
}

function normalize(value: any): string {
  if (!value) return "Unknown";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.name) return String(value.name);
  return "Unknown";
}

export async function getCharacterProfile(realmSlug: string, name: string) {
  return blizzardGet(`/profile/wow/character/${realmSlug}/${name.toLowerCase()}`);
}

export async function getCharacterSpecializations(realmSlug: string, name: string) {
  try {
    return await blizzardGet(`/profile/wow/character/${realmSlug}/${name.toLowerCase()}/specializations`);
  } catch {
    return null;
  }
}

export function parseProfile(profile: any) {
  const factionName = normalize(profile?.faction);

  return {
    faction: factionName === "Alliance" || factionName === "Horde" ? factionName : "Unknown",
    race: normalize(profile?.race),
    className: normalize(profile?.character_class),
    gender: normalize(profile?.gender),
  };
}

const treeNames: Record<string, string[]> = {
  Warrior: ["Arms", "Fury", "Protection"],
  Paladin: ["Holy", "Protection", "Retribution"],
  Hunter: ["Beast Mastery", "Marksmanship", "Survival"],
  Rogue: ["Assassination", "Combat", "Subtlety"],
  Priest: ["Discipline", "Holy", "Shadow"],
  Shaman: ["Elemental", "Enhancement", "Restoration"],
  Mage: ["Arcane", "Fire", "Frost"],
  Warlock: ["Affliction", "Demonology", "Destruction"],
  Druid: ["Balance", "Feral", "Restoration"],
};

export function inferSpec(className: string, specs: any): string {
  const active = specs?.active_specialization?.name;
  if (active) return active;

  const groups = specs?.specialization_groups || specs?.talent_groups || [];
  const group = groups.find((x: any) => x?.is_active || x?.selected) || groups[0];
  const trees = group?.specializations || group?.talent_trees || group?.talents || [];

  let best = "";
  let bestPoints = -1;

  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    const name =
      tree?.specialization?.name ||
      tree?.name ||
      tree?.talent_tree?.name ||
      treeNames[className]?.[i];

    const points = Number(
      tree?.spent_points ??
        tree?.points_spent ??
        tree?.points ??
        tree?.talents?.length ??
        0
    );

    if (name && points > bestPoints) {
      best = name;
      bestPoints = points;
    }
  }

  return best || "Unknown";
}

export function parseLeaderboardRows(data: any) {
  const rows = data?.entries || [];

  return rows
    .map((entry: any) => {
      const character = entry?.character || entry?.player?.character || {};
      const name = character?.name || entry?.name;
      const realmSlug =
        character?.realm?.slug ||
        character?.realm?.slug_name ||
        entry?.realm?.slug;
      const realmName = character?.realm?.name || realmSlug;
      const id = character?.id || `${realmSlug}-${name}`.toLowerCase();

      return {
        id: String(id),
        name,
        realmSlug,
        realmName,
        rank: Number(entry?.rank ?? entry?.ranking ?? 0),
        rating: Number(entry?.rating ?? 0),
        wins: Number(
          entry?.season_match_statistics?.won ??
            entry?.won ??
            entry?.wins ??
            0
        ),
        losses: Number(
          entry?.season_match_statistics?.lost ??
            entry?.lost ??
            entry?.losses ??
            0
        ),
      };
    })
    .filter((x: any) => x.name && x.realmSlug && x.rating);
}
