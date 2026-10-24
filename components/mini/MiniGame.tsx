"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import { Icon } from "@/components/kit/Icons";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { MINI_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { bankMiniForSeed, entryLabel, hintLadder, keyMove, layoutOf, type Layout, type MiniLadder, type MiniPuzzle } from "@/lib/games/mini";
import { MASTERY, recordFinish, skillProgress } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak, markDone, setStatus } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import {
  afterType,
  arrow,
  backTarget,
  entryAt,
  entryStart,
  initialState,
  isClean,
  isComplete,
  isFull,
  MAX_HINTS,
  normalize,
  reducer,
  solveOrderMap,
  stepEntry,
  type Cursor,
  type PlayState,
} from "./state";

const SLUG = "mini-crossword";
const GAME = GAME_BY_SLUG[SLUG];
const DAILY_KEY = (date: string) => `fz:${SLUG}:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:${SLUG}:archive:${date}`;
const PRACTICE_KEY = `fz:${SLUG}:practice`;
const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

interface Saved {
  key: string;
  /** archive = a past day's daily puzzle (/archive): unranked, no streak. */
  mode: "daily" | "practice" | "archive";
  /** The archive puzzle's date. */
  date?: string;
  /** Opened from a friend's challenge link (lib/games/kit/challenge.ts). */
  challengeId?: string;
  seed: string;
  puzzle: MiniPuzzle;
  state: PlayState;
  elapsed: number;
  done?: Finish;
}

interface Finish {
  timeMs: number;
  percentile?: number | null;
  stats?: DayStats | null;
  ratingDelta: number;
  rating: number;
  streak: number;
}

type Coach = { ladder: MiniLadder; rung: 1 | 2 | 3 };

const sizeLabel = (n: number) => `${n}×${n}`;
const puzzleOf = (p: MiniPuzzle): MiniPuzzle => ({ size: p.size, rows: p.rows, clues: p.clues });
const fresh = (key: string, mode: Saved["mode"], seed: string, puzzle: MiniPuzzle, extra: Partial<Saved> = {}): Saved => ({
  key,
  mode,
  seed,
  puzzle: puzzleOf(puzzle),
  state: initialState(layoutOf(puzzle.rows).solution),
  elapsed: 0,
  ...extra,
});

export default function MiniGame({ date, daily }: { date: string; daily: MiniPuzzle & { bankId?: string } }) {
  const dailyKey = `${date}:${daily.rows.join("")}`;
  const [game, setGame] = useState<Saved>(() => fresh(dailyKey, "daily", `${SLUG}:${date}`, daily));
  const [loaded, setLoaded] = useState(false);

  // Restore saved progress after hydration (local storage isn't on the server).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // "Play a practice mini" on the recap loads /play/mini?practice=1 as a new
    // page view (components/kit/PracticeAction).
    const practice = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (practice) {
      history.replaceState(null, "", location.pathname);
      startPractice();
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== SLUG) throw new Error("not a mini challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed, challengeId);
          if (p.date === date) return openDaily(challengeId);
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily())
        .finally(() => setLoaded(true));
      return;
    } else if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      openArchive(archiveDate).finally(() => setLoaded(true));
      return;
    } else {
      openDaily();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage / URL
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [date, dailyKey]);

  function openDaily(challengeId?: string) {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    if (saved && saved.key === dailyKey && saved.puzzle) setGame(challengeId ? { ...saved, challengeId } : saved);
    else if (challengeId) setGame((g) => ({ ...g, challengeId }));
  }

  /** A past day's daily puzzle, as stored (or its bank fallback). */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && saved.puzzle && !challengeId) return setGame(saved);
    try {
      const res = await fetch(`/api/daily-puzzle?game=${SLUG}&date=${day}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return openDaily();
      const p = (await res.json()) as MiniPuzzle;
      setGame(fresh(`archive:${day}:${p.rows.join("")}`, "archive", `${SLUG}:${day}`, p, { date: day, challengeId }));
    } catch {
      openDaily();
    }
  }

  function openPractice(seed: string, challengeId: string) {
    setGame(fresh(`${seed}:${challengeId}`, "practice", seed, bankMiniForSeed(seed), { challengeId }));
  }

  function startPractice() {
    countPractice(SLUG);
    // A practice grid other than today's daily.
    let seed = `mini-practice:${crypto.randomUUID()}`;
    for (let i = 0; i < 5 && bankMiniForSeed(seed).rows.join("") === daily.rows.join(""); i++) seed = `mini-practice:${crypto.randomUUID()}`;
    const next = fresh(seed, "practice", seed, bankMiniForSeed(seed));
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && saved.puzzle && !saved.done) setGame(saved);
    else startPractice();
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey && saved.puzzle ? saved : fresh(dailyKey, "daily", `${SLUG}:${date}`, daily));
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Board key={game.key} game={game} date={game.date ?? date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

function Board({
  game,
  date,
  inert = false,
  onPractice,
  onResumePractice,
  onDaily,
}: {
  game: Saved;
  date: string;
  inert?: boolean;
  onPractice?: () => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const L = useMemo(() => layoutOf(game.puzzle.rows), [game.puzzle.rows]);
  const clues = game.puzzle.clues;
  const size = L.size;
  const [state, dispatch] = useReducer(reducer, game.state);
  const [cursor, setCursor] = useState<Cursor>(() => entryStart(L, game.state.values, 0));
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  // Opt-in rewarded ad: one more coach hint after the free ones (lib/ads/useRewardedOffer).
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const outOfHints = state.coachHints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer(`${SLUG}-extra-hint`, SLUG, outOfHints && !finish && !inert);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  const complete = isComplete(state);
  const full = isFull(state);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  const rating = getRating(SLUG).rating;
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? `Practice · ${sizeLabel(size)}`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${sizeLabel(size)}`;
  const openCells = L.solution.filter(Boolean).length;
  const filledCells = state.values.filter(Boolean).length;

  // Save progress (and the homepage's "In play" line) on every change.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    if (game.mode === "daily" && !finish && filledCells > 0) {
      setStatus(SLUG, date, { state: "playing", meta: `${filledCells} of ${openCells} squares · ${formatClock(timer.now())}` });
    }
    // timer.now is read on purpose without re-running every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", SLUG, { mode: game.mode, size });
  }, [inert, finish, game.mode, size]);

  // Finish: rank against today's players, update rating, stats, skills and the Daily Set.
  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const base = { hints: state.hints, mistakes: state.mistakes };
    track("game_complete", SLUG, { mode: game.mode, size, timeMs, ...base, checks: state.checks, reveals: state.reveals });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      // Archive puzzles are unrated: the day's field has moved on.
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating(SLUG).rating, delta: 0 }
          : recordMatch(SLUG, key, { puzzleRating: MINI_PUZZLE_RATING[size] ?? MINI_PUZZLE_RATING[5], won: true, percentile: percentile ?? undefined, ...base });
      const clean = isClean(state);
      const skills = [
        "solve",
        clean && "no-check",
        !L.black.some(Boolean) && "open-grid",
        timeMs < 60_000 && "under-60",
        size >= 7 && "big-grid",
        clean && timeMs < 60_000 && "clean-minute",
        size === 5 && timeMs < 30_000 && "under-30",
      ].filter((s): s is string => !!s);
      recordFinish(SLUG, { won: true, timeMs, hints: base.hints, level: sizeLabel(size), skills });
      if (game.mode === "daily") {
        markDone(SLUG, date, { timeMs, ...base, percentile: percentile ?? undefined, ratingDelta: delta, label: clean ? "Clean" : undefined });
      }
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
      setLoadingStats(false);
    };
    // Completion is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    setCoach(null);
    if (game.mode === "daily") {
      setLoadingStats(true);
      submitResult({ game: SLUG, date, timeMs, ...base }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  // The coach steps aside once its clue is solved.
  useEffect(() => {
    if (!coach || coach.rung === 3) return;
    const e = L.entries[coach.ladder.entry];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the board
    if (e.cells.every((i) => state.values[i] === L.solution[i])) setCoach(null);
  }, [state.values, coach, L]);

  const at = () => Math.round(timer.now());
  const activeEntry = entryAt(L, cursor);

  const type = useCallback(
    (letter: string) => {
      if (finish || inert) return;
      const cell = cursor.cell;
      const values = state.values.slice();
      if (!state.revealed[cell]) {
        values[cell] = letter;
        dispatch({ type: "input", cell, letter, at: at() });
      }
      setCursor(afterType(L, values, cursor));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cursor, state, finish, inert, L]
  );

  const backspace = useCallback(() => {
    if (finish || inert) return;
    if (state.values[cursor.cell] && !state.revealed[cursor.cell]) {
      dispatch({ type: "erase", cell: cursor.cell });
      return;
    }
    const target = backTarget(L, state.values, cursor);
    if (!state.revealed[target.cell]) dispatch({ type: "erase", cell: target.cell });
    setCursor(target);
  }, [cursor, state, finish, inert, L]);

  const selectCell = (i: number) => {
    if (L.black[i]) return;
    if (i === cursor.cell) {
      const other = (1 - cursor.dir) as 0 | 1;
      if (L.cellEntries[i][other] >= 0) setCursor({ cell: i, dir: other });
    } else {
      setCursor(normalize(L, { cell: i, dir: cursor.dir }));
    }
  };
  const selectEntry = (idx: number) => setCursor(entryStart(L, state.values, idx));
  const toggleDir = () => selectCell(cursor.cell);

  const openHint = () => {
    if (finish || coach || outOfHints) return;
    const ladder = hintLadder(L, state.values, clues);
    if (!ladder) return;
    dispatch({ type: "hint-used" });
    track("hint_used", SLUG, { mode: game.mode, rung: 1 });
    setCoach({ ladder, rung: 1 });
    setCursor(entryStart(L, state.values, ladder.entry));
  };

  // The bonus hint opens as soon as the rewarded ad has been watched.
  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  const coachLetter = () => {
    if (!coach) return;
    dispatch({ type: "reveal", cells: [coach.ladder.cell], at: at(), coach: true });
    setCursor({ cell: coach.ladder.cell, dir: L.entries[coach.ladder.entry].dir === "A" ? 0 : 1 });
    setCoach({ ...coach, rung: 2 });
  };
  const coachWord = () => {
    if (!coach) return;
    const e = L.entries[coach.ladder.entry];
    dispatch({ type: "reveal", cells: e.cells, at: at(), coach: true });
    setCoach({ ...coach, rung: 3 });
  };

  const check = () => {
    if (finish || !filledCells) return;
    dispatch({ type: "check", cells: L.solution.map((_, i) => i) });
    track("hint_used", SLUG, { mode: game.mode, kind: "check" });
  };
  const revealWord = () => {
    if (finish) return;
    dispatch({ type: "reveal", cells: L.entries[activeEntry].cells, at: at() });
    track("hint_used", SLUG, { mode: game.mode, kind: "reveal" });
  };

  // Physical keyboard: letters, Backspace/Delete, arrows, Tab / Shift+Tab / Enter, Space turns.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (k in moves) {
        e.preventDefault();
        setCursor((c) => arrow(L, c, moves[k][0], moves[k][1]));
      } else if (k === "Backspace" || k === "Delete") {
        e.preventDefault();
        backspace();
      } else if (k === "Tab" || k === "Enter") {
        e.preventDefault();
        setCursor((c) => stepEntry(L, state.values, c, e.shiftKey ? -1 : 1));
      } else if (k === " ") {
        e.preventDefault();
        toggleDir();
      } else if (/^[a-zA-Z]$/.test(k)) {
        e.preventDefault();
        type(k.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <MiniRecap game={game} date={date} L={L} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Solved! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const active = L.entries[activeEntry];
  const activeCells = new Set(active.cells);
  const coachCells = new Set(coach && coach.rung === 1 ? L.entries[coach.ladder.entry].cells : []);
  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.coachHints);
  // Cells big enough to tap on a 390px phone: 5 across fill the column, 7 shrink.
  const letterSize = size >= 7 ? "text-[clamp(18px,5.4vw,26px)]" : "text-[clamp(24px,8vw,34px)]";

  return (
    <GameShell
      tint={GAME.tint}
      title="Mini Crossword"
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>Help {state.hints}</Chip>
          <Chip>{sizeLabel(size)}</Chip>
        </>
      }
    >
      {full && !complete && (
        <p role="status" className="mx-4 my-0 rounded-2xl bg-soft px-4 py-2 text-sm text-muted">
          Every square is filled, but something’s not right yet. Check shows the wrong letters.
        </p>
      )}

      <div className="px-4">
          <div
            role="grid"
            aria-label={`Mini crossword, ${sizeLabel(size)}`}
            className="mx-auto grid select-none overflow-hidden rounded-[14px] border-2 border-[#111111] bg-[#111111]"
            // Short phones: shrink the board so the clue bar and keyboard stay on screen.
            style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gap: 1, maxWidth: "max(240px, calc(100dvh - 400px))", visibility: paused ? "hidden" : undefined }}
          >
            {Array.from({ length: size }, (_, r) => (
              <div key={r} role="row" className="contents">
                {Array.from({ length: size }, (_, c) => {
                  const i = r * size + c;
                  if (L.black[i]) return <div key={i} role="gridcell" aria-label="Black square" className="aspect-square bg-[#111111]" />;
                  const v = state.values[i];
                  const isCursor = i === cursor.cell;
                  const wrong = state.wrong[i] && v && v !== L.solution[i];
                  const bg = isCursor
                    ? "#FFB561"
                    : coachCells.has(i)
                      ? "#FDDCC6"
                      : activeCells.has(i)
                        ? "#FFE7C9"
                        : "#FFFFFF";
                  const n = L.numbers[i];
                  return (
                    <button
                      key={i}
                      type="button"
                      role="gridcell"
                      aria-selected={isCursor}
                      aria-label={`Row ${r + 1}, column ${c + 1}${n ? `, ${n}` : ""}: ${v ? `${v}${wrong ? ", wrong" : state.revealed[i] ? ", revealed" : ""}` : "empty"}`}
                      onClick={() => selectCell(i)}
                      className="relative flex aspect-square items-center justify-center p-0"
                      style={{ background: bg, boxShadow: coachCells.has(i) ? "inset 0 0 0 2px #F26B1D" : undefined }}
                    >
                      {n > 0 && <span className="absolute left-1 top-0.5 font-mono text-[clamp(9px,2.6vw,12px)] font-semibold leading-none text-[#111111]">{n}</span>}
                      <span className={`${letterSize} font-display font-bold leading-none ${wrong ? "text-[#C8102E]" : state.revealed[i] ? "text-[#3A22C9]" : "text-[#111111]"}`}>{v}</span>
                      {wrong && <span aria-hidden="true" className="absolute inset-x-[18%] bottom-[14%] h-[2px] bg-[#C8102E]" />}
                      {state.revealed[i] && <span aria-hidden="true" className="absolute right-0 top-0 h-0 w-0 border-l-[9px] border-t-[9px] border-l-transparent border-t-coach" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
      </div>

      {/* Clue bar, right above the keyboard. Tap the clue to turn across ↔ down. */}
      <div className="mx-4 flex min-h-[56px] items-stretch overflow-hidden rounded-[14px]" style={{ background: GAME.tint }}>
        <button type="button" onClick={() => setCursor(stepEntry(L, state.values, cursor, -1))} aria-label="Previous clue" className="flex w-11 shrink-0 items-center justify-center text-[#111111]">
          <Icon name="back" />
        </button>
        <button type="button" onClick={toggleDir} aria-label={`Clue ${entryLabel(active)}: ${clues[active.id]}. Tap to switch direction`} className="flex flex-1 items-center gap-2 px-1 py-2 text-left text-[15px] leading-snug text-[#111111]">
          <span className="shrink-0 font-mono text-[13px] font-bold">{active.id}</span>
          <span aria-live="polite">{clues[active.id]}</span>
        </button>
        <button type="button" onClick={() => setCursor(stepEntry(L, state.values, cursor, 1))} aria-label="Next clue" className="flex w-11 shrink-0 rotate-180 items-center justify-center text-[#111111]">
          <Icon name="back" />
        </button>
      </div>

      {/* On-screen keyboard: phones and tablets; desktops type on the real one. */}
      <div role="group" aria-label="Keyboard" className="flex flex-col gap-1.5 px-2 lg:pointer-fine:hidden">
        {KEY_ROWS.map((row, ri) => (
          <div key={row} className="flex justify-center gap-1">
            {[...row].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => type(k)}
                className="flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-[10px] bg-soft-2 p-0 text-[17px] font-semibold text-ink"
                style={{ maxWidth: 44 }}
              >
                {k}
              </button>
            ))}
            {ri === 2 && (
              <button type="button" onClick={backspace} aria-label="Delete letter" className="flex h-[52px] w-[64px] items-center justify-center rounded-[10px] bg-soft-2 p-0 text-ink">
                <Icon name="erase" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="px-4">
        {coach ? (
          <CoachPanel coach={coach} hintsLeft={hintsLeft} onLetter={coachLetter} onWord={coachWord} onClose={() => setCoach(null)} />
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              hintsLeft && !finish
                ? { label: "Get a hint", onClick: openHint }
                : !finish && bonusOffer.ready
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
          >
            {finish
              ? "Solved. Open the recap to see how you did."
              : hintsLeft
                ? "Stuck? I’ll point you to the easiest clue, then show a letter, then the word."
                : "You’ve used this puzzle’s three hints. Check and Reveal still work."}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-4">
        <ToolButton icon="check" label="Check" onClick={check} disabled={!filledCells || !!finish} />
        <ToolButton icon="sparkle" label="Reveal word" onClick={revealWord} disabled={!!finish} />
        <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={openHint} disabled={!hintsLeft || !!coach || !!finish} />
      </div>

      <ClueLists L={L} clues={clues} values={state.values} active={activeEntry} onSelect={selectEntry} />

      {finish && (
        <div className="px-4">
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-ink text-base font-semibold text-ground">
            See recap
          </button>
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
              Practice minis
            </SheetButton>
          ) : (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                New practice mini
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Mini Crossword
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

function ClueLists({
  L,
  clues,
  values,
  active,
  onSelect,
}: {
  L: Layout;
  clues: Record<string, string>;
  values: string[];
  active: number;
  onSelect: (idx: number) => void;
}) {
  const list = (dir: "A" | "D", title: string) => (
    <section aria-label={`${title} clues`} className="flex min-w-0 flex-1 flex-col gap-1">
      <h2 className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {L.entries.map((e, idx) => {
          if (e.dir !== dir) return null;
          const filled = e.cells.every((i) => values[i]);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect(idx)}
                aria-current={idx === active || undefined}
                className={`flex min-h-11 w-full items-start gap-2 rounded-[10px] px-2 py-1.5 text-left text-sm ${idx === active ? "text-[#111111]" : filled ? "text-muted" : "text-ink"}`}
                style={idx === active ? { background: GAME.tint } : undefined}
              >
                <span className="w-5 shrink-0 font-mono font-bold">{e.number}</span>
                <span>{clues[e.id]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
  return (
    <div className="flex flex-col gap-4 px-4 sm:flex-row">
      {list("A", "Across")}
      {list("D", "Down")}
    </div>
  );
}

function CoachPanel({ coach, hintsLeft, onLetter, onWord, onClose }: { coach: Coach; hintsLeft: number; onLetter: () => void; onWord: () => void; onClose: () => void }) {
  const { ladder, rung } = coach;
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag="Easiest clue" onClose={onClose} primary={{ label: "Show a letter", onClick: onLetter }}>
        {ladder.direction}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag="One letter" onClose={onClose} primary={{ label: "Show the word", onClick: onWord }}>
        {ladder.specific}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag="The word" onClose={onClose} primary={{ label: "Got it", onClick: onClose }}>
      {ladder.answer} Its letters now help the crossing clues.
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this puzzle.</span>}
    </CoachCard>
  );
}

const LEARN = (
  <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
    <li>Start with fill-in-the-blank clues (“Candy ___”): they’re the quickest to get.</li>
    <li>Then the shortest answers. Three-letter words give you letters for two longer ones.</li>
    <li>Read the crossings: with two letters of a five-letter word in, the rest often jumps out.</li>
    <li>Match the clue’s form. A plural clue wants a plural answer, a past-tense clue a past-tense one.</li>
    <li>Skip and come back. Tab moves to the next clue; a fresh look usually beats staring.</li>
  </ol>
);

function MiniRecap({
  game,
  date,
  L,
  state,
  finish,
  onClose,
  onPractice,
}: {
  game: Saved;
  date: string;
  L: Layout;
  state: PlayState;
  finish: Finish;
  onClose: () => void;
  onPractice?: () => void;
}) {
  const size = L.size;
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const unaided = L.entries.filter((e) => e.cells.every((i) => !state.revealed[i])).length;

  const coach = useMemo(() => {
    const k = keyMove(L, state.placedAt, state.revealed);
    let keyMoveText: string;
    if (k) {
      const e = L.entries[k.entry];
      const long = e.cells.length === size;
      keyMoveText = `at ${formatTime(k.at)} you filled ${entryLabel(e)}, ${e.answer}${long ? ", the first full-width answer to fall" : ", the first answer you got on your own"}. Its letters opened up the crossings.`;
    } else {
      keyMoveText = "the coach and Reveal did the heavy lifting this time. Next time try the shortest clues first: their letters crack the long ones.";
    }
    const next = skillProgress(SLUG).find((s) => !s.mastered);
    return {
      keyMove: keyMoveText,
      nextSkill: next ? `${next.skill.name} (${next.count} of ${MASTERY}): ${next.skill.what.toLowerCase()}.` : "You’ve mastered every Mini skill. Chase your best time.",
      learn: { title: "Solve minis faster in 2 minutes", body: LEARN },
    };
  }, [L, state, size]);

  const clean = isClean(state);
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const lv = `${game.mode === "practice" ? "Practice " : ""}${size}x${size}`;
  const imageParams = new URLSearchParams({
    g: SLUG,
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    m: String(state.mistakes),
    h: String(state.hints),
    lv,
    map: solveOrderMap(state),
  });
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle Mini Crossword${game.mode === "practice" ? " practice" : ""} · ${short} · ${sizeLabel(size)}`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    clean ? "No checks, no hints" : `${state.hints} check${state.hints === 1 ? "" : "s"} or hint${state.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/mini",
  ].join("\n");
  const label = game.mode === "practice" ? `Mini Crossword practice · ${sizeLabel(size)}` : `Mini Crossword · ${short}`;

  return (
    <Recap
      game={SLUG}
      heading={`${label}${game.mode === "archive" ? " · archive" : ""}`}
      title="Solved."
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Help", value: String(state.hints), note: clean ? "Clean solve" : `${state.checks} check · ${state.reveals} reveal · ${state.coachHints} hint`, good: clean },
        { label: "Answers", value: `${unaided}/${L.entries.length}`, note: "solved on your own", good: unaided === L.entries.length },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: game.seed, level: `${size}x${size}` } : { kind: "daily", date },
        label,
        result: { timeMs: finish.timeMs, mistakes: state.mistakes, hints: state.hints },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game={SLUG} href="/play/mini?practice=1" label="Play a practice mini" />}
    />
  );
}
