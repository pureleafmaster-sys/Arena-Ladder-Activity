"use client";

import { useEffect, useMemo, useState } from "react";
import { classIcon, raceIcon, specIcon } from "@/lib/icons";
import type { ActivityPlayer, Bracket } from "@/lib/types";

type Mode = "ladder" | "activity";

function deltaClass(value: number) {
  if (value > 0) return "text-green-400";
  if (value < 0) return "text-red-500";
  return "text-zinc-300";
}

function trackedClass(minutes: number | null, mode: Mode) {
  if (minutes === null) return "text-zinc-500";
  if (mode === "activity" && minutes <= 5) return "text-orange-400";
  if (mode === "activity" && minutes <= 15) return "text-green-400";
  if (mode === "activity" && minutes <= 30) return "text-cyan-300";
  return "text-zinc-300";
}

function statusBadge(status: string) {
  if (status === "hot") return "🔥 HOT";
  if (status === "active") return "ACTIVE";
  if (status === "recent") return "RECENT";
  return "IDLE";
}

function factionRealmClass(faction: string) {
  if (faction === "Alliance") return "text-cyan-400";
  if (faction === "Horde") return "text-red-500";
  return "text-zinc-300";
}

function nameClass(className: string) {
  const map: Record<string, string> = {
    Warrior: "text-yellow-300",
    Paladin: "text-pink-300",
    Hunter: "text-lime-300",
    Rogue: "text-yellow-200",
    Priest: "text-white",
    Shaman: "text-blue-300",
    Mage: "text-cyan-300",
    Warlock: "text-purple-300",
    Druid: "text-orange-300",
  };
  return map[className] || "text-white";
}

function IconBox({ src, title }: { src?: string; title: string }) {
  return (
    <span
      title={title}
      className="block h-6 w-6 overflow-hidden rounded border border-zinc-700 bg-zinc-900"
    >
      {src ? (
        <img src={src} alt={title} className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-[10px] text-zinc-500">?</span>
      )}
    </span>
  );
}

function Pager({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => setPage(1)}
        disabled={page <= 1}
        className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-30"
      >
        {"<<"}
      </button>
      <button
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-30"
      >
        {"<"}
      </button>
      <span className="px-2 font-semibold">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded border border-orange-500 px-2 py-1 disabled:opacity-30"
      >
        {">"}
      </button>
      <button
        onClick={() => setPage(totalPages)}
        disabled={page >= totalPages}
        className="rounded border border-orange-500 px-2 py-1 disabled:opacity-30"
      >
        {">>"}
      </button>
    </div>
  );
}

function PlayerRow({ player, mode }: { player: ActivityPlayer & any; mode: Mode }) {
  return (
    <tr className="group border-b border-zinc-900 hover:bg-zinc-900">
      <td className="px-3 py-2 font-bold text-orange-400 whitespace-nowrap">
        #{player.rank ?? "-"}
      </td>

      <td className="px-3 py-2">
        <div className="flex gap-1">
          <IconBox src={classIcon[player.className] || classIcon.Unknown} title={player.className} />
          <IconBox src={specIcon[player.spec] || specIcon.Unknown} title={`${player.spec} ${player.className}`} />
          <IconBox src={raceIcon[player.race] || raceIcon.Unknown} title={player.race} />
        </div>
      </td>

      <td className="px-3 py-2">
        <div className={`text-sm font-semibold ${nameClass(player.className)}`}>{player.name}</div>
      </td>

      <td className={`px-3 py-2 text-sm font-semibold ${factionRealmClass(player.faction)}`}>
        {player.realm}
      </td>

      <td className="px-3 py-2 text-sm">
        <span className="text-green-400">{player.wins}</span>
        <span className="text-zinc-500"> - </span>
        <span className="text-red-400">{player.losses}</span>
      </td>

      <td className="px-3 py-2 text-sm font-semibold whitespace-nowrap">
        {player.rating}{" "}
        {mode === "activity" && (
          <span className={deltaClass(player.ratingDelta)}>
            {player.ratingDelta > 0 ? `+${player.ratingDelta}` : player.ratingDelta}
          </span>
        )}
      </td>

      <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${trackedClass(player.trackedMinutesAgo, mode)}`}>
        {player.trackedMinutesAgo === null
          ? mode === "activity"
            ? "no activity"
            : "not seen"
          : `${player.trackedMinutesAgo}m`}
      </td>

      <td className="px-3 py-2 text-xs text-zinc-300 whitespace-nowrap">
        {player.className !== "Unknown" || player.race !== "Unknown"
          ? `${player.race} ${player.spec} ${player.className}`
          : "Unknown"}
      </td>

      <td className="relative px-3 py-2">
        {mode === "activity" ? (
          <>
            <div className="inline-flex cursor-default rounded-full border border-green-900 bg-green-950 px-2 py-1 text-[11px] text-green-300">
              team
            </div>

            <div className="pointer-events-none absolute right-3 top-8 z-20 hidden w-72 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs shadow-2xl group-hover:block">
              <div className="mb-2 font-bold text-white">Likely queuing together</div>

              <div className="space-y-1 text-zinc-300">
                {player.team.map((name: string) => (
                  <div key={name} className="flex items-center justify-between">
                    <span>{name}</span>
                    <span className="text-zinc-500">{player.bracket}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
                <div>
                  <div className="text-zinc-500">Session</div>
                  <div className="font-bold text-white">{player.session}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Delta</div>
                  <div className={deltaClass(player.ratingDelta)}>
                    {player.ratingDelta > 0 ? `+${player.ratingDelta}` : player.ratingDelta}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Conf</div>
                  <div className="font-bold text-white">{player.teamConfidence}%</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <span className="text-xs text-zinc-500">—</span>
        )}
      </td>
    </tr>
  );
}

export default function Leaderboard() {
  const [mode, setMode] = useState<Mode>("ladder");
  const [bracket, setBracket] = useState<Bracket>("3v3");
  const [minRating, setMinRating] = useState(2100);
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<(ActivityPlayer & any)[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 100;

  async function load(nextPage = page) {
    setLoading(true);

    const params = new URLSearchParams({
      bracket,
      mode,
      minRating: String(minRating),
      q: query,
      page: String(nextPage),
      pageSize: String(pageSize),
    });

    const res = await fetch(`/api/activity?${params.toString()}`, {
      cache: "no-store",
    });

    const data = await res.json();
    setPlayers(data.items || []);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }

  useEffect(() => {
    setPage(1);
    load(1);
  }, [mode, bracket, minRating]);

  useEffect(() => {
    load(page);
  }, [page]);

  const shown = useMemo(() => players, [players]);

  return (
    <div className="min-h-screen bg-black p-4 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              <span className="text-orange-500">TBC CLASSIC ANNIVERSARY</span>{" "}
              {mode === "activity" ? "ACTIVITY" : "LADDER"}
            </h1>

            <p className="mt-1 text-sm text-zinc-400">
              US Season 1 {mode === "activity" ? "activity tracker" : "arena ladder"} for 2100+.
            </p>
          </div>

          <button
            onClick={() => load(page)}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["ladder", "activity"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-4 py-3 text-lg font-black uppercase transition ${
                mode === m
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="grid flex-1 grid-cols-3 gap-2">
            {(["2v2", "3v3", "5v5"] as Bracket[]).map((b) => (
              <button
                key={b}
                onClick={() => setBracket(b)}
                className={`rounded px-4 py-2 text-base font-black transition ${
                  bracket === b
                    ? "bg-green-800 text-white"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <Pager page={page} totalPages={totalPages} setPage={setPage} />
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_140px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="Search player, realm, race, class, spec..."
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-green-700"
          />

          <input
            type="number"
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value) || 0)}
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-green-700"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-900 px-3 py-3">
            <div className="font-bold">
              SHOWING {shown.length} / PAGE {page}
            </div>
            <div className="text-xs text-zinc-400">
              {mode === "activity" ? "Activity = actual rating or W/L change" : "Ladder = current ranked list"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-[11px] uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Icons</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Realm</th>
                  <th className="px-3 py-2">W/L</th>
                  <th className="px-3 py-2">Rating</th>
                  <th className="px-3 py-2">{mode === "activity" ? "Tracked" : "Scanned"}</th>
                  <th className="px-3 py-2">Class / Race</th>
                  <th className="px-3 py-2">Team</th>
                </tr>
              </thead>

              <tbody>
                {shown.map((p) => (
                  <PlayerRow key={p.bracket + p.playerId} player={p} mode={mode} />
                ))}

                {!loading && shown.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-zinc-500">
                      {mode === "activity"
                        ? "No recent activity yet. Activity appears after a later poll detects rating or W/L changes."
                        : "No ladder data yet. Run the poll endpoint after setting env vars."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 flex justify-center">
          <Pager page={page} totalPages={totalPages} setPage={setPage} />
        </div>
      </div>
    </div>
  );
}
