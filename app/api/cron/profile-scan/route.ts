import { NextResponse } from "next/server";
import { runProfileScan } from "@/lib/profile-scan";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const urlSecret = new URL(req.url).searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "");
  return urlSecret === process.env.CRON_SECRET || bearerSecret === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runProfileScan();

  return NextResponse.json(result);
}
