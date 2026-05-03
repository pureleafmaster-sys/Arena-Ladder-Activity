import Link from "next/link";

function formatEstTimestamp(ts: string | null) {
  if (!ts) return "—";

  const date = new Date(ts);
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function delta(value: number) {
  if (!value) return null;
  return (
    <span className={value > 0 ? "text-green-400" : "text-red-400"}>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

function titleColor(tier: string) {
  if (tier === "rank1") return "text-yellow-300";
  if (tier === "gladiator") return "text-purple-300";
  if (tier === "duelist") return "text-cyan-300";
  if (tier === "rival") return "text-blue-300";
  if (tier === "challenger") return "text-green-300";
  return "text-zinc-400";
}

async function getPlayer(realm: string, name: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const path = `/api/player/${encodeURIComponent(realm)}/${encodeURIComponent(name)}`;

  const res = await fetch(base ? `${base}${path}` : path, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ realm: string; name: string }>;
}) {
  const { realm, name } = await params;
  const data = await getPlayer(realm, name);

  if (!data) {
    return (
      <main className="min-h-screen bg-black p-6 text-zinc-100">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="text-sm text-orange-400 hover:underline">
            ← Back to ladder
          </Link>
          <h1 className="mt-8 text-3xl font-black">Player not found</h1>
        </div>
      </main>
    );
  }

  const player = data.player;

  return (
    <main className="min-h-screen bg-black p-4 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="text-sm text-orange-400 hover:underline">
          ← Back to ladder
        </Link>

        <header className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-orange-500">{player.name}</span>{" "}
            <span className="text-zinc-300">- {player.realmName}</span>
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            {player.race} {player.spec} {player.className} · {player.faction}
          </p>
        </header>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          {data.brackets.map((b: any) => (
            <div key={b.bracket} className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-black uppercase">{b.bracket}</h2>
                <span className={`text-xs font-bold ${titleColor(b.titleTier)}`}>
                  {b.title || "—"}
                </span>
              </div>

              <div className="mt-4 text-4xl font-black">
                {b.rating || "—"}{" "}
                <span className="text-lg">{delta(b.ratingDelta)}</span>
              </div>

              <div className="mt-2 text-sm">
                <span className="text-green-400">{b.wins}</span>
                <span className="text-zinc-500"> - </span>
                <span className="text-red-400">{b.losses}</span>
              </div>

              <div className="mt-4 text-xs text-zinc-500">
                Rank: {b.rank ? `#${b.rank}` : "—"}
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                Last active: {formatEstTimestamp(b.lastActiveAt)}
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                Last scanned: {formatEstTimestamp(b.profileLastScanAt || b.lastSeenAt)}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950">
            <div className="border-b border-zinc-900 p-4">
              <h2 className="text-xl font-black">Recent Activity</h2>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-black text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Bracket</th>
                  <th className="px-4 py-2">Rating</th>
                  <th className="px-4 py-2">W/L Change</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e: any) => (
                  <tr key={e.id} className="border-b border-zinc-900">
                    <td className="px-4 py-2 text-zinc-300">{formatEstTimestamp(e.detected_at)}</td>
                    <td className="px-4 py-2 font-bold">{e.bracket}</td>
                    <td className="px-4 py-2">
                      {e.rating} <span className="ml-1">{delta(e.rating_delta)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-green-400">+{Math.max(0, e.wins_delta || 0)}W</span>
                      <span className="text-zinc-600"> / </span>
                      <span className="text-red-400">+{Math.max(0, e.losses_delta || 0)}L</span>
                    </td>
                  </tr>
                ))}

                {data.events.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                      No tracked activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <h2 className="text-xl font-black">Profile Snapshots</h2>

            <div className="mt-4 space-y-3">
              {data.snapshots.map((s: any) => (
                <div key={s.bracket} className="rounded-xl border border-zinc-900 bg-black p-3">
                  <div className="font-bold uppercase">{s.bracket}</div>
                  <div className="mt-2 text-sm">
                    Rating: <span className="font-bold">{s.rating}</span>
                  </div>
                  <div className="text-sm">
                    W/L: <span className="text-green-400">{s.wins}</span>
                    <span className="text-zinc-500"> - </span>
                    <span className="text-red-400">{s.losses}</span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Scanned: {formatEstTimestamp(s.last_scanned_at)}
                  </div>
                </div>
              ))}

              {data.snapshots.length === 0 && (
                <div className="text-sm text-zinc-500">No profile snapshots yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
