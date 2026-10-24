"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { GENIUS, GREAT, hintGrid, hiveHint, missedPattern, rankThresholds, RANKS, TOP, type HiveHint, type HivePuzzle } from "@/lib/games/hive";
import { SPELLING_HIVE_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { answersFound, bonusFound, initialState, MAX_HINTS, missed, pangramsFound, rank, reducer, score, shuffled, type HiveState } from "./state";

/**
 * Spelling Hive (design: Game Kit, like components/sudoku/SudokuGame).
 *
 * When a daily ends: the result is submitted when the player taps "Finish for
 * today" (any time after their first scoring word) or automatically on
 * reaching Hive Master (every answer found). Reaching Genius prompts them to
 * finish or keep going. The finished score and rank are what the recap, share
 * card, challenge and today's ranking show; results rank by score, then time.
 * After finishing, the hive is read-only.
 */

interface Saved {
  key: string;
  /** archive = a past day's daily puzzle (/archive): unranked. */
  mode: "daily" | "practice" | "archive";
  date?: string;
  challengeId?: string;
  /** Practice seed id (the API's ?practice=), or the daily seed. */
  seed: string;
  state: HiveState;
  elapsed: number;
  done?: Finish;
}

interface Finish {
  timeMs: number;
  score: number;
  rank: number;
  percentile?: number | null;
  ratingDelta: number;
  rating: number;
  streak: number;
}

const SLUG = "spelling-hive";
const GAME = GAME_BY_SLUG[SLUG];
const DAILY_KEY = (date: string) => `fz:${SLUG}:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:${SLUG}:archive:${date}`;
const PRACTICE_KEY = `fz:${SLUG}:practice`;

type Coach = { hint: HiveHint; rung: 1 | 2 | 3 };

async function fetchPuzzle(query: string): Promise<HivePuzzle> {
  const res = await fetch(`/api/daily-puzzle?game=${SLUG}&${query}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`puzzle ${res.status}`);
  return (await res.json()) as HivePuzzle;
}

export default function HiveGame({ date, daily }: { date: string; daily: HivePuzzle }) {
  const dailyKey = `${date}:${daily.center}${daily.outer}`;
  const fresh = (): Saved => ({ key: dailyKey, mode: "daily", seed: `${SLUG}:${date}`, state: initialState(daily), elapsed: 0 });
  const [game, setGame] = useState<Saved>(fresh);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    let job: Promise<unknown> | null = null;
    if (want) {
      history.replaceState(null, "", location.pathname);
      job = startPractice();
    } else if (challengeId) {
      job = fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== SLUG) throw new Error("not a hive challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed, challengeId);
          if (p.date === date) return openDaily(challengeId);
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily());
    } else if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      job = openArchive(archiveDate);
    } else {
      openDaily();
    }
    if (job) {
      job.finally(() => setLoaded(true));
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage / URL
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [date, dailyKey]);

  function openDaily(challengeId?: string) {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    if (saved && saved.key === dailyKey) setGame(challengeId ? { ...saved, challengeId } : saved);
    else if (challengeId) setGame((g) => ({ ...g, challengeId }));
  }

  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setGame(saved);
    try {
      const p = await fetchPuzzle(`date=${day}`);
      setGame({ key: `archive:${day}`, mode: "archive", date: day, challengeId, seed: `${SLUG}:${day}`, state: initialState(p), elapsed: 0 });
    } catch {
      openDaily();
    }
  }

  async function openPractice(seed: string, challengeId: string) {
    const p = await fetchPuzzle(`practice=${encodeURIComponent(seed)}`);
    setGame({ key: `${seed}:${challengeId}`, mode: "practice", seed, challengeId, state: initialState(p), elapsed: 0 });
  }

  async function startPractice() {
    setBusy(true);
    try {
      const seed = crypto.randomUUID();
      const p = await fetchPuzzle(`practice=${seed}`);
      countPractice(SLUG);
      const next: Saved = { key: seed, mode: "practice", seed, state: initialState(p), elapsed: 0 };
      writeJson(PRACTICE_KEY, next);
      setGame(next);
    } catch {
      // Offline or the API is down: stay on the current hive.
    } finally {
      setBusy(false);
    }
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else void startPractice();
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey ? saved : fresh());
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Board key={game.key} game={game} date={game.date ?? date} busy={busy} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

function Board({
  game,
  date,
  inert = false,
  busy = false,
  onPractice,
  onResumePractice,
  onDaily,
}: {
  game: Saved;
  date: string;
  inert?: boolean;
  busy?: boolean;
  onPractice?: () => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer(reducer, game.state);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [panel, setPanel] = useState<"none" | "words" | "grid">("none");
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer(`${SLUG}-extra-hint`, SLUG, outOfHints && !finish && !inert);
  const pts = score(state);
  const r = rank(state);
  const complete = finishing || r === TOP;
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  const rating = getRating(SLUG).rating;
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? "Practice hive"
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}`;
  const locked = !!finish || complete || inert;

  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer.now is read on purpose without re-running every tick
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", SLUG, { mode: game.mode });
  }, [inert, finish, game.mode]);

  // Finish: tapped "Finish for today", or every word found.
  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const found = answersFound(state);
    const won = r >= GREAT;
    track("game_complete", SLUG, { mode: game.mode, timeMs, score: pts, rank: RANKS[r].name, words: found.length, hints: state.hints });
    const finalize = (percentile?: number | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      const { rating: rt, delta } =
        game.mode === "archive"
          ? { rating: getRating(SLUG).rating, delta: 0 }
          : recordMatch(SLUG, key, { puzzleRating: SPELLING_HIVE_PUZZLE_RATING, won, percentile: percentile ?? undefined, hints: state.hints, mistakes: 0 });
      const skills = [
        pangramsFound(state).length ? "pangram" : "",
        r >= GREAT ? "great" : "",
        found.some((w) => w.length >= 8) ? "long-word" : "",
        r >= GENIUS ? "genius" : "",
        r >= GENIUS && !state.hints ? "unaided-genius" : "",
        r === TOP ? "hive-master" : "",
      ].filter(Boolean);
      recordFinish(SLUG, { won, timeMs, hints: state.hints, level: RANKS[r].name, skills });
      setFinish({ timeMs, score: pts, rank: r, percentile, ratingDelta: delta, rating: rt, streak: getStreak().current });
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- completion is detected from state
    setShowRecap(true);
    setCoach(null);
    if (game.mode === "daily") {
      submitResult({ game: SLUG, date, timeMs, mistakes: state.mistakes, hints: state.hints, moves: pts }).then((res) => finalize(res ? res.percentile : undefined));
    } else {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const at = () => Math.round(timer.now());
  const submit = () => {
    if (locked) return;
    dispatch({ type: "submit", at: at() });
  };

  const openHint = () => {
    if (locked || coach || outOfHints) return;
    const hint = hiveHint(state.puzzle, state.found);
    if (!hint) return;
    dispatch({ type: "hint-used" });
    track("hint_used", SLUG, { mode: game.mode, pangram: hint.pangram });
    setCoach({ hint, rung: 1 });
  };

  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  // A word the coach is pointing at may get found by the player meanwhile.
  useEffect(() => {
    if (coach && coach.rung < 3 && state.found.includes(coach.hint.word)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the hint is spent
      setCoach(null);
    }
  }, [coach, state.found]);

  // Keyboard: letters type, Backspace deletes, Enter submits, Space shuffles.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap || confirmFinish || locked) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        dispatch({ type: "type", letter: e.key });
      } else if (e.key === "Backspace") {
        e.preventDefault();
        dispatch({ type: "delete" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === " ") {
        e.preventDefault();
        dispatch({ type: "shuffle", order: shuffled(state.order) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <HiveRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">{RANKS[r].name}! Comparing with today’s players…</p>
      </div>
    );
  }

  const found = answersFound(state);
  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const thresholds = rankThresholds(state.puzzle.maxScore);
  const nextAt = r < TOP ? thresholds[r + 1] : null;
  const finishLabel = game.mode === "daily" ? "Finish for today" : "Finish this hive";

  return (
    <GameShell
      tint={GAME.tint}
      title="Spelling Hive"
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>{pts} pts</Chip>
          <Chip>
            {found.length} / {state.puzzle.answers.length} words
          </Chip>
        </>
      }
    >
      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <RankBar score={pts} rank={r} thresholds={thresholds} nextAt={nextAt} />
      </div>

      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <FoundWords state={state} open={panel === "words"} onToggle={() => setPanel((p) => (p === "words" ? "none" : "words"))} />
      </div>

      {r >= GENIUS && r < TOP && !finish && (
        <p className="mx-4 my-0 rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#111111]" style={{ background: GAME.color }}>
          Genius! {game.mode === "daily" ? "Finish for today to lock in your score" : "Finish now"}, or keep going for Hive Master.
        </p>
      )}

      <div className="flex flex-col items-center gap-2 px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <InputLine input={state.input} center={state.puzzle.center} letters={state.puzzle.center + state.puzzle.outer} />
        <Toast message={state.message} />
        <Honeycomb center={state.puzzle.center} order={state.order} disabled={locked} onLetter={(l) => dispatch({ type: "type", letter: l })} />
      </div>

      <div className="grid grid-cols-3 gap-2 px-4">
        <PillButton label="Delete" onClick={() => dispatch({ type: "delete" })} disabled={locked || !state.input} />
        <PillButton label="Shuffle letters" icon="shuffle" onClick={() => dispatch({ type: "shuffle", order: shuffled(state.order) })} disabled={locked} />
        <PillButton label="Enter" onClick={submit} disabled={locked || !state.input} dark />
      </div>

      <div className="px-4">
        {coach ? (
          <HiveCoach
            coach={coach}
            hintsLeft={hintsLeft}
            onMore={() => setCoach({ ...coach, rung: 2 })}
            onAnswer={() => {
              dispatch({ type: "reveal", word: coach.hint.word, at: at() });
              setCoach({ ...coach, rung: 3 });
            }}
            onClose={() => setCoach(null)}
          />
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              hintsLeft && !locked
                ? { label: "Get a hint", onClick: openHint }
                : !locked && bonusOffer.ready
                  ? {
                      label: "Watch an ad for one more hint",
                      onClick: async () => {
                        if (await bonusOffer.watch()) {
                          setBonusHints((b) => b + 1);
                          setHintAfterAd(true);
                        }
                      },
                    }
                  : undefined
            }
            secondary={!locked ? { label: panel === "grid" ? "Hide hints grid" : "Hints grid", onClick: () => setPanel((p) => (p === "grid" ? "none" : "grid")) } : undefined}
          >
            {finish
              ? "Finished. Open the recap to see how you did."
              : hintsLeft
                ? "Stuck? I’ll point you to a word: first where it starts, then its shape, then the word. The hints grid is free."
                : "You’ve used your three hints. The hints grid is still free: it counts the words left by first letter and length."}
          </CoachCard>
        )}
      </div>

      {panel === "grid" && (
        <div className="px-4">
          <HintsGrid puzzle={state.puzzle} found={state.found} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 px-4">
        <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={openHint} disabled={!hintsLeft || !!coach || locked} />
        {finish ? (
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] rounded-[14px] bg-ink text-sm font-semibold text-ground">
            See recap
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmFinish(true)}
            disabled={locked || pts === 0}
            className="min-h-[52px] rounded-[14px] border border-line-strong text-sm font-semibold text-ink disabled:opacity-40"
          >
            {finishLabel}
          </button>
        )}
      </div>

      {confirmFinish && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-label={finishLabel}>
          <div data-kit className="w-full max-w-[520px] rounded-t-[28px] bg-ground p-5 pb-8 sm:rounded-[28px]">
            <h2 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">{finishLabel}?</h2>
            <p className="mb-0 mt-2 text-[15px] text-muted">
              {game.mode === "daily"
                ? `Your ${pts} points (${RANKS[r].name}) will be ranked against today’s players. You can’t add words after finishing.`
                : `You’ll finish this hive at ${pts} points (${RANKS[r].name}).`}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setConfirmFinish(false);
                  setFinishing(true);
                }}
                className="min-h-[52px] w-full rounded-full bg-ink text-base font-semibold text-ground"
              >
                Finish
              </button>
              <SheetButton onClick={() => setConfirmFinish(false)}>Keep playing</SheetButton>
            </div>
          </div>
        </div>
      )}

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          {game.mode === "daily" ? (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice?.();
              }}
            >
              Practice hives
            </SheetButton>
          ) : (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                {busy ? "Loading…" : "New practice hive"}
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Spelling Hive
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function PillButton({ label, onClick, disabled, dark, icon }: { label: string; onClick: () => void; disabled?: boolean; dark?: boolean; icon?: "shuffle" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex min-h-[52px] items-center justify-center rounded-full text-[15px] font-semibold transition-opacity disabled:opacity-40 ${dark ? "bg-ink text-ground" : "border border-line-strong text-ink"}`}
    >
      {icon ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3.5M13 9.5c1-2 2-2.5 4-2.5h3M17 4l3 3-3 3M17 14l3 3-3 3" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}

function RankBar({ score: pts, rank: r, thresholds, nextAt }: { score: number; rank: number; thresholds: number[]; nextAt: number | null }) {
  const max = thresholds[thresholds.length - 1] || 1;
  // The bar runs to Genius; Hive Master sits at the end.
  const genius = thresholds[GENIUS] || 1;
  const pos = (v: number) => Math.min(100, (v / genius) * 92);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-lg font-extrabold">{RANKS[r].name}</span>
        <span className="text-xs text-muted">{nextAt !== null ? `${nextAt - pts} to ${RANKS[r + 1].name}` : "Every word found"}</span>
      </div>
      <div
        className="relative h-3"
        role="meter"
        aria-label="Score"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={pts}
        aria-valuetext={`${pts} points, ${RANKS[r].name}`}
      >
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-line-strong" />
        {thresholds.map((t, i) =>
          i === 0 || i === TOP ? null : (
            <span
              key={i}
              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${pos(t)}%`, background: pts >= t ? "var(--ink)" : "var(--line-strong)" }}
            />
          )
        )}
        <span
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: "100%", background: r === TOP ? "var(--ink)" : "var(--line-strong)" }}
        />
        <span
          className="absolute top-1/2 flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1 font-mono text-[11px] font-semibold text-[#111111]"
          style={{ left: `${r === TOP ? 100 : pos(pts)}%`, background: GAME.color }}
          aria-hidden="true"
        >
          {pts}
        </span>
      </div>
    </div>
  );
}

function FoundWords({ state, open, onToggle }: { state: HiveState; open: boolean; onToggle: () => void }) {
  const found = answersFound(state);
  const bonus = bonusFound(state);
  const pangrams = new Set(pangramsFound(state));
  const recent = [...found].reverse().slice(0, 4);
  return (
    <div className="rounded-[18px] border border-line">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-2 px-3.5 py-2 text-left">
        <span className="min-w-0 truncate text-sm">
          {found.length ? (
            <>
              <strong>{found.length}</strong> word{found.length === 1 ? "" : "s"}
              {!open && <span className="text-muted"> · {recent.map((w) => w.toUpperCase()).join(" ")}</span>}
            </>
          ) : (
            <span className="text-muted">Your words will appear here</span>
          )}
        </span>
        <span aria-hidden="true" className="text-muted">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-3.5 py-3">
          <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-sm sm:grid-cols-3">
            {[...found].sort().map((w) => (
              <li key={w} className={pangrams.has(w) ? "font-bold" : ""}>
                {w.toUpperCase()}
                {state.coached.includes(w) && <span className="ml-1 text-xs text-coach-ink">coach</span>}
              </li>
            ))}
          </ul>
          {bonus.length > 0 && (
            <p className="mb-0 mt-3 text-xs text-muted">
              Bonus words (no points): {[...bonus].sort().map((w) => w.toUpperCase()).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InputLine({ input, center, letters }: { input: string; center: string; letters: string }) {
  return (
    <div aria-live="polite" aria-label={input ? `Word: ${input}` : "Type or tap letters"} className="flex min-h-[44px] items-center justify-center font-display text-[30px] font-bold tracking-[0.04em]">
      {input ? (
        input.split("").map((ch, i) => (
          <span key={i} style={{ color: ch === center ? "#C99700" : letters.includes(ch) ? "var(--ink)" : "var(--muted-2, #9a9aa8)" }}>
            {ch.toUpperCase()}
          </span>
        ))
      ) : (
        <span className="h-8 w-0.5 animate-pulse bg-ink" aria-hidden="true" />
      )}
    </div>
  );
}

function Toast({ message }: { message: HiveState["message"] }) {
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!message) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new message shows for a moment
    setShown(message.id);
    const t = setTimeout(() => setShown(null), 1800);
    return () => clearTimeout(t);
  }, [message]);
  const visible = message && shown === message.id;
  const bg = !message ? "" : message.tone === "bad" ? "bg-soft-2 text-ink" : message.tone === "bonus" ? "bg-violet-tint text-violet-deep" : "text-[#111111]";
  return (
    <div className="flex h-8 items-center" role="status" aria-live="polite">
      {visible && (
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${bg}`} style={message.tone === "good" || message.tone === "pangram" ? { background: GAME.color } : undefined}>
          {message.text}
        </span>
      )}
    </div>
  );
}

/** Seven hexagons: the center letter and six around it (flat-topped). */
function Honeycomb({ center, order, disabled, onLetter }: { center: string; order: string; disabled: boolean; onLetter: (l: string) => void }) {
  const W = 92;
  const H = Math.round(W * 0.866);
  const g = 1.07;
  const offsets: [number, number][] = [
    [0, -H * g],
    [0.75 * W * g, (-H / 2) * g],
    [0.75 * W * g, (H / 2) * g],
    [0, H * g],
    [-0.75 * W * g, (H / 2) * g],
    [-0.75 * W * g, (-H / 2) * g],
  ];
  const width = W + 1.5 * W * g;
  const height = H + 2 * H * g;
  const cells: { letter: string; dx: number; dy: number; isCenter: boolean }[] = [
    { letter: center, dx: 0, dy: 0, isCenter: true },
    ...order.split("").map((letter, i) => ({ letter, dx: offsets[i][0], dy: offsets[i][1], isCenter: false })),
  ];
  return (
    <div role="group" aria-label="Hive letters" className="relative" style={{ width, height }}>
      {cells.map((c) => (
        <button
          key={c.isCenter ? "center" : c.letter}
          type="button"
          disabled={disabled}
          onClick={() => onLetter(c.letter)}
          aria-label={c.isCenter ? `Center letter ${c.letter.toUpperCase()}` : `Letter ${c.letter.toUpperCase()}`}
          className="absolute flex items-center justify-center font-display text-[30px] font-extrabold text-[#111111] transition-transform active:scale-95 disabled:opacity-60"
          style={{
            width: W,
            height: H,
            left: width / 2 - W / 2 + c.dx,
            top: height / 2 - H / 2 + c.dy,
            clipPath: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
            background: c.isCenter ? GAME.color : "color-mix(in srgb, #FFD23F 16%, var(--soft-2, #ececf2))",
            color: c.isCenter ? "#111111" : "var(--ink)",
          }}
        >
          {c.letter.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function HintsGrid({ puzzle, found }: { puzzle: HivePuzzle; found: string[] }) {
  const g = useMemo(() => hintGrid(puzzle, found), [puzzle, found]);
  const pangramsLeft = puzzle.pangrams.filter((w) => !found.includes(w)).length;
  return (
    <section aria-label="Hints grid" className="flex flex-col gap-3 rounded-[18px] border border-line p-3.5">
      <p className="m-0 text-sm text-muted">
        Words left by first letter and length. {pangramsLeft ? `${pangramsLeft} pangram${pangramsLeft === 1 ? "" : "s"} left.` : "Every pangram found."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-sm">
          <thead>
            <tr>
              <th className="px-1.5 py-1 text-left font-semibold" scope="col">
                <span className="sr-only">First letter</span>
              </th>
              {g.lengths.map((l) => (
                <th key={l} scope="col" className="px-1.5 py-1 text-right font-semibold">
                  {l}
                </th>
              ))}
              <th scope="col" className="px-1.5 py-1 text-right font-semibold">
                Σ
              </th>
            </tr>
          </thead>
          <tbody>
            {g.rows.map((row) => (
              <tr key={row.letter} className="border-t border-line">
                <th scope="row" className="px-1.5 py-1 text-left font-bold">
                  {row.letter.toUpperCase()}
                </th>
                {row.counts.map((n, i) => (
                  <td key={i} className={`px-1.5 py-1 text-right ${n ? "" : "text-muted-2"}`}>
                    {n || "-"}
                  </td>
                ))}
                <td className="px-1.5 py-1 text-right font-semibold">{row.total}</td>
              </tr>
            ))}
            <tr className="border-t border-line-strong">
              <th scope="row" className="px-1.5 py-1 text-left font-bold">
                Σ
              </th>
              {g.totals.map((n, i) => (
                <td key={i} className="px-1.5 py-1 text-right font-semibold">
                  {n}
                </td>
              ))}
              <td className="px-1.5 py-1 text-right font-bold">{g.totals.reduce((a, b) => a + b, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="m-0 mb-1.5 text-sm font-semibold">Two-letter starts</h3>
        <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm">
          {g.twoLetter.map((t) => (
            <span key={t.prefix} className={t.left ? "" : "text-muted-2 line-through"}>
              {t.prefix.toUpperCase()}-{t.left}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

function HiveCoach({
  coach,
  hintsLeft,
  onMore,
  onAnswer,
  onClose,
}: {
  coach: Coach;
  hintsLeft: number;
  onMore: () => void;
  onAnswer: () => void;
  onClose: () => void;
}) {
  const { hint, rung } = coach;
  const tag = hint.pangram ? "Pangram" : "Next word";
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }}>
        {hint.nudge}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={{ label: "Show the word", onClick: onAnswer }}>
        <span className="block font-mono text-xl font-semibold tracking-[0.12em]" aria-label={`Pattern: ${hint.patternText}`}>
          {hint.pattern}
        </span>
        <span className="mt-1 block">{hint.patternText}</span>
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: "Got it", onClick: onClose }}>
      {hint.answer} It’s been added to your words.
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this hive.</span>}
    </CoachCard>
  );
}

// ---------------------------------------------------------------------------
// Recap
// ---------------------------------------------------------------------------

function HiveRecap({
  game,
  date,
  state,
  finish,
  onClose,
  onPractice,
}: {
  game: Saved;
  date: string;
  state: HiveState;
  finish: Finish;
  onClose: () => void;
  onPractice?: () => void;
}) {
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const rankName = RANKS[finish.rank].name;
  const found = answersFound(state);

  const coach = useMemo(() => {
    const letters = new Set(state.puzzle.center + state.puzzle.outer);
    const pangrams = pangramsFound(state);
    const own = found.filter((w) => !state.coached.includes(w));
    const value = (w: string) => (w.length === 4 ? 1 : w.length) + ([...letters].every((l) => w.includes(l)) ? 7 : 0);
    const best = [...own].sort((a, b) => value(b) - value(a) || a.localeCompare(b))[0];
    const when = (w: string) => (state.foundAt[w] ? ` at ${formatTime(state.foundAt[w])}` : "");
    let keyMove: string;
    const ownPangram = pangrams.find((w) => !state.coached.includes(w));
    if (ownPangram) keyMove = `you found the pangram ${ownPangram.toUpperCase()}${when(ownPangram)}, worth ${value(ownPangram)} points.`;
    else if (best) keyMove = `your best word was ${best.toUpperCase()}${when(best)}, worth ${value(best)} point${value(best) === 1 ? "" : "s"}.`;
    else keyMove = "the coach found your words this time. Try spotting a few on your own next hive.";
    const left = missed(state);
    const pattern = missedPattern(left);
    let nextSkill: string;
    if (!left.length) nextSkill = "Nothing left to find: you found every word. Try a practice hive for another round.";
    else if (!pangrams.length) nextSkill = `Pangrams. Today’s ${state.puzzle.pangrams.length === 1 ? "was" : "were"} worth 7 bonus points each: look for long words that use every letter.`;
    else if (pattern) nextSkill = `${pattern.label} words: you missed ${pattern.count}. ${pattern.tip}`;
    else nextSkill = `Longer words. You missed ${left.length} word${left.length === 1 ? "" : "s"}; try building on the words you found with new endings.`;
    return {
      keyMove,
      nextSkill,
      learn: left.length
        ? {
            title: `See the ${left.length} word${left.length === 1 ? "" : "s"} you missed`,
            body: (
              <p className="m-0 font-mono text-sm leading-relaxed">
                {left.map((w) => (
                  <span key={w} className={state.puzzle.pangrams.includes(w) ? "font-bold" : ""}>
                    {w.toUpperCase()}{" "}
                  </span>
                ))}
              </p>
            ),
          }
        : undefined,
    };
  }, [state, found]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const imageParams = new URLSearchParams({
    g: SLUG,
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(state.hints),
    sc: String(finish.score),
    w: String(found.length),
    lv: game.mode === "practice" ? `Practice ${rankName}` : rankName,
  });
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle Spelling Hive${game.mode === "practice" ? " practice" : ""} · ${short}`,
    `${rankName} · ${finish.score} points${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${found.length} word${found.length === 1 ? "" : "s"} · ${state.hints} hint${state.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/spelling-hive",
  ].join("\n");

  return (
    <Recap
      game={SLUG}
      heading={game.mode === "practice" ? "Spelling Hive practice" : `Spelling Hive · ${short}${game.mode === "archive" ? " · archive" : ""}`}
      title={`${rankName}.`}
      value={`${finish.score} pts`}
      beatText="Scored higher than"
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={null}
      tiles={[
        { label: "Words", value: String(found.length), note: `of ${state.puzzle.answers.length}`, good: finish.rank === TOP },
        { label: "Hints", value: String(state.hints), note: `of ${MAX_HINTS} used`, good: !state.hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: game.seed, level: "standard" } : { kind: "daily", date },
        label: game.mode === "practice" ? "Spelling Hive practice" : `Spelling Hive · ${short}`,
        result: { timeMs: finish.timeMs, mistakes: state.mistakes, hints: state.hints, moves: finish.score },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game={SLUG} href={`/play/${SLUG}?practice=new`} label="Play a practice hive" />}
    />
  );
}
