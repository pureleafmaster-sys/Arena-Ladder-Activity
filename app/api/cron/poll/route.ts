import { NextResponse } from "next/server";
import { getPollBrackets } from "@/lib/env";
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

  const seasonId = process.env.BLIZZARD_PVP_SEASON_ID;
  if (!seasonId) {
    return NextResponse.json(
      { error: "Missing BLIZZARD_PVP_SEASON_ID. Run /api/cron/discover-season first." },
      { status: 400 }
    );
  }

  const results = [];
  for (const bracket of getPollBrackets()) {
    results.push(await pollBracket(seasonId, bracket));
  }

  return NextResponse.json({ ok: true, results });
}
