import { NextResponse } from "next/server";
import { runProfileScan } from "@/lib/profile-scan";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const VALID_BRACKETS = new Set(["2v2", "3v3", "5v5"]);

function authorized(req: Request) {
  const urlSecret = new URL(req.url).searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "");
  return urlSecret === process.env.CRON_SECRET || bearerSecret === process.env.CRON_SECRET;
}

function requestedBrackets(req: Request) {
  const url = new URL(req.url);
  const bracket = url.searchParams.get("bracket");

  if (bracket) {
    if (!VALID_BRACKETS.has(bracket)) {
      throw new Error(`Invalid bracket "${bracket}". Use 2v2, 3v3, or 5v5.`);
    }

    return [bracket];
  }

  // Backwards compatible fallback.
  return (process.env.PROFILE_SCAN_BRACKETS || "2v2,3v3,5v5")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => VALID_BRACKETS.has(x));
}

function parseRatingParam(req: Request, key: "minRating" | "maxRating") {
  const value = new URL(req.url).searchParams.get(key);
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${key}: "${value}"`);
  }

  return parsed;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = Date.now();

  try {
    const brackets = requestedBrackets(req);
    const minRating = parseRatingParam(req, "minRating");
    const maxRating = parseRatingParam(req, "maxRating");
    const results = [];

    for (const bracket of brackets) {
      const bracketStartedAt = Date.now();
      const result = await runProfileScan({
        bracket,
        minRating: minRating ?? undefined,
        maxRating: maxRating ?? undefined,
      });

      results.push({
        bracket,
        minRating,
        maxRating,
        durationMs: Date.now() - bracketStartedAt,
        ...result,
      });
    }

    return NextResponse.json({
      ok: true,
      brackets,
      minRating,
      maxRating,
      durationMs: Date.now() - startedAt,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Profile scan failed",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
