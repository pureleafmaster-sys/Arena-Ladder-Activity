import { Suspense } from "react";
import Leaderboard from "@/components/Leaderboard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black p-6 text-zinc-100">Loading...</div>}>
      <Leaderboard />
    </Suspense>
  );
}
