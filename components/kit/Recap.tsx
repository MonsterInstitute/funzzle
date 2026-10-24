"use client";

import { useState, type ReactNode } from "react";
import AdSlot from "@/components/ads/AdSlot";
import { nextWithBreak } from "@/lib/ads/placements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { DAILY_SET, getDayStatus, getStreak, utcToday } from "@/lib/games/kit/daily";
import { formatTime, type DayStats } from "@/lib/games/kit/results";
import { snapshot, useLocal } from "@/lib/games/kit/useLocal";
import ChallengePanel, { type ChallengeInfo } from "./ChallengePanel";
import { Icon } from "./Icons";

export interface RecapTile {
  label: string;
  value: string;
  note: string;
  good?: boolean;
}

export interface RecapProps {
  game: string;
  heading: string;
  /** "Solved." / "Won." */
  title: string;
  timeMs: number;
  /** Share of today's players beaten; null = first finisher; undefined = practice / still loading. */
  percentile?: number | null;
  stats?: DayStats | null;
  loadingStats?: boolean;
  tiles: RecapTile[];
  coach: { keyMove: ReactNode; nextSkill: ReactNode; learn?: { title: string; body: ReactNode } };
  share: { imageUrl: string; text: string };
  onClose: () => void;
  extraActions?: ReactNode;
  /** Friend challenge for this puzzle (omit for games without comparable results). */
  challenge?: ChallengeInfo;
  /** Big number under the title instead of the time (score games: "142 points"). */
  value?: string;
  /** Rank line prefix instead of "Faster than" (score games: "Scored higher than"). */
  beatText?: string;
  /** Replaces the default "Faster than N% …" line (games ranked by more than time, or a loss). */
  rankLine?: string;
  /** Game-specific block under the stat tiles (Groups: groups in solve order; Word Hunt: words in the order found). */
  details?: ReactNode;
  /** Rank wording: "Faster" (default) or "Better" for games ranked by moves first (Funzzle Word). */
  rankWord?: string;
}

const SET_LABEL: Record<string, string> = { sudoku: "Sudoku", solitaire: "Solitaire", word: "Word", "mini-crossword": "Mini" };
const SET_NAME: Record<string, string> = { sudoku: "Daily Sudoku", solitaire: "Daily Solitaire", word: "Daily Word", "mini-crossword": "Mini Crossword" };

const readSet = snapshot(() => ({ day: getDayStatus(utcToday()), streak: getStreak().current }));

/** Which histogram bucket a time falls in, matching daily_result_stats (width_bucket). */
function bucketOf(ms: number, stats: DayStats): number {
  const n = stats.buckets.length;
  const b = Math.floor(((ms - stats.lo) / (stats.hi - stats.lo)) * n);
  return Math.min(n - 1, Math.max(0, b));
}

/**
 * Completion recap (design/Recap.dc.html): time and rank against today's
 * players, stats, the coach's recap, Daily Set progress, sharing, and the one
 * ad placement allowed around play.
 */
export default function Recap(props: RecapProps) {
  const { game, heading, title, timeMs, percentile, stats, loadingStats, tiles, coach, share, onClose } = props;
  const accent = GAME_BY_SLUG[game].color;
  const { day, streak } = useLocal(readSet, { day: {}, streak: 0 });
  const doneCount = DAILY_SET.filter((g) => day[g]?.state === "done").length;
  const next = DAILY_SET.find((g) => day[g]?.state !== "done");
  const [learnOpen, setLearnOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const max = stats ? Math.max(1, ...stats.buckets) : 1;
  const you = stats ? bucketOf(timeMs, stats) : -1;

  const rankLine =
    props.rankLine ??
    (percentile === null
      ? "First to finish today. Nice."
      : percentile !== undefined
        ? `${props.beatText ?? `${props.rankWord ?? "Faster"} than`} ${percentile}% of today’s players`
        : loadingStats
          ? "Comparing with today’s players…"
          : "Practice puzzle");

  async function shareCard() {
    track("share", game, { via: "card" });
    try {
      const res = await fetch(share.imageUrl);
      const file = new File([await res.blob()], `funzzle-${game}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: share.text });
        return;
      }
    } catch {
      // Fall through to opening the image.
    }
    window.open(share.imageUrl, "_blank", "noopener");
  }

  async function copyResult() {
    track("share", game, { via: "copy" });
    try {
      await navigator.clipboard.writeText(share.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your result", share.text);
    }
  }

  return (
    <div data-kit className="min-h-dvh">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3.5 pb-6">
        <div className="flex items-center justify-between px-3 pt-2.5">
          <button type="button" onClick={onClose} aria-label="Close recap" className="flex h-11 w-11 items-center justify-center rounded-full bg-soft-2 text-ink">
            <Icon name="close" />
          </button>
          <h1 className="m-0 text-sm font-semibold">{heading}</h1>
          <button type="button" onClick={shareCard} aria-label="Share result" className="flex h-11 w-11 items-center justify-center rounded-full bg-soft-2 text-ink">
            <Icon name="share" />
          </button>
        </div>

        <section className="mx-4 flex flex-col gap-1.5 rounded-[28px] px-[22px] pb-5 pt-6 text-[#111111]" style={{ background: accent }}>
          <span className="font-display text-[54px] font-extrabold leading-none tracking-[-0.04em]">{title}</span>
          <span className="font-mono text-[60px] font-semibold leading-[1.05] tracking-[-0.03em]">{props.value ?? formatTime(timeMs)}</span>
          <span className="text-base font-semibold">{rankLine}</span>
          {stats && stats.count > 1 && (
            <>
              <div aria-hidden="true" className="mt-3.5 flex h-24 items-end gap-[5px]">
                {stats.buckets.map((n, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-[6px_6px_2px_2px]"
                    style={{ height: `${Math.max(6, (n / max) * 100)}%`, background: i === you ? "#111111" : "rgba(255,255,255,0.72)" }}
                  />
                ))}
              </div>
              <div className="flex justify-between font-mono text-[11px] text-[#1E2A55]">
                <span>{Math.round(stats.lo / 60000)} min</span>
                <span>You</span>
                <span>{Math.round(stats.hi / 60000)} min+</span>
              </div>
              <span className="sr-only">{stats.count} players finished today.</span>
            </>
          )}
        </section>

        <div className="mx-4 grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col gap-1 rounded-[18px] bg-soft px-3 py-3.5">
              <span className="text-xs text-muted">{t.label}</span>
              <span className="font-display text-[28px] font-extrabold tracking-[-0.02em]">{t.value}</span>
              <span className={`text-xs font-semibold ${t.good ? "text-success" : "text-muted"}`}>{t.note}</span>
            </div>
          ))}
        </div>

        {props.details && <div className="mx-4">{props.details}</div>}

        <section aria-label="Coach recap" className="mx-4 flex flex-col gap-2.5 rounded-[20px] border border-coach-line bg-coach-tint px-[18px] py-4">
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-coach text-white">
              <Icon name="coach" size={15} strokeWidth={2.2} />
            </span>
            Coach recap
          </span>
          <p className="m-0 text-[15px] leading-normal">
            <strong>Your key move:</strong> {coach.keyMove}
          </p>
          <div className="h-px bg-coach-line" />
          <p className="m-0 text-[15px] leading-normal">
            <strong>Next skill:</strong> {coach.nextSkill}
          </p>
          {coach.learn && (
            <>
              <button
                type="button"
                onClick={() => setLearnOpen((v) => !v)}
                aria-expanded={learnOpen}
                className="inline-flex min-h-11 items-center self-start rounded-full bg-ink px-4 text-sm font-semibold text-ground"
              >
                {coach.learn.title}
              </button>
              {learnOpen && <div className="text-[15px] leading-normal">{coach.learn.body}</div>}
            </>
          )}
        </section>

        <section className="mx-4 flex flex-col gap-3.5 rounded-[20px] border border-line p-[18px]">
          <div className="flex items-center justify-between">
            <span className="font-display text-xl font-bold tracking-[-0.01em]">
              Daily Set · {doneCount} of {DAILY_SET.length}
            </span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-tint px-2.5 py-1.5 text-[13px] font-semibold text-violet-deep">
                <Icon name="flame" size={14} />
                {streak} day{streak === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {DAILY_SET.map((g) => {
              const done = day[g]?.state === "done";
              return (
                <div
                  key={g}
                  className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-2 text-[#111111]"
                  style={done ? { background: GAME_BY_SLUG[g].color } : { border: `2px dashed ${GAME_BY_SLUG[g].color}` }}
                >
                  <span className={`text-center text-xs font-semibold leading-tight ${done ? "" : "text-ink"}`}>{SET_LABEL[g]}</span>
                  {done && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Done">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
          {next ? (
            <a
              href={GAME_BY_SLUG[next].href ?? "/"}
              onClick={(e) => {
                e.preventDefault();
                nextWithBreak(GAME_BY_SLUG[next].href ?? "/", "next-game");
              }}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-ground no-underline hover:text-ground"
            >
              Next: {SET_NAME[next]}
              <Icon name="arrowRight" />
            </a>
          ) : (
            <span className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-soft text-[15px] font-semibold">Daily Set complete. See you tomorrow</span>
          )}
        </section>

        <div className="mx-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={shareCard} className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-violet text-[15px] font-semibold text-white">
            <Icon name="share" />
            Share card
          </button>
          <button type="button" onClick={copyResult} className="min-h-[52px] rounded-full border border-line-strong bg-ground text-[15px] font-semibold text-ink">
            {copied ? "Copied" : "Copy result"}
          </button>
        </div>
        {props.challenge && <ChallengePanel game={game} info={props.challenge} />}
        {props.extraActions && <div className="mx-4 flex flex-col gap-2">{props.extraActions}</div>}

        <AdSlot slot="rectangle" className="mx-4 mt-1" note="Ads appear between games, never while you play." />
      </div>
    </div>
  );
}
