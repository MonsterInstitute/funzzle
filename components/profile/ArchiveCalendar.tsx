"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { GameGlyph } from "@/components/kit/Icons";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getDayStatus, shiftDay } from "@/lib/games/kit/daily";
import { readJson } from "@/lib/games/kit/storage";

/** First day with daily puzzles in the archive. */
export const ARCHIVE_START = "2026-10-01";

/**
 * Games with a playable archive (/play/<game>?date=…, app/api/daily-puzzle)
 * and the localStorage keys their finished archive/daily puzzles use, for the
 * "solved" marks. Add a game here when it gains an archive.
 */
const ARCHIVE_GAMES: { slug: string; keys: (date: string) => string[] }[] = [
  { slug: "sudoku", keys: (d) => [`fz:sudoku:archive:${d}`, `fz:sudoku:daily:${d}`] },
  { slug: "solitaire", keys: (d) => [`fz:solitaire:archive:daily1:${d}`, `fz:solitaire:archive:daily3:${d}`, `fz:solitaire:daily1:${d}`, `fz:solitaire:daily3:${d}`] },
  { slug: "spider-solitaire", keys: (d) => [`fz:spider-solitaire:archive:daily1:${d}`, `fz:spider-solitaire:daily1:${d}`] },
  { slug: "freecell", keys: (d) => [`fz:freecell:archive:${d}`, `fz:freecell:daily:${d}`] },
  { slug: "minesweeper", keys: (d) => [`fz:minesweeper:archive:${d}`, `fz:minesweeper:daily:${d}`] },
  { slug: "mahjong", keys: (d) => [`fz:mahjong:archive:${d}`, `fz:mahjong:daily:${d}`] },
];

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const subscribe = () => () => {};
const today = () => new Date().toISOString().slice(0, 10);

function solved(slug: string, keys: string[], date: string): boolean {
  if (getDayStatus(date)[slug]?.state === "done") return true;
  return keys.some((k) => !!readJson<{ done?: unknown } | null>(k, null)?.done);
}

function DayGames({ date, isToday }: { date: string; isToday: boolean }) {
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-line p-4">
      <span className="text-[15px] font-semibold">{isToday ? `Today · ${label}` : label}</span>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 p-0">
        {ARCHIVE_GAMES.map(({ slug, keys }) => {
          const game = GAME_BY_SLUG[slug];
          if (!game?.href) return null;
          const done = solved(slug, keys(date), date);
          return (
            <li key={slug}>
              <Link
                href={isToday ? game.href : `${game.href}?date=${date}`}
                className="flex min-h-12 items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-semibold text-[#111111] no-underline"
                style={done ? { background: game.color } : { border: `2px solid ${game.color}` }}
                aria-label={`${game.name}, ${label}${done ? ", solved" : ""}`}
              >
                <span className="scale-75">
                  <GameGlyph path={game.glyph} />
                </span>
                <span className={done ? "" : "text-ink"}>{game.name}</span>
                {done && <span className="ml-auto text-xs">✓</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Month grids from ARCHIVE_START to today, newest first; pick a day to see its puzzles. */
export default function ArchiveCalendar() {
  const now = useSyncExternalStore(subscribe, today, () => null);
  const [picked, setPicked] = useState<string | null>(null);
  if (!now) return <p className="text-muted">Loading the calendar…</p>;
  const selected = picked ?? now;
  const months: string[] = [];
  for (let m = now.slice(0, 7); m >= ARCHIVE_START.slice(0, 7); ) {
    months.push(m);
    const d = new Date(`${m}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    m = d.toISOString().slice(0, 7);
  }
  return (
    <div className="flex flex-col gap-10">
      <DayGames date={selected} isToday={selected === now} />
      {months.map((month) => {
        const first = `${month}-01`;
        const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
        const days: string[] = [];
        for (let d = first; d.startsWith(month); d = shiftDay(d, 1)) days.push(d);
        return (
          <section key={month} aria-label={month} className="flex flex-col gap-3">
            <h2 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">
              {new Date(`${first}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
            </h2>
            <div className="grid grid-cols-7 gap-1.5">
              {DOW.map((d) => (
                <span key={d} className="text-center font-mono text-xs text-muted-2">
                  {d}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {days.map((d) => {
                const open = d >= ARCHIVE_START && d <= now;
                const count = open ? ARCHIVE_GAMES.filter(({ slug, keys }) => solved(slug, keys(d), d)).length : 0;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!open}
                    aria-pressed={d === selected}
                    onClick={() => setPicked(d)}
                    className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold disabled:opacity-40 ${
                      d === selected ? "bg-ink text-ground" : d === now ? "bg-violet-tint" : "bg-soft"
                    }`}
                  >
                    {Number(d.slice(8))}
                    {count > 0 && <span className="font-mono text-[10px]">{count}✓</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
