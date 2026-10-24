"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getDayStatus, shiftDay } from "@/lib/games/kit/daily";
import { readJson } from "@/lib/games/kit/storage";

/** First day with a daily Sudoku and Solitaire. */
export const ARCHIVE_START = "2026-10-01";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const subscribe = () => () => {};
const today = () => new Date().toISOString().slice(0, 10);

function doneOn(date: string, game: "sudoku" | "solitaire", isToday: boolean): boolean {
  if (isToday) return getDayStatus(date)[game]?.state === "done";
  const keys = game === "sudoku" ? [`fz:sudoku:archive:${date}`] : [`fz:solitaire:archive:daily1:${date}`, `fz:solitaire:archive:daily3:${date}`];
  return keys.some((k) => !!readJson<{ done?: unknown } | null>(k, null)?.done) || getDayStatus(date)[game]?.state === "done";
}

/** Month grids from ARCHIVE_START to today, newest first; every past day is playable. */
export default function ArchiveCalendar() {
  const now = useSyncExternalStore(subscribe, today, () => null);
  if (!now) return <p className="text-muted">Loading the calendar…</p>;
  const months: string[] = [];
  for (let m = now.slice(0, 7); m >= ARCHIVE_START.slice(0, 7); ) {
    months.push(m);
    const d = new Date(`${m}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    m = d.toISOString().slice(0, 7);
  }
  return (
    <div className="flex flex-col gap-10">
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
                const day = Number(d.slice(8));
                const open = d >= ARCHIVE_START && d <= now;
                const isToday = d === now;
                if (!open) {
                  return (
                    <span key={d} className="flex min-h-[64px] items-start justify-center rounded-xl p-1.5 text-sm text-muted-2 opacity-50">
                      {day}
                    </span>
                  );
                }
                const sudoku = doneOn(d, "sudoku", isToday);
                const solitaire = doneOn(d, "solitaire", isToday);
                const q = isToday ? "" : `?date=${d}`;
                return (
                  <div key={d} className={`flex min-h-[64px] flex-col gap-1 rounded-xl p-1.5 ${isToday ? "bg-violet-tint" : "bg-soft"}`}>
                    <span className="text-center text-sm font-semibold">{day}</span>
                    <Link
                      href={`/play/sudoku${q}`}
                      aria-label={`Sudoku, ${d}${sudoku ? ", solved" : ""}`}
                      className="rounded-md px-1 py-0.5 text-center text-[11px] font-semibold text-[#111111] no-underline"
                      style={{ background: sudoku ? "#9DB4FF" : "transparent", border: "1px solid #9DB4FF" }}
                    >
                      Sudoku
                    </Link>
                    <Link
                      href={`/play/solitaire${q}`}
                      aria-label={`Solitaire, ${d}${solitaire ? ", won" : ""}`}
                      className="rounded-md px-1 py-0.5 text-center text-[11px] font-semibold text-[#111111] no-underline"
                      style={{ background: solitaire ? "#7FD6A0" : "transparent", border: "1px solid #7FD6A0" }}
                    >
                      Cards
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
