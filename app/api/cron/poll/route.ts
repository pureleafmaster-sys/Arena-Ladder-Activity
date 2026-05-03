import { NextResponse } from "next/server";
import { pollBracket } from "@/lib/poller";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const VALID_BRACKETS = new Set(["2v2", "3v3", "5v5"]);

function authorized(req: Request) {
  const url = new URL(req.url);
  const urlSecret = url.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "");

  return (
    urlSecret === process.env.CRON_SECRET ||
    bearerSecret === process.env.CRON_SECRET
  );
}

function getRequestedBrackets(req: Request) {
  const url = new URL(req.url);
  const bracketParam = url.searchParams.get("bracket");

  if (bracketParam) {
    const bracket = bracketParam.trim();

    if (!VALID_BRACKETS.has(bracket)) {
      throw new Error(`Invalid bracket "${bracket}". Use 2v2, 3v3, or 5v5.`);
    }

    return [bracket];
  }

  return (process.env.POLL_BRACKETS || "2v2,3v3,5v5")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => VALID_BRACKETS.has(x));
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const seasonId = process.env.BLIZZARD_PVP_SEASON_ID || "1";
    const brackets = getRequestedBrackets(req);
    const results = [];

    for (const bracket of brackets) {
      const bracketStartedAt = Date.now();
      const result = await pollBracket(seasonId, bracket);

      results.push({
        ...result,
        durationMs: Date.now() - bracketStartedAt,
      });
    }

    return NextResponse.json({
      ok: true,
      seasonId,
      brackets,
      durationMs: Date.now() - startedAt,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Poll failed",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
