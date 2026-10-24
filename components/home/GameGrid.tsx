"use client";

import Link from "next/link";
import { useState } from "react";
import { GameGlyph } from "@/components/kit/Icons";
import { CATEGORIES, GAMES, type GameCategory } from "@/lib/games/kit/catalog";

const TAG = "rounded-full bg-white/60 px-[9px] py-[5px] font-mono text-[11px] uppercase tracking-[0.06em] text-[#111111]";

export default function GameGrid() {
  const [filter, setFilter] = useState<GameCategory | "All">("All");
  const shown = filter === "All" ? GAMES : GAMES.filter((g) => g.category === filter);
  const filters: { label: string; value: GameCategory | "All"; count: number }[] = [
    { label: "All", value: "All", count: GAMES.length },
    ...CATEGORIES.map((c) => ({ label: c, value: c, count: GAMES.filter((g) => g.category === c).length })),
  ];

  return (
    <section id="games" className="mx-auto flex max-w-[1280px] scroll-mt-4 flex-col gap-6 px-4 pb-[72px] sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 font-display text-[36px] font-extrabold tracking-[-0.03em] sm:text-[46px]">20 games. Free. Every day.</h2>
          <p className="m-0 text-[17px] text-muted">Each one has a daily challenge, a coach, and a rating that grows with you.</p>
        </div>
        <div role="group" aria-label="Filter games" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                filter === f.value ? "border-ink bg-ink text-ground" : "border-line-strong bg-ground text-ink"
              }`}
            >
              {f.label} {f.count}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(228px,1fr))]">
        {shown.map((g) => {
          const body = (
            <>
              <div className="flex items-start justify-between">
                <GameGlyph path={g.glyph} size={40} />
                <span className={TAG}>{g.href ? g.category : "Soon"}</span>
              </div>
              <span className="mt-2 font-display text-[23px] font-bold tracking-[-0.02em]">{g.name}</span>
              <span className="text-sm leading-[1.45] text-[#1E1E26]">{g.description}</span>
            </>
          );
          const cls = "flex min-h-[184px] flex-col gap-2 rounded-3xl p-5 text-[#111111] no-underline";
          return g.href ? (
            <Link key={g.slug} href={g.href} className={`${cls} transition-transform hover:-translate-y-0.5 hover:text-[#111111]`} style={{ background: g.color }}>
              {body}
            </Link>
          ) : (
            <div key={g.slug} className={cls} style={{ background: g.color }} aria-label={`${g.name}, coming soon`}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
