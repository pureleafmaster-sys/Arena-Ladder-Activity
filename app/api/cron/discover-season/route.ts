import { NextResponse } from "next/server";
import { getPvpSeasonsIndex } from "@/lib/blizzard";

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

  const data = await getPvpSeasonsIndex();
  return NextResponse.json({
    note: "Pick the TBC Classic Anniversary Season 1 id and set BLIZZARD_PVP_SEASON_ID.",
    data,
  });
}
