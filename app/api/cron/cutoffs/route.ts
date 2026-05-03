import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Bracket = "2v2" | "3v3" | "5v5";

const IRONFORGE_URLS: Record<Bracket, string> = {
  "2v2": "https://ironforge.pro/anniversary/leaderboards/US/2/",
  "3v3": "https://ironforge.pro/anniversary/leaderboards/US/3/",
  "5v5": "https://ironforge.pro/anniversary/leaderboards/US/5/",
};

function authorized(req: Request) {
  const urlSecret = new URL(req.url).searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "");
  return urlSecret === process.env.CRON_SECRET || bearerSecret === process.env.CRON_SECRET;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function findNumberNear(text: string, labels: string[], fallback?: number) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const patterns = [
      new RegExp(`${escaped}\\s*[:#-]?\\s*(?:rank\\s*)?#?\\s*(\\d{1,6})`, "i"),
      new RegExp(`${escaped}[\\s\\S]{0,80}?(?:rank\\s*)?#?\\s*(\\d{1,6})`, "i"),
      new RegExp(`(?:rank\\s*)?#?\\s*(\\d{1,6})[\\s\\S]{0,80}?${escaped}`, "i"),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return Number(match[1]);
    }
  }

  return fallback ?? null;
}

function parseCutoffs(html: string) {
  const text = stripHtml(html);

  // Ironforge can change markup. These regexes intentionally search broad visible text.
  const rankOne = findNumberNear(text, ["Rank 1", "R1", "Infernal Gladiator"], 5);
  const gladiator = findNumberNear(text, ["Gladiator", "Glad"], 25);
  const duelist = findNumberNear(text, ["Duelist"], 150);
  const rival = findNumberNear(text, ["Rival"], 500);
  const challenger = findNumberNear(text, ["Challenger"], 1000);

  return {
    rank_one_cutoff: rankOne,
    gladiator_cutoff: gladiator,
    duelist_cutoff: duelist,
    rival_cutoff: rival,
    challenger_cutoff: challenger,
    parsed_text_sample: text.slice(0, 1200),
  };
}

async function fetchIronforgeCutoffs(bracket: Bracket) {
  const sourceUrl = IRONFORGE_URLS[bracket];

  const res = await fetch(sourceUrl, {
    cache: "no-store",
    headers: {
      "user-agent":
        "ArenaLadder.com cutoff checker; contact: site owner; purpose: once-daily cutoff cache",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Ironforge fetch failed for ${bracket}: ${res.status} ${await res.text()}`);
  }

  const html = await res.text();
  const parsed = parseCutoffs(html);

  if (
    !parsed.rank_one_cutoff ||
    !parsed.gladiator_cutoff ||
    !parsed.duelist_cutoff ||
    !parsed.rival_cutoff
  ) {
    throw new Error(`Could not parse required cutoffs for ${bracket}`);
  }

  return {
    bracket,
    sourceUrl,
    ...parsed,
  };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const requestedBracket = url.searchParams.get("bracket") as Bracket | null;

  const brackets: Bracket[] = requestedBracket
    ? [requestedBracket]
    : ["2v2", "3v3", "5v5"];

  const results = [];

  for (const bracket of brackets) {
    if (!IRONFORGE_URLS[bracket]) {
      results.push({ bracket, ok: false, error: "Invalid bracket" });
      continue;
    }

    try {
      const cutoff = await fetchIronforgeCutoffs(bracket);

      const payload = {
        bracket,
        rank_one_cutoff: cutoff.rank_one_cutoff,
        gladiator_cutoff: cutoff.gladiator_cutoff,
        duelist_cutoff: cutoff.duelist_cutoff,
        rival_cutoff: cutoff.rival_cutoff,
        challenger_cutoff: cutoff.challenger_cutoff,
        source: "ironforge-scrape",
        source_url: cutoff.sourceUrl,
        raw: cutoff,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("title_cutoffs")
        .upsert(payload, { onConflict: "bracket" });

      if (error) throw error;

      results.push({
        bracket,
        ok: true,
        sourceUrl: cutoff.sourceUrl,
        cutoffs: {
          rankOne: cutoff.rank_one_cutoff,
          gladiator: cutoff.gladiator_cutoff,
          duelist: cutoff.duelist_cutoff,
          rival: cutoff.rival_cutoff,
          challenger: cutoff.challenger_cutoff,
        },
      });
    } catch (e: any) {
      results.push({
        bracket,
        ok: false,
        error: e?.message || "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: results.some((x) => x.ok),
    results,
  });
}
