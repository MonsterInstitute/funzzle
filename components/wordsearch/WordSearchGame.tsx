"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { WORD_SEARCH_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak, setStatus } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import {
  DIR_PHRASE,
  hardness,
  practiceWordSearch,
  wordCells,
  wordSearchHint,
  type WordSearchHint,
  type WordSearchPuzzle,
} from "@/lib/games/wordsearch";
import { dragCells, found, foundCount, initialState, isComplete, MAX_HINTS, reducer, solveSkills, type PlayState } from "./state";

type Mode = "daily" | "practice" | "archive";

interface Saved {
  key: string;
  mode: Mode;
  date?: string;
  challengeId?: string;
  seed: string;
  puzzle: WordSearchPuzzle;
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

const SLUG = "word-search";
const GAME = GAME_BY_SLUG[SLUG];
const SIZES = [10, 12, 15] as const;
const DAILY_KEY = (date: string) => `fz:word-search:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:word-search:archive:${date}`;
const PRACTICE_KEY = "fz:word-search:practice";
/** Highlight colors for found words (semi-transparent over the letters). */
const MARKERS = ["#FFD23F", "#9DB4FF", "#7FD6A0", "#FF9E9E", "#C9B8E8", "#6FD0E8", "#FFA978", "#B5E48C"];

type Coach = { hint: WordSearchHint; rung: 1 | 2 | 3 };

export default function WordSearchGame({ date, daily }: { date: string; daily: WordSearchPuzzle }) {
  const dailyKey = `${date}:${daily.grid}`;
  const fresh = (): Saved => ({ key: dailyKey, mode: "daily", seed: `word-search:${date}`, puzzle: daily, state: initialState(daily), elapsed: 0 });
  const [game, setGame] = useState<Saved>(fresh);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const want = Number(params.get("practice"));
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if ((SIZES as readonly number[]).includes(want)) {
      history.replaceState(null, "", location.pathname);
      startPractice(want);
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== SLUG) throw new Error("not a word search challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed, Number(p.level), challengeId);
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
    const res = await fetch(`/api/daily-puzzle?game=${SLUG}&date=${day}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res?.ok) return openDaily();
    const p = (await res.json()) as WordSearchPuzzle;
    setGame({ key: `archive:${day}`, mode: "archive", date: day, challengeId, seed: `word-search:${day}`, puzzle: p, state: initialState(p), elapsed: 0 });
  }

  function openPractice(seed: string, size: number, challengeId: string) {
    const p = practiceWordSearch(seed, (SIZES as readonly number[]).includes(size) ? size : 12);
    setGame({ key: `${seed}:${challengeId}`, mode: "practice", seed, challengeId, puzzle: p, state: initialState(p), elapsed: 0 });
  }

  function startPractice(size: number) {
    countPractice(SLUG);
    const seed = `word-search-practice:${crypto.randomUUID()}`;
    const p = practiceWordSearch(seed, size);
    const next: Saved = { key: seed, mode: "practice", seed, puzzle: p, state: initialState(p), elapsed: 0 };
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice(12);
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey ? saved : fresh());
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Board key={game.key} game={game} date={game.date ?? date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

function cellFromPoint(el: HTMLElement, size: number, x: number, y: number): number {
  const r = el.getBoundingClientRect();
  const col = Math.min(size - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * size)));
  const row = Math.min(size - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * size)));
  return row * size + col;
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
  onPractice?: (size: number) => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const p = game.puzzle;
  const size = p.size;
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer(reducer, game.state);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  // Selection: a drag in progress, or a tapped anchor waiting for the end square.
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  // The keyboard cursor ring shows only once the keyboard is used.
  const [kbd, setKbd] = useState(false);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const complete = isComplete(state);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("word-search-extra-hint", SLUG, outOfHints && !finish && !inert);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  const isFound = found(state);
  const rating = getRating(SLUG).rating;
  const sizeLabel = `${size}×${size}`;
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? `Practice · ${p.title}`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${p.title}`;

  // Save progress and the homepage's "In play" line.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    const n = foundCount(state);
    if (game.mode === "daily" && !finish && n > 0) {
      setStatus(SLUG, date, { state: "playing", meta: `${p.title} · ${n} of ${p.words.length} words · ${formatClock(timer.now())}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer.now is read on purpose without re-running every tick
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", SLUG, { mode: game.mode, size });
  }, [inert, finish, game.mode, size]);

  // Finish: rank against today's players, rating, stats and skills.
  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const base = { hints: state.hints, mistakes: 0 };
    track("game_complete", SLUG, { mode: game.mode, size, timeMs, hints: state.hints });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating(SLUG).rating, delta: 0 }
          : recordMatch(SLUG, key, { puzzleRating: WORD_SEARCH_PUZZLE_RATING[size] ?? 1150, won: true, percentile: percentile ?? undefined, ...base });
      recordFinish(SLUG, { won: true, timeMs, hints: state.hints, level: sizeLabel, skills: solveSkills(p, state, timeMs) });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
      setLoadingStats(false);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- completion is derived from state
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

  // The coach's word was found by the player: the ladder is done.
  useEffect(() => {
    if (coach && coach.rung < 3 && isFound[coach.hint.word]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closes the ladder once its word is found
      setCoach(null);
    }
  }, [coach, isFound]);

  const at = () => Math.round(timer.now());

  function commit(cells: number[]) {
    if (finish || cells.length < 2) return;
    dispatch({ type: "select", cells, at: at(), puzzle: p });
    const text = cells.map((i) => p.grid[i]).join("").toUpperCase();
    const hit = p.words.findIndex((w) => {
      const k = wordCells(size, w).join(",");
      return k === cells.join(",") || k === cells.slice().reverse().join(",");
    });
    if (hit >= 0 && !isFound[hit]) setFlash({ text: `Found ${p.words[hit].word.toUpperCase()}`, ok: true });
    else if (hit >= 0) setFlash({ text: `${p.words[hit].word.toUpperCase()} is already found`, ok: false });
    else setFlash({ text: `${text} isn’t on the list`, ok: false });
  }

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(id);
  }, [flash]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (inert || finish || paused || !gridRef.current) return;
    e.preventDefault();
    const c = cellFromPoint(gridRef.current, size, e.clientX, e.clientY);
    gridRef.current.setPointerCapture?.(e.pointerId);
    setDrag({ from: c, to: c });
    setCursor(c);
    setKbd(false);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || !gridRef.current) return;
    const c = cellFromPoint(gridRef.current, size, e.clientX, e.clientY);
    if (c !== drag.to) setDrag({ ...drag, to: c });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    if (from !== to) {
      setAnchor(null);
      commit(dragCells(size, from, to));
    } else if (anchor !== null && anchor !== from) {
      // Tap the first letter, then the last.
      commit(dragCells(size, anchor, from));
      setAnchor(null);
    } else {
      setAnchor(anchor === from ? null : from);
    }
  };

  const openHint = () => {
    if (finish || coach || outOfHints) return;
    const hint = wordSearchHint(p, isFound);
    if (!hint) return;
    dispatch({ type: "hint-used" });
    track("hint_used", SLUG, { mode: game.mode, dir: p.words[hint.word].dir });
    setCoach({ hint, rung: 1 });
  };
  const reveal = () => {
    if (!coach) return;
    dispatch({ type: "coach-find", word: coach.hint.word, at: at() });
    setCoach({ ...coach, rung: 3 });
  };

  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  // Keyboard: arrows move, Enter/Space marks the first then the last letter, Esc cancels, H hint.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (e.key in move) {
        if (!target.closest("[data-ws-grid]")) return;
        e.preventDefault();
        setKbd(true);
        const [dr, dc] = move[e.key];
        setCursor((c) => {
          const r = Math.min(size - 1, Math.max(0, Math.floor(c / size) + dr));
          const col = Math.min(size - 1, Math.max(0, (c % size) + dc));
          return r * size + col;
        });
      } else if ((e.key === "Enter" || e.key === " ") && target.closest("[data-ws-grid]")) {
        e.preventDefault();
        setKbd(true);
        if (anchor === null) setAnchor(cursor);
        else if (anchor === cursor) setAnchor(null);
        else {
          commit(dragCells(size, anchor, cursor));
          setAnchor(null);
        }
      } else if (e.key === "Escape") {
        setAnchor(null);
      } else if (e.key.toLowerCase() === "h") {
        openHint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selection = useMemo(() => {
    if (drag) return dragCells(size, drag.from, drag.to);
    if (anchor !== null) return [anchor];
    return [];
  }, [drag, anchor, size]);
  const selected = new Set(selection);

  if (showRecap && finish) {
    return <WordSearchRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">All found! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const coachCells = new Set<number>(coach ? (coach.rung === 1 ? [coach.hint.start] : coach.rung === 2 ? [coach.hint.start, coach.hint.next] : []) : []);
  const line = (cells: number[]) => {
    const a = cells[0];
    const b = cells[cells.length - 1];
    return { x1: (a % size) + 0.5, y1: Math.floor(a / size) + 0.5, x2: (b % size) + 0.5, y2: Math.floor(b / size) + 0.5 };
  };

  return (
    <GameShell
      tint={GAME.tint}
      title={game.mode === "practice" ? "Word Search" : "Daily Word Search"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>
            Found {foundCount(state)} / {p.words.length}
          </Chip>
          <Chip>{sizeLabel}</Chip>
        </>
      }
    >
      <div className="px-3">
        <div
          ref={gridRef}
          data-ws-grid
          role="grid"
          tabIndex={0}
          aria-label={`${p.title} letter grid, ${size} by ${size}. Drag across a word, or tap its first and last letters. With a keyboard: arrows move, Enter marks the first and last letter.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          className="relative touch-none select-none overflow-hidden rounded-[14px] border-2 border-ink bg-ground outline-offset-2 focus-visible:outline-2 focus-visible:outline-violet"
          style={{ visibility: paused ? "hidden" : undefined }}
        >
          <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 h-full w-full">
            {p.words.map((w, i) =>
              isFound[i] ? (
                <line
                  key={w.word}
                  {...line(wordCells(size, w))}
                  stroke={state.coached[i] ? "#F26B1D" : MARKERS[state.order.indexOf(i) % MARKERS.length]}
                  strokeOpacity={0.5}
                  strokeWidth={0.78}
                  strokeLinecap="round"
                />
              ) : null
            )}
            {selection.length > 1 && <line {...line(selection)} stroke="#5B3DF5" strokeOpacity={0.35} strokeWidth={0.82} strokeLinecap="round" />}
          </svg>
          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {Array.from({ length: size }, (_, row) => (
              <div key={row} role="row" className="contents">
                {Array.from({ length: size }, (_, col) => {
                  const i = row * size + col;
                  const isCoach = coachCells.has(i);
                  const isSel = selected.has(i);
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      aria-selected={i === cursor}
                      aria-label={`Row ${row + 1}, column ${col + 1}: ${p.grid[i].toUpperCase()}${anchor === i ? ", first letter marked" : ""}`}
                      className="flex aspect-square items-center justify-center font-mono font-semibold uppercase leading-none"
                      style={{
                        fontSize: size >= 15 ? "clamp(13px, 4vw, 19px)" : size >= 12 ? "clamp(15px, 4.6vw, 22px)" : "clamp(17px, 5.4vw, 25px)",
                        borderRadius: 999,
                        boxShadow: isCoach ? "inset 0 0 0 2.5px #F26B1D" : i === cursor && kbd ? "inset 0 0 0 2px var(--violet)" : anchor === i ? "inset 0 0 0 2px var(--violet)" : undefined,
                        background: isCoach ? "color-mix(in srgb, #F26B1D 18%, transparent)" : isSel ? "color-mix(in srgb, #5B3DF5 22%, transparent)" : undefined,
                      }}
                    >
                      {p.grid[i]}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p aria-live="polite" className={`m-0 mt-1.5 min-h-5 text-center text-sm font-semibold ${flash?.ok ? "text-success" : "text-muted"}`}>
          {flash?.text ?? (anchor !== null ? "Now tap the last letter" : "")}
        </p>
      </div>

      <section aria-label="Words to find" className="px-4">
        <ul className="m-0 flex list-none flex-wrap justify-center gap-x-3 gap-y-1.5 p-0">
          {p.words.map((w, i) => (
            <li
              key={w.word}
              className={`font-mono text-[15px] font-semibold uppercase tracking-[0.04em] ${isFound[i] ? "text-muted-2 line-through decoration-2" : "text-ink"}`}
              aria-label={`${w.word}${isFound[i] ? ", found" : ""}`}
            >
              {w.word}
            </li>
          ))}
        </ul>
      </section>

      <div className="px-4">
        {coach ? (
          <CoachPanel coach={coach} onMore={() => setCoach({ ...coach, rung: 2 })} onAnswer={reveal} onClose={() => setCoach(null)} hintsLeft={hintsLeft} />
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
              ? "All found. Open the recap to see how you did."
              : hintsLeft
                ? "Stuck? I’ll show where a word starts, then which way it runs, then circle it."
                : "You’ve used your hints. Try scanning for a word’s rarest letter, then look in all 8 directions around it."}
          </CoachCard>
        )}
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
              Practice grids
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
                    {s}×{s}
                  </button>
                ))}
              </div>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Daily Word Search
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

function CoachPanel({ coach, onMore, onAnswer, onClose, hintsLeft }: { coach: Coach; onMore: () => void; onAnswer: () => void; onClose: () => void; hintsLeft: number }) {
  const { hint, rung } = coach;
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag="Where it starts" onClose={onClose} primary={{ label: "More help", onClick: onMore }}>
        {hint.nudge}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag="Which way" onClose={onClose} primary={{ label: "Show the word", onClick: onAnswer }}>
        {hint.direction}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag="Circled" onClose={onClose} primary={{ label: "Got it", onClick: onClose }}>
      {hint.answer}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this grid.</span>}
    </CoachCard>
  );
}

const LEARN = {
  title: "Learn the rare-letter scan",
  body: (
    <>
      Don’t read the grid line by line. Pick a word, find its rarest letter (a J, K, Q, V, W, X, Y or Z, or a double letter), and look only at those squares. From each
      one, check the 8 neighbors for the next letter, then follow that direction. Backward and diagonal words hide best, so once the easy ones are gone, read each
      row right to left and each diagonal both ways.
    </>
  ),
};

function WordSearchRecap({
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
  onPractice?: (size: number) => void;
}) {
  const p = game.puzzle;
  const size = p.size;
  const sizeLabel = `${size}×${size}`;
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  const coach = useMemo(() => {
    const unaided = p.words.map((_, i) => i).filter((i) => state.foundAt[i] && !state.coached[i]);
    const helped = p.words.map((_, i) => i).filter((i) => state.coached[i]);
    let keyMove: string;
    if (unaided.length) {
      const k = unaided.reduce((a, b) => (hardness(p, b) > hardness(p, a) ? b : a));
      const w = p.words[k];
      keyMove = `at ${formatTime(state.foundAt[k])} you spotted ${w.word.toUpperCase()}, running ${DIR_PHRASE[w.dir]}: the hardest word to see in this grid.`;
    } else {
      keyMove = "the coach circled every word this time. Try finding the first one on your own next time.";
    }
    const tough = helped.length ? p.words[helped.reduce((a, b) => (hardness(p, b) > hardness(p, a) ? b : a))] : null;
    const nextSkill = tough
      ? `words that run ${DIR_PHRASE[tough.dir]}, like ${tough.word.toUpperCase()}. Scan each line in that direction once before asking for help.`
      : size < 15
        ? `a ${size === 10 ? "12×12" : "15×15"} grid. Bigger grids hide more backward and diagonal words.`
        : "speed. Try clearing a 12×12 in under 4 minutes.";
    return { keyMove, nextSkill, learn: LEARN };
  }, [p, size, state]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const lengths = state.order.map((i) => p.words[i].word.length).slice(0, 16);
  const imageParams = new URLSearchParams({
    g: SLUG,
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    m: "0",
    h: String(state.hints),
    lv: game.mode === "practice" ? `Practice ${size}x${size}` : `${size}x${size}`,
    wl: lengths.join(","),
  });
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle ${game.mode === "practice" ? "Word Search practice" : "Daily Word Search"} · ${short} · ${p.title}`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${p.words.length} words · ${state.hints} hint${state.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/word-search",
  ].join("\n");

  return (
    <Recap
      game={SLUG}
      heading={game.mode === "practice" ? `Word Search practice · ${sizeLabel}` : `Daily Word Search · ${short}${game.mode === "archive" ? " · archive" : ""}`}
      title="All found."
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Words", value: String(p.words.length), note: p.title },
        { label: "Hints", value: String(state.hints), note: state.hints ? `of ${MAX_HINTS} used` : "Unaided", good: !state.hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: game.seed, level: String(size) } : { kind: "daily", date },
        label: game.mode === "practice" ? `Word Search practice · ${sizeLabel}` : `Daily Word Search · ${short} · ${p.title}`,
        result: { timeMs: finish.timeMs, mistakes: 0, hints: state.hints },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game={SLUG} href={`/play/word-search?practice=${size}`} label={`Play a ${sizeLabel} practice grid`} />}
    />
  );
}
