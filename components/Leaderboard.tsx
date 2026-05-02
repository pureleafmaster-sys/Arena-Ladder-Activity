"use client";

import { useEffect, useMemo, useState } from "react";
import { classIcon, raceIcon, specIcon } from "@/lib/icons";
import type { ActivityPlayer, Bracket } from "@/lib/types";

function deltaClass(value: number) {
  if (value > 0) return "text-green-400";
  if (value < 0) return "text-red-500";
  return "text-zinc-300";
}

function trackedClass(minutes: number | null) {
  if (minutes === null) return "text-zinc-500";
  if (minutes <= 5) return "text-orange-400";
  if (minutes <= 15) return "text-green-400";
  return "text-zinc-300";
}

function factionRealmClass(faction: string) {
  if (faction === "Alliance") return "text-cyan-400";
  if (faction === "Horde") return "text-red-500";
  return "text-zinc-300";
}

function IconBox({ src, title }: { src?: string; title: string }) {
  return (
    <span title={title} className="block h-7 w-7 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-inner">
      {src ? (
        <img src={src} alt={title} className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-xs text-zinc-500">?</span>
      )}
    </span>
  );
}

function PlayerRow({ player }: { player: ActivityPlayer }) {
  return (
    <tr className="group border-b border-zinc-900 hover:bg-zinc-900">
      <td className="px-5 py-3 font-bold text-orange-400 whitespace-nowrap">
        #{player.rank ?? "-"} <span className={deltaClass(player.rankDelta)}>{player.rankDelta > 0 ? `+${player.rankDelta}` : player.rankDelta}</span>
      </td>
      <td className="px-5 py-3">
        <div className="flex gap-1">
          <IconBox src={raceIcon[player.race]} title={player.race} />
          <IconBox src={classIcon[player.className]} title={player.className} />
          <IconBox src={specIcon[player.spec] || specIcon.Unknown} title={`${player.spec} ${player.className}`} />
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="font-semibold text-white">{player.name}</div>
        <div className="text-xs text-zinc-500">{player.race} {player.spec} {player.className}</div>
      </td>
      <td className={`px-5 py-3 font-semibold ${factionRealmClass(player.faction)}`}>{player.realm}</td>
      <td className="px-5 py-3 whitespace-nowrap">
        <span className="text-green-400">{player.wins}</span>
        <span className="text-zinc-500"> / </span>
        <span className="text-red-400">{player.losses}</span>
      </td>
      <td className="px-5 py-3 font-semibold whitespace-nowrap">
        {player.rating} <span className={deltaClass(player.ratingDelta)}>{player.ratingDelta > 0 ? `+${player.ratingDelta}` : player.ratingDelta}</span>
      </td>
      <td className={`px-5 py-3 font-semibold whitespace-nowrap ${trackedClass(player.trackedMinutesAgo)}`}>
        {player.trackedMinutesAgo === null ? "not active" : `${player.trackedMinutesAgo} minutes ago`}
      </td>
      <td className="relative px-5 py-3">
        <div className="inline-flex cursor-default items-center gap-2 rounded-full border border-green-900 bg-green-950 px-3 py-1 text-xs text-green-300">
          likely team
        </div>
        <div className="pointer-events-none absolute right-5 top-10 z-20 hidden w-80 rounded-2xl border border-zinc-700 bg-zinc-950 p-4 text-sm shadow-2xl group-hover:block">
          <div className="mb-2 font-bold text-white">Likely queuing together</div>
          <div className="space-y-1 text-zinc-300">
            {player.team.map((name) => (
              <div key={name} className="flex items-center justify-between">
                <span>{name}</span>
                <span className="text-zinc-500">{player.bracket}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 text-xs">
            <div className="rounded-xl bg-zinc-900 p-2">
              <div className="text-zinc-500">Session</div>
              <div className="font-bold text-white">{player.session}</div>
            </div>
            <div className="rounded-xl bg-zinc-900 p-2">
              <div className="text-zinc-500">Last delta</div>
              <div className={deltaClass(player.ratingDelta)}>{player.ratingDelta > 0 ? `+${player.ratingDelta}` : player.ratingDelta}</div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function Leaderboard() {
  const [bracket, setBracket] = useState<Bracket>("3v3");
  const [minRating, setMinRating] = useState(2100);
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<ActivityPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ bracket, minRating: String(minRating), q: query });
    const res = await fetch(`/api/activity?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setPlayers(data.items || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [bracket, minRating]);

  const shown = useMemo(() => {
    if (!query) return players;
    const q = query.toLowerCase();
    return players.filter((p) =>
      `${p.name} ${p.realm} ${p.faction} ${p.race} ${p.className} ${p.spec}`.toLowerCase().includes(q)
    );
  }, [players, query]);

  return (
    <div className="min-h-screen bg-black p-6 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              <span className="text-orange-500">TBC CLASSIC ANNIVERSARY</span> ACTIVITY
            </h1>
            <p className="mt-2 text-sm text-zinc-400">US Season 1 arena activity tracker for 2100+ 3v3 and 5v5 ladders.</p>
          </div>
          <button onClick={load} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        <div className="mb-5 grid grid-cols-3 gap-3 border-b border-green-800 pb-5">
          {(["2v2", "3v3", "5v5"] as Bracket[]).map((b) => (
            <button
              key={b}
              onClick={() => setBracket(b)}
              className={`rounded-md px-4 py-3 text-lg font-black transition ${bracket === b ? "bg-green-800 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search player, realm, race, class, spec..."
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-green-700 md:col-span-2"
          />
          <input
            type="number"
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value) || 0)}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-green-700"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-4">
            <div className="font-bold">SHOWING {shown.length}</div>
            <div className="text-sm text-zinc-400">Details = Race / Class / Spec</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Realm</th>
                  <th className="px-5 py-3">Won / Lost</th>
                  <th className="px-5 py-3">Rating</th>
                  <th className="px-5 py-3">Tracked</th>
                  <th className="px-5 py-3">Team</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((player) => <PlayerRow key={player.bracket + player.playerId} player={player} />)}
                {!loading && shown.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-zinc-500">
                      No data yet. Run the poll endpoint after setting env vars and season id.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-900 bg-zinc-950 p-5 text-sm text-zinc-400">
          Blizzard API polling detects ladder changes when Blizzard updates the data. It does not guarantee literal live queue state.
        </div>
      </div>
    </div>
  );
}
