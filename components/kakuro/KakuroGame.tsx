"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import {
  DIFFICULTIES,
  TECHNIQUES,
  combosFor,
  comboText,
  generateKakuro,
  hintLadder,
  runState,
  solveLogically,
  techniqueLevel,
  type Difficulty,
  type HintLadder,
} from "@/lib/games/kakuro";
import { KAKURO_PUZZLE_RATING } from "@/lib/games/dailySchedule";
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
  MAX_MISTAKES,
  boardFor,
  emptyCells,
  initialState,
  isComplete,
  isWhite,
  moveCursor,
  peers,
  reducer,
  runDone,
  type KakuroGrid,
  type PlayState,
} from "./state";

interface Saved {
  key: string;
  /** archive = a past day's daily puzzle (/archive): unranked. */
  mode: "daily" | "practice" | "archive";
  date?: string;
  challengeId?: string;
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

export interface DailyKakuroData extends KakuroGrid {
  difficulty: Difficulty;
}

const GAME = GAME_BY_SLUG.kakuro;
const LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const DAILY_KEY = (date: string) => `fz:kakuro:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:kakuro:archive:${date}`;
const PRACTICE_KEY = "fz:kakuro:practice";
const PINK = "#FFB8DA";
const COACH = "#F26B1D";

type Coach = { ladder: HintLadder; rung: 1 | 2 | 3; teach?: string | null };

const gridOf = (p: KakuroGrid): KakuroGrid => ({ size: p.size, layout: p.layout, across: p.across, down: p.down, solution: p.solution });

function fresh(key: string, mode: Saved["mode"], difficulty: Difficulty, seed: string, p: KakuroGrid, extra: Partial<Saved> = {}): Saved {
  return { key, mode, difficulty, seed, state: initialState(gridOf(p)), elapsed: 0, ...extra };
}

export default function KakuroGame({ date, daily }: { date: string; daily: DailyKakuroData }) {
  const dailyKey = `${date}:${daily.layout}:${daily.solution.join("")}`;
  const [game, setGame] = useState<Saved>(() => fresh(dailyKey, "daily", daily.difficulty, `kakuro:${date}`, daily));
  const [loaded, setLoaded] = useState(false);
  const restored = useRef(false);

  // Restore saved progress after hydration (local storage isn't on the server).
  // Once per page view: the URL is cleaned up below, so a second run (Strict
  // Mode) would otherwise reopen the daily over a practice puzzle.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const params = new URLSearchParams(location.search);
    // "Play a practice puzzle" on the recap loads /play/kakuro?practice=<level> as a new page view.
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (want && (DIFFICULTIES as string[]).includes(want)) {
      history.replaceState(null, "", location.pathname);
      startPractice(want as Difficulty);
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== "kakuro") throw new Error("not a kakuro challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed, p.level as Difficulty, challengeId);
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

  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setGame(saved);
    try {
      const res = await fetch(`/api/daily-puzzle?game=kakuro&date=${day}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return openDaily();
      const p = (await res.json()) as DailyKakuroData;
      setGame(fresh(`archive:${day}`, "archive", p.difficulty, `kakuro:${day}`, p, { date: day, challengeId }));
    } catch {
      openDaily();
    }
  }

  function openPractice(seed: string, difficulty: Difficulty, challengeId: string) {
    const p = generateKakuro(seed, (DIFFICULTIES as string[]).includes(difficulty) ? difficulty : "medium");
    setGame(fresh(`${seed}:${challengeId}`, "practice", p.difficulty, seed, p, { challengeId }));
  }

  function startPractice(difficulty: Difficulty) {
    countPractice("kakuro");
    const seed = `kakuro-practice:${crypto.randomUUID()}`;
    const p = generateKakuro(seed, difficulty);
    const next = fresh(seed, "practice", p.difficulty, seed, p);
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice("medium");
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey ? saved : fresh(dailyKey, "daily", daily.difficulty, `kakuro:${date}`, daily));
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Board key={game.key} game={game} date={game.date ?? date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

/** "16 in 2: 7 + 9" or "11 in 3: 5 ways" for the selected cell's runs. */
function runHelp(sum: number, len: number): string {
  const combos = combosFor(len, sum);
  if (combos.length === 1) return `${sum} in ${len}: ${comboText(combos[0])}`;
  if (combos.length <= 3) return `${sum} in ${len}: ${combos.map(comboText).join(" · ")}`;
  return `${sum} in ${len}: ${combos.length} ways`;
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
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer(reducer, game.state, (s) => ({ ...s, past: [], future: [] }));
  const board = boardFor(state);
  const W = state.size + 1;
  const [selected, setSelected] = useState<number>(() => game.state.layout.indexOf("."));
  const [notesMode, setNotesMode] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("kakuro-extra-hint", "kakuro", outOfHints && !finish && !inert);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  const complete = isComplete(state);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  // The pre-hydration board also renders on the server: read local storage only once mounted.
  const rating = inert ? START_RATING : getRating("kakuro").rating;
  const label = LABEL[game.difficulty];
  const day = new Date(`${date}T00:00:00Z`);
  const sizeText = `${state.size}×${state.size}`;
  const subtitle =
    game.mode === "practice"
      ? `Practice · ${label} · ${sizeText}`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${label}`;

  useEffect(() => {
    if (inert) return;
    const { past: _past, future: _future, ...rest } = state;
    void _past;
    void _future;
    writeJson(storageKey, { ...game, state: rest, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "kakuro", { mode: game.mode, difficulty: game.difficulty });
  }, [inert, finish, game.mode, game.difficulty]);

  // Finish: rank against today's players, update rating, stats and skills.
  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const base = { hints: state.hints, mistakes: state.mistakes };
    track("game_complete", "kakuro", { mode: game.mode, difficulty: game.difficulty, timeMs, ...base });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating("kakuro").rating, delta: 0 }
          : recordMatch("kakuro", key, {
              puzzleRating: KAKURO_PUZZLE_RATING[game.difficulty],
              won: true,
              percentile: percentile ?? undefined,
              ...base,
            });
      const steps = solveLogically(board, state.solution.map(() => 0)).steps;
      recordFinish("kakuro", { won: true, timeMs, hints: base.hints, level: game.difficulty, skills: [...new Set(steps.map((s) => s.technique))] });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
      setLoadingStats(false);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    setCoach(null);
    if (game.mode === "daily") {
      setLoadingStats(true);
      submitResult({ game: "kakuro", date, timeMs, ...base }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const at = () => Math.round(timer.now());
  const input = useCallback(
    (digit: number) => {
      if (selected < 0 || finish || !isWhite(state, selected)) return;
      if (notesMode) dispatch({ type: "note", cell: selected, digit });
      else dispatch({ type: "input", cell: selected, digit, at: at() });
      if (coach?.rung === 3) setCoach(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, notesMode, finish, coach, state.layout]
  );

  const openHint = () => {
    if (finish || coach) return;
    if (state.hints >= MAX_HINTS + bonusHints) return;
    const ladder = hintLadder(board, state.values, state.solution);
    if (!ladder) return;
    dispatch({ type: "hint-used" });
    track("hint_used", "kakuro", { technique: ladder.technique, mode: game.mode });
    setCoach({ ladder, rung: 1 });
    if (ladder.answerPlacement) setSelected(ladder.answerPlacement.cell);
  };

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
    const p = coach.ladder.answerPlacement;
    if (p) {
      if (coach.ladder.mistakeCell !== undefined) dispatch({ type: "erase", cell: p.cell });
      dispatch({ type: "coach-place", cell: p.cell, digit: p.digit, at: at() });
      setSelected(p.cell);
    }
    setCoach({ ...coach, rung: 3, teach: undefined });
  };

  // Keyboard: arrows (skipping clue cells), 1-9, Backspace/Delete/0, N notes, H hint, undo/redo.
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
        setSelected((s) => moveCursor(state, s < 0 ? state.layout.indexOf(".") : s, dr, dc));
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

  const runsDone = useMemo(() => board.runs.map((r) => runDone(state, r.id)), [board, state]);

  if (showRecap && finish) {
    return <KakuroRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Solved! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const sel = selected >= 0 && isWhite(state, selected) ? selected : -1;
  const selRuns = sel >= 0 ? board.runOf[sel] : null;
  const runCells = new Set<number>(selRuns ? selRuns.flatMap((r) => board.runs[r].cells) : []);
  const selClues = new Set<number>(selRuns ? selRuns.map((r) => board.runs[r].clue) : []);
  const coachRuns = coach && coach.rung === 1 ? coach.ladder.runs : [];
  const coachRunCells = new Set<number>(coachRuns.flatMap((r) => board.runs[r].cells));
  const focus = new Set<number>(coach && coach.rung >= 2 ? coach.ladder.focusCells : []);
  const peerSet = new Set(sel >= 0 ? peers(state, sel) : []);
  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const fs = W <= 7 ? 22 : W <= 9 ? 19 : 16;
  const clueFs = W <= 7 ? 13 : W <= 9 ? 11.5 : 10;
  const thin = "1px solid color-mix(in srgb, #8b93b5 45%, var(--ground))";

  return (
    <GameShell
      tint={GAME.tint}
      title={game.mode === "practice" ? "Kakuro" : "Daily Kakuro"}
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
        <p className="mx-4 my-0 rounded-2xl bg-soft px-4 py-2 text-sm text-muted">Three mistakes. Keep going: wrong digits stay red so you can fix them.</p>
      )}
      <div className="px-4">
        <div
          role="grid"
          aria-label={`Kakuro grid, ${state.size} by ${state.size}`}
          className="grid overflow-hidden rounded-[14px] border-2 border-ink"
          style={{ gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))`, visibility: paused ? "hidden" : undefined }}
        >
          {Array.from({ length: W }, (_, r) => (
            <div key={r} role="row" className="contents">
              {Array.from({ length: W }, (_, c) => {
                const i = r * W + c;
                const border = { borderRight: c === W - 1 ? 0 : thin, borderBottom: r === W - 1 ? 0 : thin };
                if (!isWhite(state, i)) {
                  const a = state.across[i];
                  const d = state.down[i];
                  const lit = selClues.has(i) || coachRuns.some((id) => board.runs[id].clue === i);
                  const acrossRun = a ? board.runs.find((x) => x.clue === i && x.dir === "across") : undefined;
                  const downRun = d ? board.runs.find((x) => x.clue === i && x.dir === "down") : undefined;
                  const label = [a ? `across ${a}` : "", d ? `down ${d}` : ""].filter(Boolean).join(", ");
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      aria-label={label ? `Clue: ${label}` : "Blocked"}
                      className="relative aspect-square font-mono font-semibold leading-none"
                      style={{
                        ...border,
                        fontSize: clueFs,
                        color: "var(--ground)",
                        background:
                          a || d
                            ? `linear-gradient(to top right, transparent calc(50% - 0.6px), color-mix(in srgb, var(--ground) 45%, transparent) 50%, transparent calc(50% + 0.6px)), ${lit ? "color-mix(in srgb, var(--ink) 70%, " + PINK + ")" : "color-mix(in srgb, var(--ink) 86%, var(--ground))"}`
                            : "color-mix(in srgb, var(--ink) 86%, var(--ground))",
                      }}
                    >
                      {a > 0 && (
                        <span className="absolute right-[8%] top-[8%]" style={{ opacity: acrossRun && runsDone[acrossRun.id] ? 0.45 : 1 }}>
                          {a}
                        </span>
                      )}
                      {d > 0 && (
                        <span className="absolute bottom-[8%] left-[8%]" style={{ opacity: downRun && runsDone[downRun.id] ? 0.45 : 1 }}>
                          {d}
                        </span>
                      )}
                    </div>
                  );
                }
                const v = state.values[i];
                const wrong = v && v !== state.solution[i];
                const isSel = i === sel;
                const selDigit = sel >= 0 ? state.values[sel] : 0;
                const bg = focus.has(i)
                  ? `color-mix(in srgb, ${COACH} 22%, var(--ground))`
                  : isSel
                    ? `color-mix(in srgb, ${PINK} 70%, var(--ground))`
                    : selDigit && v === selDigit && peerSet.has(i)
                      ? `color-mix(in srgb, var(--card-red) 18%, var(--ground))`
                      : coachRunCells.has(i)
                        ? `color-mix(in srgb, ${COACH} 9%, var(--ground))`
                        : runCells.has(i)
                          ? `color-mix(in srgb, ${PINK} 26%, var(--ground))`
                          : "var(--ground)";
                const notes = state.notes[i];
                return (
                  <button
                    key={i}
                    type="button"
                    role="gridcell"
                    aria-selected={isSel}
                    aria-label={`Row ${r}, column ${c}: ${v ? `${v}${wrong ? ", wrong" : ""}` : "empty"}`}
                    onClick={() => setSelected(i)}
                    className="relative flex aspect-square items-center justify-center p-0"
                    style={{ ...border, background: bg, boxShadow: focus.has(i) ? `inset 0 0 0 3px ${COACH}` : undefined }}
                  >
                    {v ? (
                      <span className={`leading-none ${wrong ? "font-medium text-card-red underline decoration-2 underline-offset-4" : "font-semibold text-violet-deep"}`} style={{ fontSize: fs }}>
                        {v}
                      </span>
                    ) : notes ? (
                      <span className="grid h-full w-full grid-cols-3 p-0.5">
                        {Array.from({ length: 9 }, (_, d) => (
                          <span key={d} className="flex items-center justify-center font-mono leading-none text-muted" style={{ fontSize: Math.max(7, fs * 0.38) }}>
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
        {selRuns && (
          <p className="m-0 mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-xs text-muted" aria-live="polite">
            {selRuns.map((id) => {
              const run = board.runs[id];
              const { remaining, empty } = runState(run, state.values);
              return (
                <span key={id}>
                  {run.dir === "across" ? "Across" : "Down"} {runHelp(run.sum, run.cells.length)}
                  {empty.length && empty.length < run.cells.length ? ` · needs ${remaining} in ${empty.length}` : ""}
                </span>
              );
            })}
          </p>
        )}
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
              ? "Solved. Open the recap to see how you did."
              : hintsLeft
                ? "Stuck? I’ll find the next logical step: where to look, why it works, then the digit."
                : "You’ve used this puzzle’s three hints. Start from the unique sums: a 3 in two cells is always 1 + 2."}
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
              aria-label={`Enter ${d}${notesMode ? " as a note" : ""}`}
              onClick={() => input(d)}
              className="flex min-h-[56px] items-center justify-center rounded-[14px] p-0 font-display text-[26px] font-bold text-ink"
              style={{ background: `color-mix(in srgb, ${PINK} 28%, var(--ground))` }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <p className="m-0 px-4 text-center text-xs text-muted">
        {emptyCells(state)} cell{emptyCells(state) === 1 ? "" : "s"} to go.
        <span className="hidden sm:inline"> Keys: arrows, 1–9, Backspace, N for notes, H for a hint.</span>
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
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setPaused(false);
                      onPractice?.(d);
                    }}
                    className="min-h-11 rounded-full border border-line-strong text-sm font-semibold text-ink"
                  >
                    {LABEL[d]}
                  </button>
                ))}
              </div>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Daily Kakuro
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
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
  const mistake = ladder.mistakeCell !== undefined;
  const tag = mistake ? "Check your work" : ladder.title;
  const teach = mistake ? undefined : { label: "Teach me this", onClick: onTeach };
  if (coach.teach !== undefined) {
    return (
      <CoachCard heading={`Coach · ${TECHNIQUE_GUIDE[ladder.technique].title}`} tag="How it works" onClose={onClose} primary={rung < 3 ? { label: "Show the answer", onClick: onAnswer } : undefined}>
        {coach.teach}
      </CoachCard>
    );
  }
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }} secondary={teach}>
        {ladder.direction}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={{ label: "Show the answer", onClick: onAnswer }} secondary={teach}>
        {ladder.specific}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: "Got it", onClick: onClose }} secondary={teach}>
      {ladder.answer}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this puzzle.</span>}
    </CoachCard>
  );
}

function KakuroRecap({
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
  const label = LABEL[game.difficulty];
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const W = state.size + 1;

  // Coach recap: the hardest step of the intended solve path, and when the player got past it.
  const coach = useMemo(() => {
    const board = boardFor(state);
    const { steps, hardest } = solveLogically(board, state.solution.map(() => 0));
    let idx = 0;
    steps.forEach((s, i) => {
      if (techniqueLevel(s.technique) > techniqueLevel(steps[idx].technique)) idx = i;
    });
    const placement = steps[idx]?.placement ?? steps.slice(idx).find((s) => s.placement)?.placement;
    const hard = hardest ?? "last-cell";
    const guide = TECHNIQUE_GUIDE[hard];
    let keyMove: string;
    if (placement) {
      const where = `row ${Math.floor(placement.cell / W)}, column ${placement.cell % W}`;
      const when = state.placedAt[placement.cell];
      keyMove = state.coached.includes(placement.cell)
        ? `the ${placement.digit} at ${where} needed ${guide.phrase}. The coach helped there; try spotting it yourself next time.`
        : `${when ? `at ${formatTime(when)} ` : ""}you found the ${placement.digit} at ${where}. It took ${guide.phrase}, the hardest step in this grid.`;
    } else {
      keyMove = "you worked through the whole grid one sum at a time.";
    }
    const nextTech = TECHNIQUES[Math.min(TECHNIQUES.length - 1, techniqueLevel(hard) + 1)];
    const next = TECHNIQUE_GUIDE[nextTech];
    return {
      keyMove,
      nextSkill: nextTech === hard ? `${next.title}, again. You’ve reached the hardest technique these grids use.` : `${next.title}. You’ll need it for ${next.unlocks}.`,
      learn: { title: `Learn ${next.title} in 2 minutes`, body: next.body },
    };
  }, [state, W]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const imageParams = new URLSearchParams({
    g: "kakuro",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    m: String(state.mistakes),
    h: String(state.hints),
    lv: game.mode === "practice" ? `Practice ${label}` : label,
  });
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle ${game.mode === "practice" ? "Kakuro practice" : "Daily Kakuro"} · ${short} · ${label}`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"} · ${state.hints} hint${state.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/kakuro",
  ].join("\n");

  return (
    <Recap
      game="kakuro"
      heading={game.mode === "practice" ? `Kakuro practice · ${label}` : `Daily Kakuro · ${short}${game.mode === "archive" ? " · archive" : ""}`}
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
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: game.seed, level: game.difficulty } : { kind: "daily", date },
        label: game.mode === "practice" ? `Kakuro practice · ${label}` : `Daily Kakuro · ${short} · ${label}`,
        result: { timeMs: finish.timeMs, mistakes: state.mistakes, hints: state.hints },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={
        onPractice && (
          <PracticeAction
            game="kakuro"
            href={`/play/kakuro?practice=${game.difficulty}`}
            label={`Play ${game.difficulty === "easy" ? "an" : "a"} ${label.toLowerCase()} practice grid`}
          />
        )
      }
    />
  );
}
