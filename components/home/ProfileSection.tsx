"use client";

import { allRatings, START_RATING, type Ratings } from "@/lib/games/kit/rating";
import { getStreak } from "@/lib/games/kit/daily";
import { snapshot, useLocal } from "@/lib/games/kit/useLocal";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const RATED = [
  { slug: "sudoku", name: "Sudoku", color: "#9DB4FF" },
  { slug: "solitaire", name: "Solitaire", color: "#7FD6A0" },
];

const readProfile = snapshot(() => ({ streak: getStreak(), ratings: allRatings() }));
const EMPTY = {
  streak: { current: 0, best: 0, week: Array(7).fill("future") as ("done" | "today" | "open" | "future")[] },
  ratings: {} as Ratings,
};

function dot(state: string) {
  if (state === "done") return "h-7 w-7 rounded-full bg-violet";
  if (state === "today") return "h-6 w-6 rounded-full border-2 border-dashed border-violet bg-violet-tint";
  return "h-7 w-7 rounded-full bg-soft-2";
}

export default function ProfileSection() {
  const { streak, ratings } = useLocal(readProfile, EMPTY);

  return (
    <section id="how" className="mx-auto flex max-w-[1280px] scroll-mt-4 flex-col gap-6 px-4 py-[72px] sm:px-8">
      <h2 className="m-0 font-display text-[34px] font-extrabold tracking-[-0.03em] sm:text-[42px]">Your puzzle profile</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        <div className="flex flex-col gap-3.5 rounded-[22px] border border-line p-[22px]">
          <span className="text-[15px] font-semibold">This week</span>
          <div className="grid grid-cols-7 gap-2">
            {streak.week.map((state, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={dot(state)} aria-label={state === "done" ? "Played" : undefined} />
                <span className="font-mono text-xs text-muted-2">{DAYS[i]}</span>
              </div>
            ))}
          </div>
          <span className="text-sm text-muted">
            {streak.current ? `${streak.current}-day streak · best ${streak.best}` : "Finish any Daily Set puzzle to start a streak"}
          </span>
        </div>
        {RATED.map((g) => {
          const r = ratings[g.slug];
          const value = r?.rating ?? START_RATING;
          const last = r?.history.at(-1)?.delta;
          return (
            <div key={g.slug} className="flex flex-col gap-2.5 rounded-[22px] border border-line p-[22px]">
              <span className="text-[15px] font-semibold">{g.name} rating</span>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-[44px] font-extrabold tracking-[-0.03em]">{value.toLocaleString("en-US")}</span>
                {last !== undefined && (
                  <span className={`text-sm font-semibold ${last >= 0 ? "text-success" : "text-card-red"}`}>
                    {last >= 0 ? "+" : ""}
                    {last} last game
                  </span>
                )}
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded bg-soft-2">
                <div className="h-2 rounded" style={{ background: g.color, width: `${Math.min(100, Math.max(4, ((value % 100) / 100) * 100))}%` }} />
              </div>
              <span className="text-sm text-muted">
                {r ? `${r.games} rated game${r.games === 1 ? "" : "s"} · next level at ${(Math.floor(value / 100) + 1) * 100}` : "Play a daily puzzle to get rated"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="m-0 max-w-[760px] text-[15px] leading-relaxed text-muted">
        <strong className="text-ink">How rankings work.</strong> Everyone plays the same daily puzzles, so your time is compared with today’s
        players. Your Funzzle Rating starts at 1,200 and moves after every daily puzzle, more for hard puzzles, fast solves and solving without hints.
        Your profile stays on this device; no account needed.
      </p>
    </section>
  );
}
