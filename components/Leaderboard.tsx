"use client";

import { useEffect, useMemo, useState } from "react";
import { classIcon, raceIcon, specIcon } from "@/lib/icons";
import type { ActivityPlayer, Bracket } from "@/lib/types";

type Mode = "ladder" | "activity";

const titleIcon: Record<string, string> = {
  rank1: "https://wow.zamimg.com/images/wow/icons/large/achievement_arena_2v2_7.jpg",
  gladiator: "https://wow.zamimg.com/images/wow/icons/large/achievement_arena_2v2_6.jpg",
  duelist: "https://wow.zamimg.com/images/wow/icons/large/achievement_arena_2v2_5.jpg",
  rival: "https://wow.zamimg.com/images/wow/icons/large/achievement_arena_2v2_4.jpg",
  challenger: "https://wow.zamimg.com/images/wow/icons/large/achievement_arena_2v2_3.jpg",
};

function titleColor(tier: string) {
  if (tier === "rank1") return "text-yellow-300";
  if (tier === "gladiator") return "text-purple-300";
  if (tier === "duelist") return "text-cyan-300";
  if (tier === "rival") return "text-blue-300";
  if (tier === "challenger") return "text-green-300";
  return "text-orange-400";
}

function deltaClass(value: number) {
  if (value > 0) return "text-green-400";
  if (value < 0) return "text-red-500";
  return "text-zinc-300";
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

function shortTzName(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).formatToParts(date);

  return parts.find((p) => p.type === "timeZoneName")?.value || "ET";
}

function formatEstTimestamp(ts: string | null, options?: { blankIfNull?: boolean }) {
  if (!ts) return options?.blankIfNull ? "—" : "-";

  const date = new Date(ts);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  const tz = shortTzName(date);

  if (diffHours > 24) {
    return date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
      day: "numeric",
    });
  }

  const formatted = date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${formatted} ${tz}`;
}

function RatingDelta({ value }: { value: number }) {
  if (!value) return null;

  return (
    <span
      className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-black ${
        value > 0 ? "bg-green-950 text-green-400" : "bg-red-950 text-red-400"
      }`}
    >
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

function RecordDelta({ winsDelta, lossesDelta }: { winsDelta: number; lossesDelta: number }) {
  if (!winsDelta && !lossesDelta) return null;

  return (
    <span className="ml-2 whitespace-nowrap text-[11px]">
      {winsDelta > 0 && <span className="text-green-400">▲{winsDelta}W</span>}
      {winsDelta > 0 && lossesDelta > 0 && <span className="text-zinc-600"> / </span>}
      {lossesDelta > 0 && <span className="text-red-400">▼{lossesDelta}L</span>}
    </span>
  );
}

function RankDelta({ value }: { value: number }) {
  if (!value) return null;

  return (
    <span
      className={`ml-1 rounded px-1 py-0.5 text-[10px] font-bold ${
        value > 0 ? "bg-green-950 text-green-400" : "bg-red-950 text-red-400"
      }`}
    >
      {value > 0 ? `▲${value}` : `▼${Math.abs(value)}`}
    </span>
  );
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
      <button onClick={() => setPage(1)} disabled={page <= 1} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-30">
        {"<<"}
      </button>
      <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-30">
        {"<"}
      </button>
      <span className="px-2 font-semibold">Page {page} of {totalPages}</span>
      <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="rounded border border-orange-500 px-2 py-1 disabled:opacity-30">
        {">"}
      </button>
      <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="rounded border border-orange-500 px-2 py-1 disabled:opacity-30">
        {">>"}
      </button>
    </div>
  );
}

function PlayerRow({ player, mode }: { player: ActivityPlayer & any; mode: Mode }) {
  return (
    <tr className="group border-b border-zinc-900 hover:bg-zinc-900">
      <td className="px-3 py-1.5">
        {player.titleTier && player.titleTier !== "none" ? (
          <IconBox src={titleIcon[player.titleTier]} title={player.title || ""} />
        ) : (
          <span className="text-zinc-700">—</span>
        )}
      </td>

      <td className={`px-3 py-1.5 font-bold whitespace-nowrap ${titleColor(player.titleTier)}`}>
        #{player.rank ?? "-"}
        <RankDelta value={player.rankDelta || 0} />
      </td>

      <td className="px-3 py-1.5">
        <div className="flex gap-1">
          <IconBox src={classIcon[player.className] || classIcon.Unknown} title={player.className} />
          <IconBox src={specIcon[player.spec] || specIcon.Unknown} title={`${player.spec} ${player.className}`} />
          <IconBox src={raceIcon[player.race] || raceIcon.Unknown} title={player.race} />
        </div>
      </td>

      <td className="px-3 py-1.5">
        <div className={`text-sm font-semibold ${nameClass(player.className)}`}>{player.name}</div>
        <div className="text-[11px] text-zinc-500">
          {player.className !== "Unknown" || player.race !== "Unknown"
            ? `${player.race} ${player.spec} ${player.className}`
            : "Unknown"}
        </div>
      </td>

      <td className={`px-3 py-1.5 text-sm font-semibold ${factionRealmClass(player.faction)}`}>
        {player.realm}
      </td>

      <td className="px-3 py-1.5 text-sm whitespace-nowrap">
        <span className="text-green-400">{player.wins}</span>
        <span className="text-zinc-500"> - </span>
        <span className="text-red-400">{player.losses}</span>
        {mode === "activity" && (
          <RecordDelta winsDelta={player.winsDelta || 0} lossesDelta={player.lossesDelta || 0} />
        )}
      </td>

      <td className="px-3 py-1.5 text-sm font-semibold whitespace-nowrap">
        {player.rating}
        {mode === "activity" && <RatingDelta value={player.ratingDelta || 0} />}
      </td>

      <td className="px-3 py-1.5 text-sm whitespace-nowrap text-zinc-300">
        {formatEstTimestamp(player.lastDetectedAt || null, { blankIfNull: true })}
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
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [cutoffs, setCutoffs] = useState<any>(null);
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

    const res = await fetch(`/api/activity?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();

    setPlayers(data.items || []);
    setTotalPages(data.totalPages || 1);
    setRefreshedAt(data.refreshedAt || null);
    setCutoffs(data.cutoffs || null);
    setLoading(false);
  }

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bracket, minRating]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

            <p className="mt-1 text-xs text-zinc-500">
              Data refreshed at <span className="font-semibold text-zinc-300">{formatEstTimestamp(refreshedAt, { blankIfNull: true })}</span>
            </p>

            {cutoffs && (
              <p className="mt-1 text-xs text-zinc-500">
                Cutoffs: R1 #{cutoffs.rank_one_cutoff} · Glad #{cutoffs.gladiator_cutoff} · Duelist #{cutoffs.duelist_cutoff} · Rival #{cutoffs.rival_cutoff}
              </p>
            )}
          </div>

          <button onClick={() => load(page)} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["ladder", "activity"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-4 py-3 text-lg font-black uppercase transition ${
                mode === m ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
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
                  bracket === b ? "bg-green-800 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
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
            placeholder="Search player, realm, race, class, spec, title..."
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
          <div className="flex items-center justify-between border-b border-zinc-900 px-3 py-2">
            <div className="font-bold">SHOWING {shown.length} / PAGE {page}</div>
            <div className="text-xs text-zinc-400">
              {mode === "activity" ? "Activity = rating or W/L changed in previous 12h, sorted by rating" : "Ladder = current ranked list"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-[11px] uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Icons</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Realm</th>
                  <th className="px-3 py-2">W/L</th>
                  <th className="px-3 py-2">Rating</th>
                  <th className="px-3 py-2">Last Detected</th>
                </tr>
              </thead>

              <tbody>
                {shown.map((p) => (
                  <PlayerRow key={p.bracket + p.playerId + p.lastDetectedAt} player={p} mode={mode} />
                ))}

                {!loading && shown.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-zinc-500">
                      {mode === "activity"
                        ? "No recent activity yet. Activity appears after a poll detects rating or W/L changes."
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
