"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import {
  EMPTY,
  FILLED,
  TECHNIQUES,
  UNKNOWN,
  clueText,
  generateNonogram,
  hintLadder,
  skillsOf,
  techniqueLevel,
  type Clues,
  type HintLadder,
  type LineRef,
  type Size,
  type Technique,
} from "@/lib/games/nonogram";
import { NONOGRAM_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getStreak } from "@/lib/games/kit/daily";
import { START_RATING, getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { recordFinish } from "@/lib/games/kit/achievements";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { TECHNIQUE_GUIDE } from "./techniqueGuide";
import {
  MAX_HINTS,
  initialState,
  isComplete,
  isWrong,
  lineDone,
  lineIndices,
  reducer,
  remainingFills,
  strokeLine,
  strokeTargets,
  strokeValue,
  type Mode,
  type PlayState,
} from "./state";

interface Saved {
  key: string;
  /** archive = a past day's daily puzzle (/archive): unranked. */
  mode: "daily" | "practice" | "archive";
  /** The archive puzzle's date. */
  date?: string;
  /** Opened from a friend's challenge link (lib/games/kit/challenge.ts). */
  challengeId?: string;
  size: Size;
  seed: string;
  /** The hand-drawn picture's name, or null for a pattern. */
  name: string | null;
  state: Omit<PlayState, "past" | "future">;
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

interface DailyNonogramData {
  solution: number[];
  clues: Clues;
  name: string | null;
}

const GAME = GAME_BY_SLUG.nonogram;
const SIZES: Size[] = [5, 10, 15];
const DAILY_KEY = (date: string) => `fz:nonogram:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:nonogram:archive:${date}`;
const PRACTICE_KEY = "fz:nonogram:practice";
const sizeLabel = (n: number) => `${n}×${n}`;
const PURPLE = "#D8B4FE";
const COACH = "#F26B1D";

type Coach = { ladder: HintLadder; rung: 1 | 2 | 3; teach?: string | null };

function fresh(key: string, mode: Saved["mode"], size: Size, seed: string, p: DailyNonogramData, extra: Partial<Saved> = {}): Saved {
  return { key, mode, size, seed, name: p.name, state: initialState(size, p.solution, p.clues), elapsed: 0, ...extra };
}

export default function NonogramGame({ date, daily }: { date: string; daily: DailyNonogramData }) {
  const dailyKey = `${date}:${daily.solution.join("")}`;
  const [game, setGame] = useState<Saved>(() => fresh(dailyKey, "daily", 10, `nonogram:${date}`, daily));
  const [loaded, setLoaded] = useState(false);
  const restored = useRef(false);

  // Restore saved progress after hydration (local storage isn't on the server).
  // Once per page view: the URL is cleaned up below, so a second run (Strict
  // Mode) would otherwise reopen the daily over a practice puzzle.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const params = new URLSearchParams(location.search);
    // "Play a practice puzzle" on the recap loads /play/nonogram?practice=<size> as a new page view.
    const want = Number(params.get("practice"));
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if ((SIZES as number[]).includes(want)) {
      history.replaceState(null, "", location.pathname);
      startPractice(want as Size);
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== "nonogram") throw new Error("not a nonogram challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed, Number(p.level) as Size, challengeId);
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
    if (saved && saved.key === dailyKey) setGame(challengeId ? { ...saved, challengeId } : saved);
    else if (challengeId) setGame((g) => ({ ...g, challengeId }));
  }

  /** A past day's daily puzzle (the stored one, or regenerated from its seed). */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setGame(saved);
    try {
      const res = await fetch(`/api/daily-puzzle?game=nonogram&date=${day}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return openDaily();
      const p = (await res.json()) as DailyNonogramData;
      setGame(fresh(`archive:${day}`, "archive", 10, `nonogram:${day}`, p, { date: day, challengeId }));
    } catch {
      openDaily();
    }
  }

  function openPractice(seed: string, size: Size, challengeId: string) {
    const p = generateNonogram(seed, (SIZES as number[]).includes(size) ? size : 10);
    setGame(fresh(`${seed}:${challengeId}`, "practice", p.size, seed, p, { challengeId }));
  }

  function startPractice(size: Size) {
    countPractice("nonogram");
    const seed = `nonogram-practice:${crypto.randomUUID()}`;
    const p = generateNonogram(seed, size);
    const next = fresh(seed, "practice", size, seed, p);
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice(10);
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey ? saved : fresh(dailyKey, "daily", 10, `nonogram:${date}`, daily));
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Board key={game.key} game={game} date={game.date ?? date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

interface Stroke {
  start: number;
  value: number;
  last: number;
  pointerId: number;
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
  onPractice?: (s: Size) => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer(reducer, game.state, (s) => ({ ...s, past: [], future: [] }));
  const n = state.size;
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<Mode>("fill");
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("nonogram-extra-hint", "nonogram", outOfHints && !finish && !inert);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  const stroke = useRef<Stroke | null>(null);
  const [preview, setPreview] = useState<{ cells: number[]; value: number } | null>(null);
  const complete = isComplete(state);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  // The pre-hydration board also renders on the server: read local storage only once mounted.
  const rating = inert ? START_RATING : getRating("nonogram").rating;
  const label = sizeLabel(n);
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? `Practice · ${label}`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${label}`;

  // Save progress on every change.
  useEffect(() => {
    if (inert) return;
    const { past: _past, future: _future, ...rest } = state;
    void _past;
    void _future;
    writeJson(storageKey, { ...game, state: rest, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // timer.now is read on purpose without re-running every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "nonogram", { mode: game.mode, size: n });
  }, [inert, finish, game.mode, n]);

  // Finish: rank against today's players, update rating, stats and skills.
  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const base = { hints: state.hints, mistakes: state.mistakes };
    track("game_complete", "nonogram", { mode: game.mode, size: n, timeMs, ...base });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      // Archive puzzles are unrated: the day's field has moved on.
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating("nonogram").rating, delta: 0 }
          : recordMatch("nonogram", key, {
              puzzleRating: NONOGRAM_PUZZLE_RATING[n as Size],
              won: true,
              percentile: percentile ?? undefined,
              ...base,
            });
      recordFinish("nonogram", { won: true, timeMs, hints: base.hints, level: label, skills: skillsOf(state) });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
      setLoadingStats(false);
    };
    // Completion is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    setCoach(null);
    if (game.mode === "daily") {
      setLoadingStats(true);
      submitResult({ game: "nonogram", date, timeMs, ...base }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  /** Mark one cell (keyboard, or a tap without a drag). */
  const mark = useCallback(
    (cell: number, m: Mode, clear = false) => {
      if (finish || cell < 0) return;
      const value = clear ? UNKNOWN : strokeValue(m, state.cells[cell]);
      dispatch({ type: "paint", cells: [cell], value });
      if (coach?.rung === 3) setCoach(null);
    },
    [finish, state.cells, coach]
  );

  // Pointer painting: press on a cell, drag along its row or column, release to commit.
  const cellAt = (x: number, y: number): number => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    return el ? Number(el.dataset.cell) : -1;
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (finish || inert || (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2)) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell < 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const value = strokeValue(e.button === 2 ? "cross" : mode, state.cells[cell]);
    stroke.current = { start: cell, value, last: cell, pointerId: e.pointerId };
    setCursor(cell);
    setPreview({ cells: strokeTargets(state.cells, [cell], value), value });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell < 0 || cell === s.last) return;
    s.last = cell;
    setPreview({ cells: strokeTargets(state.cells, strokeLine(s.start, cell, n), s.value), value: s.value });
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.pointerId !== e.pointerId) return;
    stroke.current = null;
    const targets = strokeTargets(state.cells, strokeLine(s.start, s.last, n), s.value);
    setPreview(null);
    if (targets.length) {
      dispatch({ type: "paint", cells: targets, value: s.value });
      if (coach?.rung === 3) setCoach(null);
    }
  };
  const onPointerCancel = () => {
    stroke.current = null;
    setPreview(null);
  };

  const openHint = () => {
    if (finish || coach) return;
    if (state.hints >= MAX_HINTS + bonusHints) return;
    const ladder = hintLadder(state.cells, state.solution, state.clues, n);
    if (!ladder) return;
    dispatch({ type: "hint-used" });
    track("hint_used", "nonogram", { technique: ladder.technique, mode: game.mode });
    setCoach({ ladder, rung: 1 });
    if (ladder.mistakeCells?.length) setCursor(ladder.mistakeCells[0]);
    else if (ladder.line) setCursor(lineIndices(ladder.line, n)[0]);
  };

  // The bonus hint opens as soon as the rewarded ad has been watched.
  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  const teach = () => coach && setCoach({ ...coach, teach: TECHNIQUE_GUIDE[coach.ladder.technique].body });

  const showAnswer = () => {
    if (!coach) return;
    const { fill, empty } = coach.ladder;
    if (fill.length || empty.length) dispatch({ type: "coach", fill, empty });
    setCoach({ ...coach, rung: 3, teach: undefined });
  };

  // Keyboard: arrows move, Space/Enter marks in the current mode, F fill, X cross,
  // Backspace/Delete clear, M switches mode, H hint, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (mod || e.altKey) return;
      const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (e.key in move) {
        e.preventDefault();
        const [dr, dc] = move[e.key];
        setCursor((c) => {
          const r = Math.min(n - 1, Math.max(0, Math.floor(c / n) + dr));
          const col = Math.min(n - 1, Math.max(0, (c % n) + dc));
          return r * n + col;
        });
        return;
      }
      const k = e.key.toLowerCase();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        mark(cursor, mode);
      } else if (k === "f") mark(cursor, "fill");
      else if (k === "x") mark(cursor, "cross");
      else if (e.key === "Backspace" || e.key === "Delete") mark(cursor, mode, true);
      else if (k === "m") setMode((m) => (m === "fill" ? "cross" : "fill"));
      else if (k === "h") openHint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const curRow = Math.floor(cursor / n);
  const curCol = cursor % n;
  const previewSet = useMemo(() => new Set(preview?.cells ?? []), [preview]);
  const doneRows = useMemo(() => Array.from({ length: n }, (_, i) => lineDone(state, { kind: "row", index: i })), [state, n]);
  const doneCols = useMemo(() => Array.from({ length: n }, (_, i) => lineDone(state, { kind: "col", index: i })), [state, n]);

  if (showRecap && finish) {
    return <NonogramRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Solved! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  // Coach highlights: the line on rung 1, the exact cells from rung 2.
  const coachLine = new Set<number>(coach?.ladder.line && !coach.ladder.mistakeCells ? lineIndices(coach.ladder.line, n) : []);
  const coachCells = new Set<number>(
    coach ? (coach.ladder.mistakeCells ?? (coach.rung >= 2 ? [...coach.ladder.fill, ...coach.ladder.empty] : [])) : []
  );
  const isCoachLine = (ref: LineRef) => coach?.ladder.line?.kind === ref.kind && coach.ladder.line.index === ref.index && !coach.ladder.mistakeCells;

  const fs = n <= 5 ? 16 : n <= 10 ? 13 : 10.5;
  const rowClueChars = Math.max(1, ...state.clues.rows.map((c) => clueText(c).length));
  const colClueLen = Math.max(1, ...state.clues.cols.map((c) => c.length || 1));
  const rowClueW = Math.ceil(rowClueChars * fs * 0.62 + 12);
  const colClueH = Math.ceil(colClueLen * fs * 1.12 + 8);
  const thin = "1px solid color-mix(in srgb, #8b93b5 45%, var(--ground))";
  const thick = "2px solid var(--ink)";

  return (
    <GameShell
      tint={GAME.tint}
      title={game.mode === "practice" ? "Nonogram" : "Daily Nonogram"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>Mistakes {state.mistakes}</Chip>
          <Chip dark={mode === "cross"} onClick={() => setMode((m) => (m === "fill" ? "cross" : "fill"))} pressed={mode === "cross"}>
            {mode === "fill" ? "Filling" : "Crossing off"}
          </Chip>
        </>
      }
    >
      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div className="flex">
          <div style={{ width: rowClueW, height: colClueH }} className="shrink-0" aria-hidden="true" />
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, height: colClueH }} aria-label="Column clues">
            {state.clues.cols.map((clue, c) => {
              const lit = c === curCol || isCoachLine({ kind: "col", index: c });
              return (
                <div
                  key={c}
                  aria-label={`Column ${c + 1} clue: ${clueText(clue)}${doneCols[c] ? ", done" : ""}`}
                  className="flex flex-col items-center justify-end rounded-t-md pb-1 font-mono font-semibold leading-[1.12]"
                  style={{
                    fontSize: fs,
                    background: isCoachLine({ kind: "col", index: c }) ? `color-mix(in srgb, ${COACH} 18%, var(--ground))` : lit ? `color-mix(in srgb, ${PURPLE} 45%, var(--ground))` : undefined,
                    opacity: doneCols[c] ? 0.35 : 1,
                  }}
                >
                  {(clue.length ? clue : [0]).map((v, k) => (
                    <span key={k}>{v}</span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex">
          <div className="grid shrink-0" style={{ width: rowClueW, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }} aria-label="Row clues">
            {state.clues.rows.map((clue, r) => {
              const lit = r === curRow || isCoachLine({ kind: "row", index: r });
              return (
                <div
                  key={r}
                  aria-label={`Row ${r + 1} clue: ${clueText(clue)}${doneRows[r] ? ", done" : ""}`}
                  className="flex items-center justify-end gap-[0.35em] rounded-l-md pr-1.5 font-mono font-semibold"
                  style={{
                    fontSize: fs,
                    background: isCoachLine({ kind: "row", index: r }) ? `color-mix(in srgb, ${COACH} 18%, var(--ground))` : lit ? `color-mix(in srgb, ${PURPLE} 45%, var(--ground))` : undefined,
                    opacity: doneRows[r] ? 0.35 : 1,
                  }}
                >
                  {(clue.length ? clue : [0]).map((v, k) => (
                    <span key={k}>{v}</span>
                  ))}
                </div>
              );
            })}
          </div>
          <div
            role="grid"
            aria-label={`Nonogram grid, ${n} by ${n}`}
            className="grid flex-1 touch-none select-none overflow-hidden rounded-[10px] border-2 border-ink"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            {Array.from({ length: n }, (_, r) => (
              <div key={r} role="row" className="contents">
                {Array.from({ length: n }, (_, c) => {
                  const i = r * n + c;
                  const committed = state.cells[i];
                  const v = previewSet.has(i) ? preview!.value : committed;
                  const wrong = !previewSet.has(i) && committed !== UNKNOWN && isWrong(state, i, committed);
                  const isCursor = i === cursor && !inert;
                  const bg =
                    v === FILLED
                      ? wrong
                        ? "var(--card-red)"
                        : "var(--ink)"
                      : coachCells.has(i)
                        ? `color-mix(in srgb, ${COACH} 24%, var(--ground))`
                        : coachLine.has(i)
                          ? `color-mix(in srgb, ${COACH} 10%, var(--ground))`
                          : r === curRow || c === curCol
                            ? `color-mix(in srgb, ${PURPLE} 22%, var(--ground))`
                            : "var(--ground)";
                  const stateWord = v === FILLED ? "filled" : v === EMPTY ? "crossed off" : "blank";
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      data-cell={i}
                      aria-selected={isCursor}
                      aria-label={`Row ${r + 1}, column ${c + 1}: ${stateWord}${wrong ? ", wrong" : ""}`}
                      className="relative flex aspect-square items-center justify-center"
                      style={{
                        background: bg,
                        opacity: previewSet.has(i) ? 0.75 : 1,
                        borderRight: c === n - 1 ? 0 : (c + 1) % 5 === 0 ? thick : thin,
                        borderBottom: r === n - 1 ? 0 : (r + 1) % 5 === 0 ? thick : thin,
                        boxShadow: coachCells.has(i) ? `inset 0 0 0 2px ${COACH}` : isCursor ? "inset 0 0 0 2px var(--violet)" : undefined,
                      }}
                    >
                      {v === EMPTY && (
                        <svg viewBox="0 0 10 10" className="h-[55%] w-[55%]" aria-hidden="true">
                          <path d="M2 2l6 6M8 2l-6 6" stroke={wrong ? "var(--card-red)" : "var(--muted)"} strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4">
        {coach ? (
          <CoachPanel coach={coach} onMore={() => setCoach({ ...coach, rung: 2 })} onAnswer={showAnswer} onTeach={teach} onClose={() => setCoach(null)} hintsLeft={hintsLeft} />
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
              ? "Solved. Open the recap to see the picture."
              : hintsLeft
                ? "Stuck? I’ll find the next line logic can crack: which line, which rule, then which cells."
                : "You’ve used this puzzle’s three hints. Start from the biggest clues: their overlap is always filled."}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 px-4">
        <ToolButton icon="undo" label="Undo" onClick={() => dispatch({ type: "undo" })} disabled={!state.past.length} />
        <ToolButton icon="redo" label="Redo" onClick={() => dispatch({ type: "redo" })} disabled={!state.future.length} />
        <ModeButton label="Fill" active={mode === "fill"} onClick={() => setMode("fill")}>
          <span className="block h-[18px] w-[18px] rounded-[3px] bg-current" />
        </ModeButton>
        <ModeButton label="Cross" active={mode === "cross"} onClick={() => setMode("cross")}>
          <svg viewBox="0 0 10 10" width="18" height="18" aria-hidden="true">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </ModeButton>
        <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={openHint} disabled={!hintsLeft || !!coach || !!finish} />
      </div>

      <p className="m-0 px-4 text-center text-xs text-muted">
        Tap a cell or drag along a row or column. {remainingFills(state)} cell{remainingFills(state) === 1 ? "" : "s"} left to fill.
        <span className="hidden sm:inline"> Keys: arrows, Space, F, X, M to switch, H for a hint.</span>
      </p>

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
              Practice puzzles
            </SheetButton>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPaused(false);
                      onPractice?.(s);
                    }}
                    className="min-h-11 rounded-full border border-line-strong text-sm font-semibold text-ink"
                  >
                    {sizeLabel(s)}
                  </button>
                ))}
              </div>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Daily Nonogram
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

/** Same frame as ToolButton, with a custom glyph (a filled square, a cross). */
function ModeButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[52px] flex-col items-center justify-center gap-[3px] rounded-[14px] text-xs font-semibold ${active ? "bg-ink text-ground" : "bg-soft-2 text-ink"}`}
    >
      {children}
      {label}
    </button>
  );
}

function CoachPanel({
  coach,
  onMore,
  onAnswer,
  onTeach,
  onClose,
  hintsLeft,
}: {
  coach: Coach;
  onMore: () => void;
  onAnswer: () => void;
  onTeach: () => void;
  onClose: () => void;
  hintsLeft: number;
}) {
  const { ladder, rung } = coach;
  const tag = ladder.mistakeCells ? "Check your work" : ladder.title;
  if (coach.teach !== undefined) {
    return (
      <CoachCard heading={`Coach · ${TECHNIQUE_GUIDE[ladder.technique].title}`} tag="How it works" onClose={onClose} primary={rung < 3 ? { label: "Show the answer", onClick: onAnswer } : undefined}>
        {coach.teach}
      </CoachCard>
    );
  }
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }} secondary={ladder.mistakeCells ? undefined : { label: "Teach me this", onClick: onTeach }}>
        {ladder.direction}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={{ label: "Show the answer", onClick: onAnswer }} secondary={ladder.mistakeCells ? undefined : { label: "Teach me this", onClick: onTeach }}>
        {ladder.specific}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: "Got it", onClick: onClose }} secondary={ladder.mistakeCells ? undefined : { label: "Teach me this", onClick: onTeach }}>
      {ladder.answer}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this puzzle.</span>}
    </CoachCard>
  );
}

/** The finished picture, in the game's colors. */
function Picture({ size, solution }: { size: number; solution: number[] }) {
  return (
    <div
      role="img"
      aria-label="The finished picture"
      className="grid w-full max-w-[220px] gap-px overflow-hidden rounded-xl p-1.5"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, background: GAME.tint }}
    >
      {solution.map((v, i) => (
        <span key={i} className="aspect-square rounded-[2px]" style={{ background: v ? "#111111" : "transparent" }} />
      ))}
    </div>
  );
}

function NonogramRecap({
  game,
  date,
  state,
  finish,
  onClose,
  onPractice,
}: {
  game: Saved;
  date: string;
  state: PlayState;
  finish: Finish;
  onClose: () => void;
  onPractice?: (s: Size) => void;
}) {
  const n = state.size;
  const label = sizeLabel(n);
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  // Coach recap: the hardest technique the solve path needs, and the next one up.
  const coach = useMemo(() => {
    const used = skillsOf(state);
    const hard: Technique = used.at(-1) ?? "simple-boxes";
    const guide = TECHNIQUE_GUIDE[hard];
    const keyMove = state.coached.length
      ? `this one needed ${guide.phrase}. The coach helped ${state.coached.length === 1 ? "with one cell" : `with ${state.coached.length} cells`}; try spotting it yourself next time.`
      : `you finished it unaided, including the steps that needed ${guide.phrase}.`;
    const ladder = TECHNIQUES.filter((t) => t !== "contradiction");
    const nextTech = ladder[Math.min(ladder.length - 1, techniqueLevel(hard) + 1)] ?? hard;
    const next = TECHNIQUE_GUIDE[nextTech];
    return {
      keyMove,
      nextSkill: nextTech === hard ? `${next.title}, again. You’ve reached the hardest rule these puzzles use.` : `${next.title}. You’ll need it for ${next.unlocks}.`,
      learn: { title: `Learn ${next.title} in 2 minutes`, body: next.body },
    };
  }, [state]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const lv = game.mode === "practice" ? `Practice ${n}x${n}` : `${n}x${n}`;
  const imageParams = new URLSearchParams({ g: "nonogram", d: date, t: String(finish.timeMs), s: String(finish.streak), m: String(state.mistakes), h: String(state.hints), lv });
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle ${game.mode === "practice" ? "Nonogram practice" : "Daily Nonogram"} · ${short} · ${label}`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"} · ${state.hints} hint${state.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/nonogram",
  ].join("\n");

  return (
    <Recap
      game="nonogram"
      heading={game.mode === "practice" ? `Nonogram practice · ${label}` : `Daily Nonogram · ${short}${game.mode === "archive" ? " · archive" : ""}`}
      title="Solved."
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      showcase={
        <div className="flex items-center gap-4 rounded-[20px] border border-line p-3">
          <Picture size={n} solution={state.solution} />
          <p className="m-0 text-[15px] font-semibold leading-snug">{game.name ? `You painted ${game.name}.` : "You uncovered a pattern."}</p>
        </div>
      }
      tiles={[
        { label: "Hints", value: String(state.hints), note: `of ${MAX_HINTS} used` },
        { label: "Mistakes", value: String(state.mistakes), note: state.mistakes ? "Keep it clean" : "Clean solve", good: !state.mistakes },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: game.seed, level: String(n) } : { kind: "daily", date },
        label: game.mode === "practice" ? `Nonogram practice · ${label}` : `Daily Nonogram · ${short}`,
        result: { timeMs: finish.timeMs, mistakes: state.mistakes, hints: state.hints },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game="nonogram" href={`/play/nonogram?practice=${n}`} label={`Play a ${label} practice puzzle`} />}
    />
  );
}

