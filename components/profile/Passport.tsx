"use client";

import Link from "next/link";
import { GameGlyph } from "@/components/kit/Icons";
import { GAMES } from "@/lib/games/kit/catalog";
import { nextToTry, triedGames } from "@/lib/games/kit/passport";
import { snapshot, useLocal } from "@/lib/games/kit/useLocal";

const read = snapshot(() => ({ tried: triedGames(), next: nextToTry()?.slug ?? null }));

/** Game passport: the 20 games, stamped once tried, with a nudge to the next. */
export default function Passport() {
  const { tried, next } = useLocal(read, { tried: {} as Record<string, string>, next: null as string | null });
  const count = Object.keys(tried).length;
  const nextGame = GAMES.find((g) => g.slug === next);
  return (
    <section aria-labelledby="passport-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="passport-title" className="m-0 font-display text-[28px] font-extrabold tracking-[-0.02em]">
          Game passport
        </h2>
        <span className="font-mono text-sm text-muted-2">
          {count} of {GAMES.length} stamped
        </span>
      </div>
      {nextGame && (
        <Link
          href={nextGame.href!}
          className="flex items-center justify-between gap-3 rounded-[22px] p-4 text-[#111111] no-underline"
          style={{ background: nextGame.color }}
        >
          <span className="flex items-center gap-3">
            <GameGlyph path={nextGame.glyph} />
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.06em]">Next stamp</span>
              <span className="font-display text-xl font-bold">{nextGame.name}</span>
            </span>
          </span>
          <span className="rounded-full bg-[#111111] px-4 py-2 text-sm font-semibold text-white">Try it</span>
        </Link>
      )}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5 p-0">
        {GAMES.map((g) => {
          const stamped = !!tried[g.slug];
          const body = (
            <span
              className="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center text-[#111111]"
              style={stamped ? { background: g.color } : { border: `2px dashed ${g.color}` }}
            >
              <span className={stamped ? "" : "opacity-50"}>
                <GameGlyph path={g.glyph} />
              </span>
              <span className={`text-xs font-semibold leading-tight ${stamped ? "" : "text-ink"}`}>{g.name}</span>
              {!g.href && <span className="font-mono text-[10px] uppercase text-muted-2">Soon</span>}
            </span>
          );
          return (
            <li key={g.slug} aria-label={`${g.name}: ${stamped ? "tried" : "not tried yet"}`}>
              {g.href ? (
                <Link href={g.href} className="block no-underline">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
