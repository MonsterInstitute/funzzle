"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { WORD_HUNT_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { COLS, ROWS, adjacent, colOf, hintLadder, rowOf, spell, type HintLadder, type WordHuntPuzzle } from "@/lib/games/wordhunt";
import { recordFinish, skillProgress } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import {
  BONUS_PER_HINT,
  MAX_HINTS,
  claimedCells,
  earnedHints,
  foundSet,
  initialState,
  isComplete,
  judge,
  meter,
  reducer,
  shareMap,
  type Action,
  type Outcome,
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
  puzzle: WordHuntPuzzle;
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

const SLUG = "word-hunt";
const GAME = GAME_BY_SLUG[SLUG];
const DAILY_KEY = (date: string) => `fz:word-hunt:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:word-hunt:archive:${date}`;
const PRACTICE_KEY = "fz:word-hunt:practice";
const SEEN_KEY = "fz:word-hunt:practice-seen";
/** Theme words: the game's signature color; the span word: a warm highlight. */
const THEME_COLOR = "#9EE6E0";
const SPAN_COLOR = "#FFE066";
const COACH = "#F26B1D";

type Coach = { ladder: HintLadder; rung: 1 | 2 | 3 };
type Feedback = { text: string; tone: "good" | "span" | "bad" | "info" };

const dailyKeyOf = (date: string, p: WordHuntPuzzle) => `${date}:${p.grid}`;
const practiceSeed = (id: string) => `word-hunt:${id}`;
const fresh = (key: string, mode: Saved["mode"], puzzle: WordHuntPuzzle, extra: Partial<Saved> = {}): Saved => ({
  key,
  mode,
  puzzle,
  state: initialState(),
  elapsed: 0,
  ...extra,
});

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

export default function WordHuntGame({ date, daily, practiceIds }: { date: string; daily: WordHuntPuzzle; practiceIds: string[] }) {
  const dailyKey = dailyKeyOf(date, daily);
  const [game, setGame] = useState<Saved>(() => fresh(dailyKey, "daily", daily));
  const [loaded, setLoaded] = useState(false);

  // Restore saved progress / open the mode the URL asks for, after hydration.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    let pending: Promise<unknown> | null = null;
    if (want) {
      history.replaceState(null, "", location.pathname);
      pending = startPractice(practiceIds.includes(want) ? want : undefined);
    } else if (challengeId) {
      pending = fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== SLUG) throw new Error("not a word hunt challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed.replace(/^word-hunt:/, ""), challengeId);
          if (p.date === date) return openDaily(challengeId);
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily());
    } else if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      pending = openArchive(archiveDate);
    } else {
      openDaily();
    }
    if (pending) {
      pending.finally(() => setLoaded(true));
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage / URL
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [date, dailyKey]);

  function openDaily(challengeId?: string) {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    if (saved && saved.key === dailyKey && saved.puzzle?.grid === daily.grid) setGame(challengeId ? { ...saved, challengeId } : saved);
    else setGame(fresh(dailyKey, "daily", daily, challengeId ? { challengeId } : {}));
  }

  /** A past day's daily puzzle: the stored one, or the bank fallback for that day. */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && saved.puzzle && !challengeId) return setGame(saved);
    try {
      const d = await fetchJson<{ puzzle: WordHuntPuzzle }>(`/api/daily-puzzle?game=${SLUG}&date=${day}`);
      setGame(fresh(`archive:${day}:${d.puzzle.grid}`, "archive", d.puzzle, { date: day, challengeId }));
    } catch {
      openDaily();
    }
  }

  async function openPractice(id: string, challengeId?: string): Promise<void> {
    try {
      const puzzle = await fetchJson<WordHuntPuzzle>(`/api/word-hunt?id=${encodeURIComponent(id)}`);
      const next = fresh(`${practiceSeed(id)}:${challengeId ?? Date.now()}`, "practice", puzzle, challengeId ? { challengeId } : {});
      if (!challengeId) writeJson(PRACTICE_KEY, next);
      setGame(next);
    } catch {
      openDaily();
    }
  }

  /** A practice theme you haven't seen lately (never today's daily theme). */
  async function startPractice(id?: string) {
    const seen = readJson<string[]>(SEEN_KEY, []);
    let pool = practiceIds.filter((x) => x !== daily.id && !seen.includes(x));
    if (!pool.length) pool = practiceIds.filter((x) => x !== daily.id);
    const pick = id ?? pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return openDaily();
    countPractice(SLUG);
    writeJson(SEEN_KEY, [...seen.filter((x) => x !== pick), pick].slice(-Math.max(1, practiceIds.length - 2)));
    await openPractice(pick);
  }

  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && saved.puzzle && !saved.done) setGame(saved);
    else void startPractice();
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return (
    <Board
      key={game.key}
      game={game}
      date={game.date ?? date}
      onPractice={() => void startPractice()}
      onResumePractice={resumePractice}
      onDaily={() => openDaily()}
    />
  );
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

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
  const puzzle = game.puzzle;
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer((s: PlayState, a: Action) => reducer(s, a, puzzle), game.state);
  const [selection, setSelection] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [focusCell, setFocusCell] = useState(0);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  // Opt-in rewarded ad: one more coach hint after the free ones, offered only
  // when an ad is actually available (lib/ads/useRewardedOffer).
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const complete = isComplete(puzzle, state);
  const earned = earnedHints(state);
  const coachLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const outOfHints = coachLeft === 0 && earned === 0;
  const bonusOffer = useRewardedOffer("word-hunt-extra-hint", SLUG, outOfHints && !finish && !inert);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selRef = useRef<number[]>([]);
  const drag = useRef<{ id: number; moved: boolean; submitOnUp: boolean } | null>(null);
  const claimed = useMemo(() => claimedCells(puzzle, state), [puzzle, state]);
  const found = useMemo(() => foundSet(state), [state]);
  const rating = getRating(SLUG).rating;
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? "Practice"
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}`;

  const select = (next: number[]) => {
    selRef.current = next;
    setSelection(next);
  };

  // Save progress on every change.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // timer.now is read on purpose without re-running every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", SLUG, { mode: game.mode });
  }, [inert, finish, game.mode]);

  // Feedback fades after a moment.
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 1800);
    return () => clearTimeout(t);
  }, [feedback]);

  // Finish: rank against today's players, update rating, stats and skills.
  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const base = { hints: state.hints, mistakes: 0 };
    track("game_complete", SLUG, { mode: game.mode, timeMs, hints: state.hints, earned: state.earnedUsed, bonus: state.bonus.length });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.key}`;
      // Archive puzzles are unrated: the day's field has moved on.
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating(SLUG).rating, delta: 0 }
          : recordMatch(SLUG, key, { puzzleRating: WORD_HUNT_PUZZLE_RATING, won: true, percentile: percentile ?? undefined, ...base });
      recordFinish(SLUG, { won: true, timeMs, hints: state.hints + state.earnedUsed, level: game.mode, skills: skillsOf(puzzle, state, timeMs) });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
      setLoadingStats(false);
    };
    // Completion is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    if (game.mode === "daily") {
      setLoadingStats(true);
      submitResult({ game: SLUG, date, timeMs, ...base }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  // ---- tracing -------------------------------------------------------------

  const submit = (path: number[]) => {
    select([]);
    if (!path.length || finish) return;
    const o = judge(puzzle, state, path);
    dispatch({ type: "submit", path, at: Math.round(timer.now()) });
    setFeedback(feedbackFor(o, puzzle));
    if (o.kind === "theme" && coach && coach.ladder.word === o.word) setCoach(null);
  };

  /** A tap (or Enter on a focused letter): extend, back up, restart, or submit on the last letter. */
  const tap = (cell: number): "submit" | "changed" | "none" => {
    if (claimed.has(cell) || finish) return "none";
    const sel = selRef.current;
    const last = sel[sel.length - 1];
    if (sel.length && cell === last) return "submit";
    const at = sel.indexOf(cell);
    if (at >= 0) select(sel.slice(0, at + 1));
    else if (sel.length && adjacent(last, cell)) select([...sel, cell]);
    else select([cell]);
    return "changed";
  };

  /** The cell under a pointer; with `strict`, only near its center (diagonal drags cut corners). */
  const cellAtPoint = (x: number, y: number, strict: boolean): number | null => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cw = r.width / COLS;
    const ch = r.height / ROWS;
    const c = Math.floor((x - r.left) / cw);
    const row = Math.floor((y - r.top) / ch);
    if (c < 0 || c >= COLS || row < 0 || row >= ROWS) return null;
    if (strict) {
      const dx = x - r.left - (c + 0.5) * cw;
      const dy = y - r.top - (row + 0.5) * ch;
      if (Math.hypot(dx, dy) > 0.42 * Math.min(cw, ch)) return null;
    }
    return row * COLS + c;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (inert || paused || finish || (e.pointerType === "mouse" && e.button !== 0)) return;
    const cell = cellAtPoint(e.clientX, e.clientY, false);
    if (cell === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = tap(cell);
    drag.current = { id: e.pointerId, moved: false, submitOnUp: r === "submit" };
    setFocusCell(cell);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const cell = cellAtPoint(e.clientX, e.clientY, true);
    if (cell === null) return;
    const sel = selRef.current;
    const last = sel[sel.length - 1];
    if (cell === last || claimed.has(cell)) return;
    if (sel.length >= 2 && cell === sel[sel.length - 2]) {
      select(sel.slice(0, -1));
      d.moved = true;
      d.submitOnUp = false;
    } else if (!sel.includes(cell) && (sel.length === 0 || adjacent(last, cell))) {
      select([...sel, cell]);
      d.moved = true;
      d.submitOnUp = false;
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved && selRef.current.length > 1) submit(selRef.current);
    else if (d.submitOnUp) submit(selRef.current);
  };

  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (e.key in move) {
      e.preventDefault();
      const [dr, dc] = move[e.key];
      const r = Math.min(ROWS - 1, Math.max(0, rowOf(focusCell) + dr));
      const c = Math.min(COLS - 1, Math.max(0, colOf(focusCell) + dc));
      const next = r * COLS + c;
      setFocusCell(next);
      cellRefs.current[next]?.focus();
    } else if (e.key === "Escape") {
      select([]);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      select(selRef.current.slice(0, -1));
    }
  };

  // ---- hints ---------------------------------------------------------------

  const openHint = () => {
    if (finish || coach) return;
    const source = earned > 0 ? "earned" : coachLeft > 0 ? "coach" : null;
    if (!source) return;
    const ladder = hintLadder(puzzle, found);
    if (!ladder) return;
    dispatch({ type: "hint", source });
    track("hint_used", SLUG, { source, mode: game.mode });
    select([]);
    setCoach({ ladder, rung: 1 });
  };

  // The bonus hint opens as soon as the rewarded ad has been watched.
  useEffect(() => {
    if (!hintAfterAd || coachLeft === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, coachLeft]);

  const reveal = () => {
    if (!coach) return;
    dispatch({ type: "reveal", word: coach.ladder.word, at: Math.round(timer.now()) });
    setCoach({ ...coach, rung: 3 });
  };

  // Keyboard anywhere on the page: Enter submits the trace, Escape clears it.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      if (e.key === "Escape") select([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <WordHuntRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Solved! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const area = new Set(coach ? coach.ladder.area : []);
  const firstHint = coach && coach.rung >= 2 ? coach.ladder.first : -1;
  const selSet = new Set(selection);
  const traced = spell(puzzle.grid, selection);
  const hintSource = earned > 0 ? "earned" : coachLeft > 0 ? "coach" : null;
  const line = (path: number[]) => path.map((c) => `${(colOf(c) + 0.5) * 100},${(rowOf(c) + 0.5) * 100}`).join(" ");

  return (
    <GameShell
      tint={GAME.tint}
      title={game.mode === "practice" ? "Word Hunt" : "Daily Word Hunt"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>
            {state.found.length} of {puzzle.words.length} theme words
          </Chip>
        </>
      }
    >
      <div className="px-4">
        <div className="flex flex-col items-center gap-0.5 rounded-[18px] px-4 py-3 text-center text-[#111111]" style={{ background: GAME.color }}>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em]">Theme</span>
          <h2 className="m-0 font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{puzzle.title}</h2>
        </div>
      </div>

      <div className="flex h-9 items-center justify-center px-4" aria-live="polite">
        {selection.length ? (
          <span className="font-display text-[26px] font-extrabold tracking-[0.06em]">{traced}</span>
        ) : feedback ? (
          <span
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
            style={{
              background: feedback.tone === "span" ? SPAN_COLOR : feedback.tone === "good" ? THEME_COLOR : "var(--soft-2)",
              color: feedback.tone === "span" || feedback.tone === "good" ? "#111111" : "var(--ink)",
            }}
          >
            {feedback.text}
          </span>
        ) : (
          <span className="text-sm text-muted">Drag through touching letters, or tap them and tap the last one again.</span>
        )}
      </div>

      <div className="px-4">
        <div
          ref={boardRef}
          role="grid"
          aria-label="Word Hunt letters"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onGridKey}
          className="relative mx-auto grid w-full max-w-[400px] touch-none select-none grid-cols-6"
          style={{ aspectRatio: `${COLS} / ${ROWS}`, gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`, visibility: paused ? "hidden" : undefined }}
        >
          <svg aria-hidden="true" viewBox={`0 0 ${COLS * 100} ${ROWS * 100}`} className="pointer-events-none absolute inset-0 h-full w-full">
            {state.found.map((f) => {
              const w = puzzle.words[f.word];
              return (
                <polyline
                  key={f.word}
                  points={line(w.path)}
                  fill="none"
                  stroke={w.span ? SPAN_COLOR : THEME_COLOR}
                  strokeWidth={30}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
            {selection.length > 1 && (
              <polyline points={line(selection)} fill="none" stroke="var(--ink)" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
            )}
          </svg>
          {Array.from({ length: ROWS }, (_, r) => (
            <div key={r} role="row" className="contents">
              {Array.from({ length: COLS }, (_, c) => {
                const i = r * COLS + c;
                const letter = puzzle.grid[i];
                const owner = claimed.get(i);
                const w = owner !== undefined ? puzzle.words[owner] : null;
                const isSel = selSet.has(i);
                const inArea = area.has(i) && !w;
                const isFirst = i === firstHint && !w;
                const bg = isSel ? "var(--ink)" : w ? (w.span ? SPAN_COLOR : THEME_COLOR) : isFirst ? `color-mix(in srgb, ${COACH} 28%, var(--ground))` : "transparent";
                const ink = isSel ? "var(--ground)" : w ? "#111111" : "var(--ink)";
                return (
                  <button
                    key={i}
                    ref={(el) => {
                      cellRefs.current[i] = el;
                    }}
                    type="button"
                    role="gridcell"
                    tabIndex={i === focusCell ? 0 : -1}
                    aria-selected={isSel}
                    aria-label={`${letter}, row ${r + 1}, column ${c + 1}${w ? `, part of ${w.word}` : isSel ? ", selected" : ""}${inArea ? ", hint area" : ""}`}
                    onFocus={() => setFocusCell(i)}
                    // Pointer input is handled on the board (drag across cells); this is for Enter / Space.
                    onClick={(e) => {
                      if (e.detail !== 0) return;
                      if (tap(i) === "submit") submit(selRef.current);
                    }}
                    className="relative z-10 flex items-center justify-center p-0 outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-violet"
                  >
                    <span
                      className="flex aspect-square w-[74%] items-center justify-center rounded-full font-display text-[clamp(18px,5.6vw,26px)] font-bold uppercase leading-none transition-colors"
                      style={{
                        background: bg,
                        color: ink,
                        boxShadow: isFirst ? `0 0 0 3px ${COACH}` : inArea ? `0 0 0 2px ${COACH}` : undefined,
                        outline: inArea && !isFirst ? `2px dashed ${COACH}` : undefined,
                        outlineOffset: 3,
                      }}
                    >
                      {letter}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4">
        <div className="flex items-center justify-between gap-3 rounded-[18px] bg-soft px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Hint meter</span>
            <span className="flex gap-1.5" role="img" aria-label={`${meter(state)} of ${BONUS_PER_HINT} bonus words toward the next hint${earned ? `, ${earned} earned hint${earned === 1 ? "" : "s"} ready` : ""}`}>
              {Array.from({ length: BONUS_PER_HINT }, (_, k) => (
                <span key={k} className="h-2.5 w-9 rounded-full" style={{ background: k < meter(state) ? GAME.color : "var(--line-strong)" }} />
              ))}
            </span>
            <span className="text-xs text-muted">
              {earned ? `${earned} earned hint${earned === 1 ? "" : "s"} ready` : `Find ${BONUS_PER_HINT - meter(state)} more non-theme word${BONUS_PER_HINT - meter(state) === 1 ? "" : "s"} for a hint`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowBonus((v) => !v)}
            aria-expanded={showBonus}
            className="min-h-11 rounded-full border border-line-strong bg-ground px-3.5 text-sm font-semibold text-ink"
          >
            {state.bonus.length} bonus word{state.bonus.length === 1 ? "" : "s"}
          </button>
        </div>
        {showBonus && (
          <p className="m-0 mt-2 px-1 text-sm leading-relaxed text-muted">
            {state.bonus.length ? state.bonus.map((b) => b.toUpperCase()).join(" · ") : "Any real word of 4+ letters that isn't a theme word counts."}
          </p>
        )}
      </div>

      <div className="px-4">
        {coach ? (
          <CoachPanel coach={coach} onMore={() => setCoach({ ...coach, rung: 2 })} onReveal={reveal} onClose={() => setCoach(null)} />
        ) : (
          <CoachCard
            heading="Coach"
            tag={earned ? `${earned} earned · ${coachLeft} left` : coachLeft ? `${coachLeft} hint${coachLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              finish
                ? undefined
                : hintSource === "earned"
                  ? { label: "Use an earned hint", onClick: openHint }
                  : hintSource === "coach"
                    ? { label: "Get a hint", onClick: openHint }
                    : bonusOffer.ready
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
              : hintSource
                ? "Stuck? I’ll light up one theme word’s letters, then its first letter, then the word."
                : `Out of hints. Every ${BONUS_PER_HINT} bonus words you find earn another one.`}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-4">
        <ToolButton icon="erase" label="Clear" onClick={() => select([])} disabled={!selection.length} />
        <ToolButton icon="check" label="Submit" onClick={() => submit(selRef.current)} disabled={!selection.length} />
        <ToolButton icon="hint" label="Hint" accent onClick={openHint} disabled={!hintSource || !!coach || !!finish} />
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
              Practice themes
            </SheetButton>
          ) : (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                New practice theme
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Word Hunt
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

function feedbackFor(o: Outcome, puzzle: WordHuntPuzzle): Feedback {
  switch (o.kind) {
    case "theme":
      return o.span ? { text: `${puzzle.words[o.word].word} · span word!`, tone: "span" } : { text: `${puzzle.words[o.word].word} · theme word`, tone: "good" };
    case "bonus":
      return { text: o.earned ? `${o.word.toUpperCase()} · hint earned` : `${o.word.toUpperCase()} · bonus word`, tone: "info" };
    case "again":
      return { text: `${o.word} · already found`, tone: "info" };
    case "elsewhere":
      return { text: `${o.word} is a theme word, but not there`, tone: "info" };
    case "short":
      return { text: "Words need 4+ letters", tone: "bad" };
    case "unknown":
      return { text: `${o.word} · not in the word list`, tone: "bad" };
  }
}

/** Skills this hunt exercised (lib/games/kit/achievements SKILL_TREES["word-hunt"]). */
export function skillsOf(puzzle: WordHuntPuzzle, state: PlayState, timeMs: number): string[] {
  const skills = ["first-hunt"];
  const spanAt = state.found.findIndex((f) => puzzle.words[f.word].span);
  const span = state.found[spanAt];
  const helped = state.hints + state.earnedUsed > 0;
  if (span && !span.revealed) skills.push("span-solo");
  if (span && !span.revealed && spanAt < 3) skills.push("span-early");
  if (state.bonus.length >= BONUS_PER_HINT) skills.push("bonus-hint");
  if (state.bonus.length >= 10) skills.push("bonus-10");
  if (!helped) skills.push("unaided");
  if (timeMs < 240_000) skills.push("quick");
  if (!helped && state.misses === 0) skills.push("sharp");
  return skills;
}

function CoachPanel({ coach, onMore, onReveal, onClose }: { coach: Coach; onMore: () => void; onReveal: () => void; onClose: () => void }) {
  const { ladder, rung } = coach;
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag="Where to look" onClose={onClose} primary={{ label: "More help", onClick: onMore }}>
        {ladder.direction}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag="First letter" onClose={onClose} primary={{ label: "Show the word", onClick: onReveal }}>
        {ladder.specific}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag="The word" onClose={onClose} primary={{ label: "Got it", onClick: onClose }}>
      {ladder.answer}
    </CoachCard>
  );
}

// ---------------------------------------------------------------------------
// Recap
// ---------------------------------------------------------------------------

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

const LEARN = (
  <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
    <li>Hunt the span word first: it touches two opposite sides, so look for a long word running edge to edge. Once it’s found, the board splits into smaller areas.</li>
    <li>Work from the corners and edges. A corner letter has only three neighbors, so the word that uses it is easy to pin down.</li>
    <li>Every letter is used exactly once. When an area has, say, 11 letters left, it holds words that add up to 11.</li>
    <li>Short non-theme words are worth tracing: every three fill the hint meter.</li>
  </ul>
);

function WordHuntRecap({
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
  onPractice?: () => void;
}) {
  const puzzle = game.puzzle;
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const spanAt = state.found.findIndex((f) => puzzle.words[f.word].span);
  const span = state.found[spanAt];
  const spanWord = span ? puzzle.words[span.word].word : "";

  const coach = useMemo(() => {
    let keyMove: string;
    if (!span) keyMove = "you cleared the whole board.";
    else if (span.revealed) keyMove = `the coach showed you the span word, ${spanWord}. Next time hunt for a long word running edge to edge first: it splits the board.`;
    else
      keyMove = `at ${formatTime(span.at)} you found the span word ${spanWord}, your ${ordinal(spanAt + 1)} word.${spanAt < 3 ? " Finding it early maps out the whole board." : " Try spotting it sooner: once it’s found, the board splits into smaller areas."}`;
    const next = skillProgress(SLUG).find((s) => !s.mastered);
    return {
      keyMove,
      nextSkill: next ? `${next.skill.name}: ${next.skill.what.charAt(0).toLowerCase()}${next.skill.what.slice(1)}.` : "Every Word Hunt skill mastered. Try for a sharp-eyed hunt: no hints, no misses.",
      learn: { title: "Learn to hunt in 2 minutes", body: LEARN },
    };
  }, [span, spanAt, spanWord]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const imageParams = new URLSearchParams({
    g: SLUG,
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    m: "0",
    h: String(state.hints),
    bw: String(state.bonus.length),
    lv: game.mode === "practice" ? "Practice" : "Daily",
    map: shareMap(puzzle, state),
  });
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle ${game.mode === "practice" ? "Word Hunt practice" : "Word Hunt"} · ${short}`,
    `“${puzzle.title}”`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${state.hints} hint${state.hints === 1 ? "" : "s"} · ${state.bonus.length} bonus word${state.bonus.length === 1 ? "" : "s"}${span && !span.revealed ? ` · span word ${ordinal(spanAt + 1)}` : ""}`,
    "funzzle.com/play/word-hunt",
  ].join("\n");

  const details = (
    <section aria-label="Words found" className="flex flex-col gap-2.5 rounded-[20px] border border-line p-[18px]">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Theme</span>
      <span className="-mt-1.5 font-display text-xl font-bold tracking-[-0.01em]">{puzzle.title}</span>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {state.found.map((f, k) => {
          const w = puzzle.words[f.word];
          return (
            <li key={f.word} className="flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-[#111111]" style={{ background: w.span ? SPAN_COLOR : THEME_COLOR }}>
              <span className="flex items-center gap-2.5">
                <span className="w-5 font-mono text-sm">{k + 1}</span>
                <span className="font-semibold tracking-[0.04em]">{w.word}</span>
              </span>
              <span className="text-xs font-semibold">{[w.span ? "Span word" : null, f.revealed ? "Coach" : null, formatTime(f.at)].filter(Boolean).join(" · ")}</span>
            </li>
          );
        })}
      </ol>
      {state.bonus.length > 0 && (
        <p className="m-0 text-sm leading-relaxed text-muted">
          <strong className="text-ink">Bonus words:</strong> {state.bonus.map((b) => b.toUpperCase()).join(" · ")}
        </p>
      )}
    </section>
  );

  return (
    <Recap
      game={SLUG}
      heading={game.mode === "practice" ? "Word Hunt practice" : `Daily Word Hunt · ${short}${game.mode === "archive" ? " · archive" : ""}`}
      title="Solved."
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Hints", value: String(state.hints), note: state.earnedUsed ? `+${state.earnedUsed} earned` : `of ${MAX_HINTS} used`, good: !state.hints },
        { label: "Bonus words", value: String(state.bonus.length), note: state.bonus.length >= BONUS_PER_HINT ? `${Math.floor(state.bonus.length / BONUS_PER_HINT)} hint${state.bonus.length >= 2 * BONUS_PER_HINT ? "s" : ""} earned` : "Found", good: state.bonus.length >= BONUS_PER_HINT },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      details={details}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: practiceSeed(puzzle.id), level: "bank" } : { kind: "daily", date },
        label: game.mode === "practice" ? `Word Hunt practice · ${puzzle.title}` : `Daily Word Hunt · ${short}`,
        result: { timeMs: finish.timeMs, mistakes: 0, hints: state.hints },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game={SLUG} href="/play/word-hunt?practice=new" label="Play a practice theme" />}
    />
  );
}
