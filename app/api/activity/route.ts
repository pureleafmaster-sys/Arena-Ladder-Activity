import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const bracket = searchParams.get("bracket") || "3v3";
  const minRating = Number(searchParams.get("minRating") || 0);

  // 🔥 3 hour window
  const activityWindowStart = new Date(
    Date.now() - 3 * 60 * 60 * 1000
  ).toISOString();

  // Get activity events
  const { data, error } = await supabase
    .from("activity_events")
    .select("*")
    .eq("bracket", bracket)
    .gte("detected_at", activityWindowStart)
    .gte("rating", minRating)
    .order("rating", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }

  // 🚫 Filter out fake activity (rank-only changes)
  const filtered = (data || []).filter((row) => {
    return (
      row.rating_delta !== 0 ||
      row.wins_delta !== 0 ||
      row.losses_delta !== 0
    );
  });

  return NextResponse.json({
    count: filtered.length,
    data: filtered,
  });
}
