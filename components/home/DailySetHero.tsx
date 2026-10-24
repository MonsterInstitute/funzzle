"use client";

import Link from "next/link";
import { GameGlyph, Icon } from "@/components/kit/Icons";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { DAILY_SET, getDayStatus, utcToday, type DailyStatus } from "@/lib/games/kit/daily";
import { formatTime } from "@/lib/games/kit/results";
import { snapshot, useLocal } from "@/lib/games/kit/useLocal";

export interface DailyCardInfo {
  slug: (typeof DAILY_SET)[number];
  name: string;
  /** Shown before the player starts, e.g. "Hard · same grid for everyone". */
  intro: string;
}

const readDay = snapshot(() => getDayStatus(utcToday()));
const EMPTY: Record<string, DailyStatus> = {};

const CHIP = "rounded-full px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em]";

function cardState(card: DailyCardInfo, status: DailyStatus | undefined) {
  if (status?.state === "done") {
    const r = status.result ?? {};
    const parts = [r.label, r.timeMs ? formatTime(r.timeMs) : null, r.percentile !== undefined ? `faster than ${r.percentile}% of today’s players` : null].filter(Boolean);
    return { chip: "Solved", solved: true, meta: parts.join(" · ") || "Done for today", cta: "See recap" };
  }
  if (status?.state === "playing") return { chip: "In play", solved: false, meta: status.meta ?? "Pick up where you left off", cta: "Continue" };
  return { chip: "New", solved: false, meta: card.intro, cta: "Play" };
}

export default function DailySetHero({ dateLabel, cards }: { dateLabel: string; cards: DailyCardInfo[] }) {
  const day = useLocal(readDay, EMPTY);
  const done = cards.filter((c) => day[c.slug]?.state === "done").length;
  const next = cards.find((c) => day[c.slug]?.state === "playing") ?? cards.find((c) => day[c.slug]?.state !== "done");

  return (
    <section id="today" className="mx-auto flex max-w-[1280px] scroll-mt-4 flex-wrap items-stretch gap-12 px-4 pb-12 pt-10 sm:px-8 sm:pt-14">
      <div className="flex min-w-0 flex-[1_1_400px] flex-col justify-center gap-[22px]">
        <p className="m-0 font-mono text-[13px] uppercase tracking-[0.08em] text-muted-2">{dateLabel}</p>
        <h1 className="m-0 font-display text-[56px] font-extrabold leading-[0.92] tracking-[-0.04em] sm:text-[80px]">
          Today’s
          <br />
          Daily Set
        </h1>
        <p className="m-0 max-w-[460px] text-[19px] leading-normal text-muted">
          Four puzzles, one streak. Everyone in the world plays the same ones today. Finish them and see where you rank.
        </p>
        <div className="flex items-center gap-3.5">
          <div aria-hidden="true" className="grid w-[180px] grid-cols-4 gap-1.5">
            {cards.map((c, i) => (
              <div key={c.slug} className={`h-2 rounded ${i < done ? "bg-ink" : "bg-line"}`} />
            ))}
          </div>
          <span className="text-[15px] font-semibold">
            {done} of {cards.length} done
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {next ? (
            <Link
              href={GAME_BY_SLUG[next.slug].href ?? "/"}
              className="inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-ink px-[26px] text-base font-semibold text-ground no-underline hover:text-ground"
            >
              {done || day[next.slug]?.state === "playing" ? "Continue" : "Start"}: {next.name}
              <Icon name="arrowRight" />
            </Link>
          ) : (
            <span className="inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-ink px-[26px] text-base font-semibold text-ground">
              <Icon name="check" /> All four done. See you tomorrow
            </span>
          )}
          <a href="#how" className="inline-flex min-h-[52px] items-center rounded-full border border-line-strong px-[22px] text-base font-semibold text-ink no-underline">
            How rankings work
          </a>
        </div>
      </div>

      <div className="grid min-w-0 flex-[1_1_560px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {cards.map((card) => {
          const game = GAME_BY_SLUG[card.slug];
          const s = cardState(card, day[card.slug]);
          return (
            <article key={card.slug} className="flex min-h-[214px] flex-col gap-2.5 rounded-[26px] p-[22px] text-tile-ink" style={{ background: game.color }}>
              <div className="flex items-start justify-between">
                <GameGlyph path={game.glyph} />
                <span className={`${CHIP} ${s.solved ? "bg-white text-[#111111]" : "bg-[#111111] text-white"}`}>{s.chip}</span>
              </div>
              <h2 className="mb-0 mt-1.5 font-display text-[27px] font-bold tracking-[-0.02em]">{card.name}</h2>
              <p className="m-0 text-sm leading-[1.45] text-[#1E1E26]">{s.meta}</p>
              <Link
                href={game.href ?? "/"}
                className="mt-auto inline-flex min-h-11 items-center self-start rounded-full bg-[#111111] px-[18px] text-sm font-semibold text-white no-underline hover:text-white"
                aria-label={`${s.cta}: ${card.name}`}
              >
                {s.cta}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
