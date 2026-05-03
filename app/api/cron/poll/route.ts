import { NextResponse } from "next/server";
import { pollBracket } from "@/lib/poller";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const urlSecret = new URL(req.url).searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "");
  return urlSecret === process.env.CRON_SECRET || bearerSecret === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const seasonId = process.env.BLIZZARD_PVP_SEASON_ID || "1";
  const bracketParam = url.searchParams.get("bracket");

  const brackets = bracketParam
    ? [bracketParam]
    : (process.env.POLL_BRACKETS || "2v2,3v3,5v5")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

  const results = [];

  for (const bracket of brackets) {
    results.push(await pollBracket(seasonId, bracket));
  }

  return NextResponse.json({ ok: true, results });
}
