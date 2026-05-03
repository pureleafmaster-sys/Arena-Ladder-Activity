import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLadder } from "@/lib/blizzard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BRACKETS = ["2v2", "3v3", "5v5"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results: any[] = [];

    for (const bracket of BRACKETS) {
      const ladder = await getLadder(bracket);

      const pollId = crypto.randomUUID();

      let inserted = 0;

      for (const entry of ladder) {
        const playerId = `${entry.character.name}-${entry.character.realm.slug}`;

        // upsert player
        await supabase.from("players").upsert({
          id: playerId,
          name: entry.character.name,
          realm_slug: entry.character.realm.slug,
          realm_name: entry.character.realm.name,
          updated_at: new Date().toISOString(),
        });

        // insert ladder snapshot
        await supabase.from("ladder_entries").insert({
          poll_id: pollId,
          bracket,
          player_id: playerId,
          rank: entry.rank,
          rating: entry.rating,
          wins: entry.season_match_statistics?.won || 0,
          losses: entry.season_match_statistics?.lost || 0,
          detected_at: new Date().toISOString(),
        });

        inserted++;
      }

      results.push({
        bracket,
        pollId,
        inserted,
      });
    }

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (e: any) {
    console.error("poll error", e);
    return NextResponse.json(
      { error: "poll failed", details: e.message },
      { status: 500 }
    );
  }
}
