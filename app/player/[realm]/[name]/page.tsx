"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

function qualityColor(quality: string) {
  const q = String(quality || "").toUpperCase();
  if (q.includes("LEGENDARY")) return "text-orange-400";
  if (q.includes("EPIC")) return "text-purple-300";
  if (q.includes("RARE")) return "text-blue-300";
  if (q.includes("UNCOMMON")) return "text-green-300";
  if (q.includes("POOR")) return "text-zinc-500";
  return "text-zinc-100";
}

const slotOrder = [
  "HEAD",
  "NECK",
  "SHOULDER",
  "BACK",
  "CHEST",
  "SHIRT",
  "TABARD",
  "WRIST",
  "HANDS",
  "WAIST",
  "LEGS",
  "FEET",
  "FINGER_1",
  "FINGER_2",
  "TRINKET_1",
  "TRINKET_2",
  "MAIN_HAND",
  "OFF_HAND",
  "RANGED",
];

function sortGear(gear: any[]) {
  return [...(gear || [])].sort((a, b) => {
    const ai = slotOrder.indexOf(a.slotType);
    const bi = slotOrder.indexOf(b.slotType);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function GearRow({ item }: { item: any }) {
  return (
    <div className="group rounded-xl border border-zinc-900 bg-black p-3 hover:border-zinc-700">
      <div className="flex gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-zinc-700 bg-zinc-900">
          {item.icon ? (
            <img src={item.icon} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-zinc-600">?</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">{item.slot}</div>
              <div className={`truncate text-sm font-bold ${qualityColor(item.quality)}`}>
                {item.name}
              </div>
            </div>

            {item.itemLevel && (
              <div className="rounded bg-zinc-900 px-2 py-1 text-xs font-bold text-zinc-300">
                ilvl {item.itemLevel}
              </div>
            )}
          </div>

          {item.enchant && (
            <div className="mt-1 text-xs text-green-400">{item.enchant}</div>
          )}

          {item.stats?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
              {item.stats.slice(0, 4).map((s: string) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          )}

          {item.sockets?.some((s: any) => s.item) && (
            <div className="mt-1 text-xs text-zinc-500">
              {item.sockets
                .filter((s: any) => s.item)
                .map((s: any) => s.item)
                .join(" · ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  const params = useParams<{ realm: string; name: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/player/${encodeURIComponent(params.realm)}/${encodeURIComponent(params.name)}`, {
        cache: "no-store",
      });

      if (res.ok) setData(await res.json());
      else setData(null);

      setLoading(false);
    }

    load();
  }, [params.realm, params.name]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-zinc-100">
        <div className="mx-auto max-w-7xl">Loading player...</div>
      </main>
    );
  }

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
  const gear = sortGear(data.gear?.gear || []);

  return (
    <main className="min-h-screen bg-black p-4 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="text-sm text-orange-400 hover:underline">
          ← Back to ladder
        </Link>

        <header className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">
                <span className="text-orange-500">{player.name}</span>{" "}
                <span className="text-zinc-300">- {player.realmName}</span>
              </h1>

              <p className="mt-2 text-sm text-zinc-400">
                {player.race} {player.spec} {player.className} · {player.faction}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-right">
              <div className="text-xs uppercase text-zinc-500">Last gear scan</div>
              <div className="text-sm font-bold text-zinc-200">{formatEstTimestamp(data.gear?.fetchedAt)}</div>
              <div className="text-xs text-zinc-600">{data.gear?.source === "cached" ? "cached fallback" : "live/cached"}</div>
            </div>
          </div>
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
                {(b.winsDelta || b.lossesDelta) ? (
                  <span className="ml-2 text-xs">
                    <span className="text-green-400">+{Math.max(0, b.winsDelta)}W</span>
                    <span className="text-zinc-600"> / </span>
                    <span className="text-red-400">+{Math.max(0, b.lossesDelta)}L</span>
                  </span>
                ) : null}
              </div>

              <div className="mt-4 text-xs text-zinc-500">Rank: {b.rank ? `#${b.rank}` : "—"}</div>
              <div className="mt-1 text-xs text-zinc-500">Last active: {formatEstTimestamp(b.lastActiveAt)}</div>
              <div className="mt-1 text-xs text-zinc-500">Last scanned: {formatEstTimestamp(b.profileLastScanAt || b.lastSeenAt)}</div>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_430px]">
          <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950">
            <div className="border-b border-zinc-900 p-4">
              <h2 className="text-xl font-black">Current / Last Equipped Gear</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Average ilvl: {data.gear?.averageItemLevel || "—"} · Equipped ilvl: {data.gear?.equippedItemLevel || "—"}
              </p>
              {data.gear?.error && (
                <p className="mt-1 text-xs text-red-400">
                  Live gear fetch failed; showing cached gear if available.
                </p>
              )}
            </div>

            <div className="grid gap-2 p-4 md:grid-cols-2">
              {gear.map((item: any) => (
                <GearRow key={`${item.slotType}-${item.name}`} item={item} />
              ))}

              {gear.length === 0 && (
                <div className="col-span-2 py-10 text-center text-zinc-500">
                  No gear cached yet. Open this page again after Blizzard equipment data is available.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950">
              <div className="border-b border-zinc-900 p-4">
                <h2 className="text-xl font-black">Recent Activity</h2>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-black uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Bracket</th>
                    <th className="px-3 py-2">Rating</th>
                    <th className="px-3 py-2">W/L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e: any) => (
                    <tr key={e.id} className="border-b border-zinc-900">
                      <td className="px-3 py-2 text-zinc-300">{formatEstTimestamp(e.detected_at)}</td>
                      <td className="px-3 py-2 font-bold">{e.bracket}</td>
                      <td className="px-3 py-2">
                        {e.rating} <span className="ml-1">{delta(e.rating_delta)}</span>
                      </td>
                      <td className="px-3 py-2">
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
          </div>
        </section>
      </div>
    </main>
  );
}
