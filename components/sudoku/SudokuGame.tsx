"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import Recap from "@/components/kit/Recap";
import { generateSudoku, hintLadder, solveLogically, TECHNIQUES, type Difficulty, type Grid, type HintLadder } from "@/lib/games/sudoku";
import { DIFFICULTY_LABEL, SUDOKU_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getStreak, markDone, setStatus } from "@/lib/games/kit/daily";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { TECHNIQUE_GUIDE } from "./techniqueGuide";
import { currentGrid, initialState, isComplete, MAX_HINTS, MAX_MISTAKES, peers, reducer, remaining, solveOrderMap, type PlayState } from "./state";

interface Saved {
  key: string;
  mode: "daily" | "practice";
  difficulty: Difficulty;
  seed: string;
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

const GAME = GAME_BY_SLUG.sudoku;
const DAILY_KEY = (date: string) => `fz:sudoku:daily:${date}`;
const PRACTICE_KEY = "fz:sudoku:practice";
const R = (c: number) => Math.floor(c / 9);
const C = (c: number) => c % 9;
const B = (c: number) => Math.floor(R(c) / 3) * 3 + Math.floor(C(c) / 3);

type Coach = { ladder: HintLadder; rung: 1 | 2 | 3; teach?: string | null };

export default function SudokuGame({
  date,
  daily,
}: {
  date: string;
  daily: { difficulty: Difficulty; puzzle: Grid; solution: Grid };
}) {
  const dailyKey = `${date}:${daily.puzzle.join("")}`;
  const [game, setGame] = useState<Saved>(() => ({
    key: dailyKey,
    mode: "daily",
    difficulty: daily.difficulty,
    seed: `sudoku:${date}`,
    state: initialState(daily.puzzle, daily.solution),
    elapsed: 0,
  }));
  const [loaded, setLoaded] = useState(false);

  // Restore today's saved progress after hydration (local storage isn't on the server).
  useEffect(() => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage
    if (saved && saved.key === dailyKey) setGame(saved);
    setLoaded(true);
  }, [date, dailyKey]);

  const startPractice = (difficulty: Difficulty) => {
    const seed = `sudoku-practice:${crypto.randomUUID()}`;
    const p = generateSudoku(seed, difficulty);
    const next: Saved = { key: seed, mode: "practice", difficulty: p.difficulty, seed, state: initialState(p.puzzle, p.solution), elapsed: 0 };
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  };
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice("medium");
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(
      saved && saved.key === dailyKey
        ? saved
        : { key: dailyKey, mode: "daily", difficulty: daily.difficulty, seed: `sudoku:${date}`, state: initialState(daily.puzzle, daily.solution), elapsed: 0 }
    );
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Board key={game.key} game={game} date={date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
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
  onPractice?: (d: Difficulty) => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer(reducer, game.state, (s) => ({ ...s, past: [], future: [] }));
  const [selected, setSelected] = useState<number>(() => game.state.puzzle.findIndex((v) => !v));
  const [notesMode, setNotesMode] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  const complete = isComplete(state);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  const grid = useMemo(() => currentGrid(state), [state]);
  const left = useMemo(() => remaining(state), [state]);
  const rating = getRating("sudoku").rating;
  const label = DIFFICULTY_LABEL[game.difficulty];
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "daily"
      ? `${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${label}`
      : `Practice · ${label}`;

  // Save progress (and the homepage's "In play" line) on every change.
  useEffect(() => {
    if (inert) return;
    const { past: _past, future: _future, ...rest } = state;
    void _past;
    void _future;
    const filled = state.puzzle.filter((g, i) => !g && state.values[i] === state.solution[i]).length;
    const empty = state.puzzle.filter((g) => !g).length;
    writeJson(storageKey, { ...game, state: rest, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    if (game.mode === "daily" && !finish && filled > 0) {
      setStatus("sudoku", date, { state: "playing", meta: `${label} · ${empty - filled} cells left · ${formatClock(timer.now())}` });
    }
    // timer.now is read on purpose without re-running every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "sudoku", { mode: game.mode, difficulty: game.difficulty });
  }, [inert, finish, game.mode, game.difficulty]);

  // Finish: rank against today's players, update rating, streak and Daily Set.
  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const base = { hints: state.hints, mistakes: state.mistakes };
    track("game_complete", "sudoku", { mode: game.mode, difficulty: game.difficulty, timeMs, ...base });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      const { rating: r, delta } = recordMatch("sudoku", key, {
        puzzleRating: SUDOKU_PUZZLE_RATING[game.difficulty],
        won: true,
        percentile: percentile ?? undefined,
        ...base,
      });
      if (game.mode === "daily") {
        markDone("sudoku", date, { timeMs, ...base, percentile: percentile ?? undefined, ratingDelta: delta, label });
      }
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
      setLoadingStats(false);
    };
    // Completion is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    if (game.mode === "daily") {
      setLoadingStats(true);
      submitResult({ game: "sudoku", date, timeMs, ...base }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const at = () => Math.round(timer.now());
  const input = useCallback(
    (digit: number) => {
      if (selected < 0 || finish) return;
      if (notesMode) dispatch({ type: "note", cell: selected, digit });
      else dispatch({ type: "input", cell: selected, digit, at: at() });
      if (coach?.rung === 3) setCoach(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, notesMode, finish, coach]
  );

  const openHint = () => {
    if (finish) return;
    if (coach) return;
    if (state.hints >= MAX_HINTS) {
      setCoach(null);
      return;
    }
    const ladder = hintLadder(grid, state.solution);
    if (!ladder) return;
    dispatch({ type: "hint-used" });
    track("hint_used", "sudoku", { technique: ladder.technique, mode: game.mode });
    setCoach({ ladder, rung: 1 });
    if (ladder.mistakeCell !== undefined) setSelected(ladder.mistakeCell);
    else if (ladder.answerPlacement) setSelected(ladder.answerPlacement.cell);
  };

  const teach = async () => {
    if (!coach) return;
    const { ladder } = coach;
    setCoach({ ...coach, teach: null });
    let text: string | null = null;
    const p = ladder.answerPlacement;
    if (game.mode === "daily" && p && ladder.mistakeCell === undefined) {
      try {
        const res = await fetch(`/api/coach?game=sudoku&date=${date}&key=${ladder.technique}:${p.cell}:${p.digit}`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) text = ((await res.json()) as { text: string | null }).text;
      } catch {
        // Fall back to the built-in guide.
      }
    }
    setCoach((c) => c && { ...c, teach: text ?? TECHNIQUE_GUIDE[ladder.technique].body });
  };

  const showAnswer = () => {
    if (!coach) return;
    const p = coach.ladder.answerPlacement;
    if (p) {
      if (coach.ladder.mistakeCell !== undefined) dispatch({ type: "erase", cell: p.cell });
      dispatch({ type: "coach-place", cell: p.cell, digit: p.digit, at: at() });
      setSelected(p.cell);
    }
    setCoach({ ...coach, rung: 3, teach: undefined });
  };

  // Keyboard: arrows, 1-9, Backspace/Delete/0, N notes, H hint, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
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
      if (mod) return;
      const move: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in move) {
        e.preventDefault();
        setSelected((s) => {
          const base = s < 0 ? 0 : s;
          const n = base + move[e.key];
          if (e.key === "ArrowLeft" && C(base) === 0) return base;
          if (e.key === "ArrowRight" && C(base) === 8) return base;
          return n >= 0 && n < 81 ? n : base;
        });
      } else if (/^[1-9]$/.test(e.key)) {
        input(Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        if (selected >= 0) dispatch({ type: "erase", cell: selected });
      } else if (e.key.toLowerCase() === "n") {
        setNotesMode((v) => !v);
      } else if (e.key.toLowerCase() === "h") {
        openHint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <SudokuRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Solved! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const sel = selected >= 0 ? selected : -1;
  const selDigit = sel >= 0 ? grid[sel] : 0;
  const focus = new Set(coach && coach.rung >= 2 ? (coach.ladder.mistakeCell !== undefined ? [coach.ladder.mistakeCell] : coach.ladder.step?.focusCells ?? []) : []);
  const unitCells = new Set<number>();
  if (coach && coach.rung === 1 && coach.ladder.step) {
    for (const u of coach.ladder.step.units) {
      for (let i = 0; i < 81; i++) if ((u.kind === "row" ? R(i) : u.kind === "col" ? C(i) : B(i)) === u.index) unitCells.add(i);
    }
  }
  const peerSet = new Set(sel >= 0 ? peers(sel) : []);
  const hintsLeft = MAX_HINTS - state.hints;

  return (
    <GameShell
      tint={GAME.tint}
      title={game.mode === "daily" ? "Daily Sudoku" : "Sudoku"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>
            Mistakes {state.mistakes} / {MAX_MISTAKES}
          </Chip>
          <Chip dark={notesMode} onClick={() => setNotesMode((v) => !v)} pressed={notesMode}>
            Notes {notesMode ? "on" : "off"}
          </Chip>
        </>
      }
    >
      {state.mistakes >= MAX_MISTAKES && !finish && (
        <p className="mx-4 my-0 rounded-2xl bg-soft px-4 py-2 text-sm text-muted">
          Three mistakes. Keep going: wrong numbers stay red so you can fix them.
        </p>
      )}
      <div className="px-4">
        <div
          role="grid"
          aria-label="Sudoku grid"
          className="grid grid-cols-9 overflow-hidden rounded-[14px] border-2 border-ink"
          style={{ visibility: paused ? "hidden" : undefined }}
        >
          {Array.from({ length: 9 }, (_, row) => (
            <div key={row} role="row" className="contents">
          {Array.from({ length: 9 }, (_, col) => {
            const i = row * 9 + col;
            const given = state.puzzle[i];
            const v = grid[i];
            const wrong = !given && v && v !== state.solution[i];
            const isSel = i === sel;
            const inFocus = focus.has(i);
            const bg = inFocus
              ? "color-mix(in srgb, #F26B1D 22%, var(--ground))"
              : isSel
                ? "color-mix(in srgb, #9DB4FF 55%, var(--ground))"
                : selDigit && v === selDigit
                  ? "color-mix(in srgb, #9DB4FF 38%, var(--ground))"
                  : unitCells.has(i)
                    ? "color-mix(in srgb, #F26B1D 9%, var(--ground))"
                    : peerSet.has(i)
                      ? "color-mix(in srgb, #9DB4FF 18%, var(--ground))"
                      : "var(--ground)";
            const thin = "1px solid color-mix(in srgb, #8b93b5 45%, var(--ground))";
            const thick = "2px solid var(--ink)";
            const notes = state.notes[i];
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`Row ${R(i) + 1}, column ${C(i) + 1}: ${v ? `${v}${given ? ", given" : wrong ? ", wrong" : ""}` : "empty"}`}
                onClick={() => setSelected(i)}
                className="relative flex aspect-square items-center justify-center p-0"
                style={{
                  background: bg,
                  borderRight: C(i) === 8 ? 0 : C(i) % 3 === 2 ? thick : thin,
                  borderBottom: R(i) === 8 ? 0 : R(i) % 3 === 2 ? thick : thin,
                  boxShadow: inFocus ? "inset 0 0 0 3px #F26B1D" : undefined,
                }}
              >
                {v ? (
                  <span
                    className={`text-[clamp(18px,5.6vw,24px)] leading-none ${given ? "font-[650] text-ink" : wrong ? "font-medium text-card-red underline decoration-2 underline-offset-4" : "font-medium text-violet-deep"}`}
                  >
                    {v}
                  </span>
                ) : notes ? (
                  <span className="grid h-full w-full grid-cols-3 p-0.5">
                    {Array.from({ length: 9 }, (_, d) => (
                      <span key={d} className="flex items-center justify-center font-mono text-[clamp(8px,2.3vw,10px)] leading-none text-muted">
                        {notes & (1 << d) ? d + 1 : ""}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4">
        {coach ? (
          <CoachPanel coach={coach} onMore={() => setCoach({ ...coach, rung: 2 })} onAnswer={showAnswer} onTeach={teach} onClose={() => setCoach(null)} hintsLeft={hintsLeft} />
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={hintsLeft && !finish ? { label: "Get a hint", onClick: openHint } : undefined}
          >
            {finish
              ? "Solved. Open the recap to see how you did."
              : hintsLeft
                ? "Stuck? I’ll find the next logical step: a nudge, then details, then the answer."
                : "You’ve used today’s three hints. Notes help: pencil in what each cell could be."}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 px-4">
        <ToolButton icon="undo" label="Undo" onClick={() => dispatch({ type: "undo" })} disabled={!state.past.length} />
        <ToolButton icon="redo" label="Redo" onClick={() => dispatch({ type: "redo" })} disabled={!state.future.length} />
        <ToolButton icon="erase" label="Erase" onClick={() => sel >= 0 && dispatch({ type: "erase", cell: sel })} />
        <ToolButton icon="notes" label="Notes" active={notesMode} onClick={() => setNotesMode((v) => !v)} />
        <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={openHint} disabled={!hintsLeft || !!coach || !!finish} />
      </div>

      <div className="grid grid-cols-9 gap-[5px] px-4">
        {Array.from({ length: 9 }, (_, k) => {
          const d = k + 1;
          return (
            <button
              key={d}
              type="button"
              aria-label={`Enter ${d}${notesMode ? " as a note" : ""}, ${left[d]} left`}
              onClick={() => input(d)}
              disabled={left[d] === 0 && !notesMode}
              className="flex min-h-[60px] flex-col items-center justify-center gap-px rounded-[14px] p-0 font-display text-[26px] font-bold text-ink disabled:opacity-30"
              style={{ background: "color-mix(in srgb, #9DB4FF 20%, var(--ground))" }}
            >
              {d}
              <span className="whitespace-nowrap font-mono text-[9px] font-medium tracking-[-0.02em] text-muted sm:text-[10px]">{left[d]} left</span>
            </button>
          );
        })}
      </div>

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
              <div className="grid grid-cols-4 gap-2">
                {(["easy", "medium", "hard", "expert"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setPaused(false);
                      onPractice?.(d);
                    }}
                    className="min-h-11 rounded-full border border-line-strong text-sm font-semibold text-ink"
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                ))}
              </div>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Daily Sudoku
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

/** "R2C5" (the solver's notation) → "row 2, column 5" for casual players. */
const friendly = (text: string) => text.replace(/R(\d)C(\d)/g, "row $1, column $2");

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
  const tag = ladder.mistakeCell !== undefined ? "Check your work" : ladder.title;
  if (coach.teach !== undefined) {
    return (
      <CoachCard heading={`Coach · ${TECHNIQUE_GUIDE[ladder.technique].title}`} tag="How it works" onClose={onClose} primary={rung < 3 ? { label: "Show the answer", onClick: onAnswer } : undefined}>
        {coach.teach === null ? "Thinking…" : coach.teach}
      </CoachCard>
    );
  }
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }} secondary={{ label: "Teach me this", onClick: onTeach }}>
        {friendly(ladder.direction)}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={{ label: "Show the answer", onClick: onAnswer }} secondary={{ label: "Teach me this", onClick: onTeach }}>
        {friendly(ladder.specific)}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: "Got it", onClick: onClose }} secondary={{ label: "Teach me this", onClick: onTeach }}>
      {friendly(ladder.answer)}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this puzzle.</span>}
    </CoachCard>
  );
}

function SudokuRecap({
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
  onPractice?: (d: Difficulty) => void;
}) {
  const label = DIFFICULTY_LABEL[game.difficulty];
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  // Coach recap: the hardest step of the intended solve path, and when the
  // player got past it.
  const coach = useMemo(() => {
    const { steps, hardest } = solveLogically(state.puzzle);
    const rank = (t: string) => TECHNIQUES.indexOf(t as (typeof TECHNIQUES)[number]);
    let idx = 0;
    steps.forEach((s, i) => {
      if (rank(s.technique) > rank(steps[idx].technique)) idx = i;
    });
    const key = steps[idx];
    const placement = key?.placement ?? steps.slice(idx).find((s) => s.placement)?.placement;
    const hard = hardest ?? "naked-single";
    const guide = TECHNIQUE_GUIDE[hard];
    let keyMove: string;
    if (placement) {
      const coached = state.coached.includes(placement.cell);
      const when = state.placedAt[placement.cell];
      const where = `row ${R(placement.cell) + 1}, column ${C(placement.cell) + 1}`;
      keyMove = coached
        ? `the ${placement.digit} at ${where} needed a ${guide.title.toLowerCase()}. The coach helped there; try spotting it yourself next time.`
        : `${when ? `at ${formatTime(when)} ` : ""}you found the ${placement.digit} at ${where}. It took a ${guide.title.toLowerCase()}, the hardest step in this grid.`;
    } else {
      keyMove = "you worked through the whole grid one logical step at a time.";
    }
    const nextTech = TECHNIQUES[Math.min(TECHNIQUES.length - 1, rank(hard) + 1)];
    const next = TECHNIQUE_GUIDE[nextTech];
    return {
      keyMove,
      nextSkill: nextTech === hard ? `${next.title}, again. You’ve reached the hardest technique the daily grids use.` : `${next.title}. You’ll need it for ${next.unlocks}.`,
      learn: { title: `Learn ${next.title} in 2 minutes`, body: next.body },
    };
  }, [state]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const imageParams = new URLSearchParams({
    g: "sudoku",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    m: String(state.mistakes),
    h: String(state.hints),
    lv: game.mode === "daily" ? label : `Practice ${label}`,
    map: solveOrderMap(state),
  });
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle ${game.mode === "daily" ? "Daily Sudoku" : "Sudoku practice"} · ${short} · ${label}`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"} · ${state.hints} hint${state.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/sudoku",
  ].join("\n");

  return (
    <Recap
      game="sudoku"
      heading={game.mode === "daily" ? `Daily Sudoku · ${short}` : `Sudoku practice · ${label}`}
      title="Solved."
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Hints", value: String(state.hints), note: `of ${MAX_HINTS} used` },
        { label: "Mistakes", value: String(state.mistakes), note: state.mistakes ? "Keep it clean" : "Clean solve", good: !state.mistakes },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={
        onPractice && (
          <button type="button" onClick={() => onPractice(game.difficulty)} className="min-h-[52px] rounded-full border border-line-strong text-[15px] font-semibold text-ink">
            Play a {label.toLowerCase()} practice puzzle
          </button>
        )
      }
    />
  );
}

