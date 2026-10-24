"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import { Icon } from "@/components/kit/Icons";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { BANK, cellNumbers, crosswordHint, entriesOf, entryLabel, isBlack, practiceCrossword, type CrosswordHint, type CrosswordPuzzle, type Entry } from "@/lib/games/crossword";
import { CROSSWORD_PUZZLE_RATING } from "@/lib/games/dailySchedule";
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
import { helpCount, initialState, isComplete, isFull, locked, makeReducer, MARK, MAX_HINTS, shareMap, solveSkills, type PlayState } from "./state";

type Mode = "daily" | "practice" | "archive";
type Dir = "across" | "down";

interface Saved {
  key: string;
  mode: Mode;
  date?: string;
  challengeId?: string;
  /** Practice: the bank puzzle's index. */
  practice?: number;
  puzzle: CrosswordPuzzle;
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

const SLUG = "crossword";
const GAME = GAME_BY_SLUG[SLUG];
const DAILY_KEY = (date: string) => `fz:crossword:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:crossword:archive:${date}`;
const PRACTICE_KEY = "fz:crossword:practice";
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

type Coach = { hint: CrosswordHint; rung: 1 | 2 | 3 };

export default function CrosswordGame({ date, daily }: { date: string; daily: CrosswordPuzzle }) {
  const dailyKey = `${date}:${daily.grid}`;
  const fresh = (): Saved => ({ key: dailyKey, mode: "daily", puzzle: daily, state: initialState(daily.grid), elapsed: 0 });
  const [game, setGame] = useState<Saved>(fresh);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (want !== null) {
      history.replaceState(null, "", location.pathname);
      startPractice(/^\d+$/.test(want) ? Number(want) : undefined);
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== SLUG) throw new Error("not a crossword challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(Number(p.seed.split(":").at(-1)), challengeId);
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
    const p = (await res.json()) as CrosswordPuzzle;
    setGame({ key: `archive:${day}`, mode: "archive", date: day, challengeId, puzzle: p, state: initialState(p.grid), elapsed: 0 });
  }

  function openPractice(index: number, challengeId: string) {
    const p = practiceCrossword(Number.isFinite(index) ? index : 0);
    setGame({ key: `practice:${index}:${challengeId}`, mode: "practice", practice: index, challengeId, puzzle: p, state: initialState(p.grid), elapsed: 0 });
  }

  function startPractice(index?: number) {
    countPractice(SLUG);
    const last = readJson<Saved | null>(PRACTICE_KEY, null)?.practice;
    // The next bank puzzle after the last one played (or a random one), never today's daily.
    let n = index ?? (last !== undefined ? last + 1 : Math.floor(Math.random() * BANK.length));
    n = ((n % BANK.length) + BANK.length) % BANK.length;
    if (practiceCrossword(n).grid === daily.grid) n = (n + 1) % BANK.length;
    const p = practiceCrossword(n);
    const next: Saved = { key: `practice:${n}:${Date.now()}`, mode: "practice", practice: n, puzzle: p, state: initialState(p.grid), elapsed: 0 };
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice();
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey ? saved : fresh());
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
  const p = game.puzzle;
  const size = p.size;
  const grid = p.grid;
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const reducer = useMemo(() => makeReducer(grid), [grid]);
  const entries = useMemo(() => entriesOf(grid), [grid]);
  const numbers = useMemo(() => cellNumbers(grid), [grid]);
  const [state, dispatch] = useReducer(reducer, game.state);
  const [cell, setCell] = useState(() => [...grid].findIndex((ch) => ch !== "#"));
  const [dir, setDir] = useState<Dir>("across");
  const [pencil, setPencil] = useState(false);
  const [menu, setMenu] = useState<"check" | "reveal" | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const complete = isComplete(grid, state);
  const full = isFull(grid, state);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("crossword-extra-hint", SLUG, outOfHints && !finish && !inert);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  const rating = getRating(SLUG).rating;
  const sizeLabel = `${size}×${size}`;
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? `Practice · ${p.title}`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${sizeLabel}`;

  const entryAt = (c: number, d: Dir) => entries.find((e) => e.dir === d && e.cells.includes(c));
  const current: Entry | undefined = entryAt(cell, dir) ?? entryAt(cell, dir === "across" ? "down" : "across");
  const curDir: Dir = current?.dir ?? dir;
  const crossing = entryAt(cell, curDir === "across" ? "down" : "across");
  const at = () => Math.round(timer.now());

  // Save progress and the homepage's "In play" line.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    const filled = state.values.filter(Boolean).length;
    const white = [...grid].filter((ch) => ch !== "#").length;
    if (game.mode === "daily" && !finish && filled > 0) {
      setStatus(SLUG, date, { state: "playing", meta: `${sizeLabel} · ${white - filled} squares left · ${formatClock(timer.now())}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer.now is read on purpose without re-running every tick
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", SLUG, { mode: game.mode, size });
  }, [inert, finish, game.mode, size]);

  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const base = { hints: helpCount(state), mistakes: state.wrong };
    track("game_complete", SLUG, { mode: game.mode, size, timeMs, ...base });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.practice}:${game.key}`;
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating(SLUG).rating, delta: 0 }
          : recordMatch(SLUG, key, { puzzleRating: CROSSWORD_PUZZLE_RATING[size] ?? 1300, won: true, percentile: percentile ?? undefined, ...base });
      recordFinish(SLUG, { won: true, timeMs, hints: base.hints, level: sizeLabel, skills: solveSkills(grid, size, state, timeMs) });
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

  // ---- navigation -------------------------------------------------------
  const select = (c: number, d?: Dir) => {
    if (c < 0 || isBlack(grid, c)) return;
    if (d) setDir(d);
    else if (c === cell) setDir((x) => (entryAt(c, x === "across" ? "down" : "across") ? (x === "across" ? "down" : "across") : x));
    else if (!entryAt(c, dir)) setDir(dir === "across" ? "down" : "across");
    setCell(c);
    setMenu(null);
  };
  const firstOpen = (e: Entry) => e.cells.find((i) => !state.values[i]) ?? e.cells[0];
  const gotoEntry = (e: Entry) => {
    setDir(e.dir);
    setCell(firstOpen(e));
  };
  const stepEntry = (delta: 1 | -1) => {
    if (!current) return;
    const k = entries.indexOf(current);
    gotoEntry(entries[(k + delta + entries.length) % entries.length]);
  };
  const advance = (from: number) => {
    if (!current) return;
    const k = current.cells.indexOf(from);
    // Next empty square in the word, else the next square, else the next word.
    const rest = current.cells.slice(k + 1);
    const next = rest.find((i) => !state.values[i] && !locked(state, i)) ?? rest[0];
    if (next !== undefined) setCell(next);
  };
  const type = (letter: string) => {
    if (finish || !current || cell < 0) return;
    const c = cell;
    if (!locked(state, c)) dispatch({ type: "input", cell: c, letter, pencil, at: at() });
    if (coach?.rung === 3) setCoach(null);
    advance(c);
  };
  const back = () => {
    if (finish || !current) return;
    if (state.values[cell] && !locked(state, cell)) {
      dispatch({ type: "erase", cell });
      return;
    }
    const k = current.cells.indexOf(cell);
    if (k > 0) {
      const prev = current.cells[k - 1];
      setCell(prev);
      if (!locked(state, prev)) dispatch({ type: "erase", cell: prev });
    }
  };
  const moveArrow = (dr: number, dc: number) => {
    const want: Dir = dr ? "down" : "across";
    if (want !== curDir && entryAt(cell, want)) {
      setDir(want);
      return;
    }
    let r = Math.floor(cell / size) + dr;
    let c = (cell % size) + dc;
    while (r >= 0 && c >= 0 && r < size && c < size) {
      const i = r * size + c;
      if (!isBlack(grid, i)) {
        setCell(i);
        return;
      }
      r += dr;
      c += dc;
    }
  };

  // ---- check / reveal / coach -------------------------------------------
  const scope = (what: "square" | "word" | "puzzle") =>
    what === "square" ? [cell] : what === "word" ? (current?.cells ?? []) : [...grid].map((_, i) => i).filter((i) => !isBlack(grid, i));
  const doCheck = (what: "square" | "word" | "puzzle") => {
    dispatch({ type: "check", cells: scope(what) });
    track("hint_used", SLUG, { kind: `check-${what}`, mode: game.mode });
    setMenu(null);
  };
  const doReveal = (what: "square" | "word" | "puzzle") => {
    dispatch({ type: "reveal", cells: scope(what), at: at() });
    track("hint_used", SLUG, { kind: `reveal-${what}`, mode: game.mode });
    setMenu(null);
  };
  const openHint = () => {
    if (finish || coach || outOfHints) return;
    const hint = crosswordHint(p, state.values);
    if (!hint) return;
    dispatch({ type: "hint-used" });
    track("hint_used", SLUG, { kind: "coach", mode: game.mode });
    setCoach({ hint, rung: 1 });
    setDir(hint.entry.dir);
    setCell(firstOpen(hint.entry));
  };
  const coachMore = () => {
    if (!coach) return;
    setCoach({ ...coach, rung: 2 });
    setCell(coach.hint.cell);
    setDir(coach.hint.entry.dir);
  };
  const coachReveal = () => {
    if (!coach) return;
    dispatch({ type: "coach-reveal", cell: coach.hint.cell, at: at() });
    setCell(coach.hint.cell);
    setCoach({ ...coach, rung: 3 });
  };

  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  // Physical keyboard.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        type(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        back();
      } else if (e.key in arrows) {
        e.preventDefault();
        moveArrow(...arrows[e.key]);
      } else if (e.key === " ") {
        e.preventDefault();
        if (entryAt(cell, curDir === "across" ? "down" : "across")) setDir(curDir === "across" ? "down" : "across");
      } else if ((e.key === "Tab" && (target === document.body || target.closest("[role=grid]"))) || e.key === "Enter") {
        if (e.key === "Enter" && target.closest("button") && !target.closest("[role=grid]")) return;
        e.preventDefault();
        stepEntry(e.shiftKey ? -1 : 1);
      } else if (e.key === ".") {
        setPencil((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <CrosswordRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Solved! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const inWord = new Set(current?.cells ?? []);
  const coachCells = new Set<number>(coach ? (coach.rung === 1 ? coach.hint.entry.cells : coach.rung === 2 ? [coach.hint.cell] : []) : []);
  const clueOf = (e?: Entry) => (e ? p.clues[e.id] ?? "" : "");
  const across = entries.filter((e) => e.dir === "across");
  const down = entries.filter((e) => e.dir === "down");

  const gridEl = (
    <div
      role="grid"
      aria-label={`Crossword grid, ${size} by ${size}`}
      // The board stays paper-white with black squares in both themes, like print.
      className="grid select-none overflow-hidden rounded-[14px] border-2 border-[#111111] bg-[#111111] text-[#111111]"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: 1, visibility: paused ? "hidden" : undefined }}
    >
      {Array.from({ length: size }, (_, row) => (
        <div key={row} role="row" className="contents">
          {Array.from({ length: size }, (_, col) => {
            const i = row * size + col;
            if (isBlack(grid, i)) return <div key={i} role="gridcell" aria-label="Black square" className="aspect-square bg-[#111111]" />;
            const v = state.values[i];
            const mark = state.marks[i];
            const isSel = i === cell;
            const bg = isSel
              ? "#FFD23F"
              : coachCells.has(i)
                ? "color-mix(in srgb, #F26B1D 24%, #FFFFFF)"
                : inWord.has(i)
                  ? "color-mix(in srgb, #9DB4FF 42%, #FFFFFF)"
                  : "#FFFFFF";
            const status = mark === MARK.wrong ? ", marked wrong" : mark === MARK.revealed ? ", revealed" : mark === MARK.right ? ", checked" : state.pencil[i] && v ? ", pencil" : "";
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${numbers[i] ? `${numbers[i]}, ` : ""}row ${row + 1}, column ${col + 1}: ${v ? v.toUpperCase() : "empty"}${status}`}
                onClick={() => select(i)}
                className="relative flex aspect-square items-center justify-center p-0"
                style={{ background: bg }}
              >
                {numbers[i] > 0 && (
                  <span className="absolute left-[2px] top-[1px] font-mono leading-none" style={{ fontSize: size >= 15 ? "clamp(6px,1.6vw,9px)" : "clamp(7px,2vw,10px)" }}>
                    {numbers[i]}
                  </span>
                )}
                <span
                  className={`font-display font-bold uppercase leading-none ${mark === MARK.wrong ? "text-[#C8102E]" : state.pencil[i] ? "italic text-[#6B6B78]" : mark === MARK.revealed ? "text-[#3A22C9]" : ""}`}
                  style={{ fontSize: size >= 15 ? "clamp(12px,3.6vw,20px)" : size >= 13 ? "clamp(14px,4.2vw,22px)" : "clamp(16px,5vw,26px)" }}
                >
                  {v}
                </span>
                {mark === MARK.wrong && <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top right, transparent 47%, #C8102E 48%, #C8102E 52%, transparent 53%)" }} />}
                {mark === MARK.revealed && <span aria-hidden="true" className="absolute right-0 top-0 h-0 w-0 border-l-[7px] border-t-[7px] border-l-transparent border-t-[#5B3DF5]" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const clueBar = (
    <div className="flex items-stretch gap-1 rounded-2xl bg-[color-mix(in_srgb,#9DB4FF_32%,var(--ground))]">
      <button type="button" aria-label="Previous clue" onClick={() => stepEntry(-1)} className="flex min-h-[52px] w-11 shrink-0 items-center justify-center text-ink">
        <Icon name="back" />
      </button>
      <button
        type="button"
        onClick={() => crossing && setDir(curDir === "across" ? "down" : "across")}
        aria-label={`${current ? entryLabel(current) : ""}: ${clueOf(current)}. Tap to switch direction`}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left text-ink"
      >
        <span className="shrink-0 font-mono text-sm font-semibold">{current ? `${current.num}${current.dir === "across" ? "A" : "D"}` : ""}</span>
        <span className="text-[15px] leading-snug">{clueOf(current)}</span>
      </button>
      <button type="button" aria-label="Next clue" onClick={() => stepEntry(1)} className="flex min-h-[52px] w-11 shrink-0 rotate-180 items-center justify-center text-ink">
        <Icon name="back" />
      </button>
    </div>
  );

  const clueList = (title: string, list: Entry[]) => (
    <section aria-label={`${title} clues`} className="flex min-h-0 flex-col">
      <h2 className="m-0 mb-1.5 font-display text-base font-bold">{title}</h2>
      <ol className="m-0 flex list-none flex-col gap-0.5 overflow-y-auto p-0 lg:max-h-[560px]">
        {list.map((e) => {
          const active = current?.id === e.id;
          const cross = crossing?.id === e.id;
          const solved = e.cells.every((i) => state.values[i]);
          return (
            <li key={e.id}>
              <button
                type="button"
                ref={(el) => {
                  if (active && el) el.scrollIntoView?.({ block: "nearest" });
                }}
                onClick={() => gotoEntry(e)}
                className={`flex w-full gap-2 rounded-lg px-2 py-1 text-left text-sm ${active ? "bg-[color-mix(in_srgb,#9DB4FF_42%,var(--ground))]" : cross ? "bg-soft" : ""} ${solved && !active ? "text-muted-2" : "text-ink"}`}
              >
                <span className="w-6 shrink-0 text-right font-mono font-semibold">{e.num}</span>
                <span>{p.clues[e.id]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <GameShell
      tint={GAME.tint}
      title={game.mode === "practice" ? "Crossword" : "Daily Crossword"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      maxWidth={1000}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>{sizeLabel}</Chip>
          <Chip dark={pencil} onClick={() => setPencil((v) => !v)} pressed={pencil}>
            Pencil {pencil ? "on" : "off"}
          </Chip>
        </>
      }
    >
      <div className="flex flex-col gap-3 px-3 lg:flex-row lg:items-start lg:gap-6 lg:px-6">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 lg:mx-0 lg:w-[520px] lg:shrink-0">
          {gridEl}
          {clueBar}
          {/* On-screen keyboard (phones and tablets; desktops type). */}
          <div className="flex flex-col gap-1.5 lg:hidden" aria-label="Keyboard" role="group">
            {KEYS.map((row, r) => (
              <div key={row} className="flex justify-center gap-1">
                {r === 2 && (
                  <button type="button" aria-label="Switch direction" onClick={() => crossing && setDir(curDir === "across" ? "down" : "across")} className="flex min-h-12 flex-[1.5] items-center justify-center rounded-lg bg-soft-2 text-xs font-semibold text-ink">
                    {curDir === "across" ? "↓" : "→"}
                  </button>
                )}
                {[...row].map((k) => (
                  <button key={k} type="button" onClick={() => type(k)} className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-soft-2 font-display text-lg font-bold uppercase text-ink">
                    {k}
                  </button>
                ))}
                {r === 2 && (
                  <button type="button" aria-label="Delete" onClick={back} className="flex min-h-12 flex-[1.5] items-center justify-center rounded-lg bg-soft-2 text-ink">
                    <Icon name="erase" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {full && !complete && (
            <p className="m-0 rounded-2xl bg-soft px-4 py-2 text-sm text-muted">Every square is filled, but some letters are off. Check the puzzle to find them.</p>
          )}
          {menu ? (
            <div className="grid grid-cols-4 gap-2" role="group" aria-label={menu === "check" ? "Check" : "Reveal"}>
              {(["square", "word", "puzzle"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => (menu === "check" ? doCheck(w) : doReveal(w))}
                  className="min-h-[52px] rounded-[14px] bg-ink text-sm font-semibold capitalize text-ground"
                >
                  {menu} {w}
                </button>
              ))}
              <button type="button" onClick={() => setMenu(null)} className="min-h-[52px] rounded-[14px] bg-soft-2 text-sm font-semibold text-ink">
                Cancel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <ToolButton icon="notes" label="Pencil" active={pencil} onClick={() => setPencil((v) => !v)} />
              <ToolButton icon="check" label="Check" onClick={() => setMenu("check")} disabled={!!finish} />
              <ToolButton icon="search" label="Reveal" onClick={() => setMenu("reveal")} disabled={!!finish} />
              <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={openHint} disabled={!hintsLeft || !!coach || !!finish} />
            </div>
          )}
          {coach ? (
            <CoachPanel coach={coach} onMore={coachMore} onAnswer={coachReveal} onClose={() => setCoach(null)} hintsLeft={hintsLeft} />
          ) : (
            outOfHints &&
            !finish &&
            bonusOffer.ready && (
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
                    ? "Stuck? I’ll point you to the easiest clue, then show its pattern with a crossing, then fill one letter."
                    : "You’ve used your hints. Check and Reveal still work: they count as help in your result."}
              </CoachCard>
            )
          )}
          {finish && (
            <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-ink text-base font-semibold text-ground">
              See recap
            </button>
          )}
        </div>
        <div className="hidden min-w-0 flex-1 grid-cols-2 gap-4 lg:grid">
          {clueList("Across", across)}
          {clueList("Down", down)}
        </div>
      </div>

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          {game.mode === "daily" ? (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice?.();
              }}
            >
              Practice crosswords
            </SheetButton>
          ) : (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                Next practice crossword
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Daily Crossword
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
  const tag = entryLabel(hint.entry);
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }}>
        {hint.nudge}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={{ label: "Show a letter", onClick: onAnswer }}>
        {hint.detail}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: "Got it", onClick: onClose }}>
      {hint.answer}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this puzzle.</span>}
    </CoachCard>
  );
}

const LEARN = {
  title: "Learn how to crack a crossword",
  body: (
    <>
      Start with the fill-in-the-blank clues and the three- and four-letter answers: they’re the easiest to be sure of. Every letter you place is a free hint for the
      crossing answer, so work outward from what you know. Match the clue’s form: a plural clue has a plural answer, a past-tense clue a past-tense answer. A question
      mark means wordplay. Use pencil for guesses and ink for certainties.
    </>
  ),
};

function CrosswordRecap({
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
  const p = game.puzzle;
  const size = p.size;
  const sizeLabel = `${size}×${size}`;
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const help = helpCount(state);

  const coach = useMemo(() => {
    const entries = entriesOf(p.grid);
    const clean = entries.filter((e) => state.doneAt[e.id] && !e.cells.some((i) => state.marks[i] === MARK.revealed));
    const best = clean.sort((a, b) => b.cells.length - a.cells.length || state.doneAt[a.id] - state.doneAt[b.id])[0];
    const keyMove = best
      ? `at ${formatTime(state.doneAt[best.id])} you filled ${entryLabel(best)}, ${best.cells
          .map((i) => p.grid[i])
          .join("")
          .toUpperCase()} (“${p.clues[best.id]}”), the longest answer you got without help.`
      : "the reveals carried this one. Next time try the short answers first and let the crossings do the work.";
    const nextSkill = help
      ? `a clean solve: no check, reveal or hints. Pencil in your guesses instead and let the crossings confirm them.`
      : size === 11
        ? "a 13×13 grid: Thursday’s and Friday’s puzzles are bigger, with longer answers."
        : size === 13
          ? "the 15×15 weekend grid, with up to 80 answers."
          : "speed. Try an 11×11 in under 8 minutes.";
    return { keyMove, nextSkill, learn: LEARN };
  }, [p, state, help, size]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const imageParams = new URLSearchParams({
    g: SLUG,
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    m: String(state.wrong),
    h: String(help),
    lv: game.mode === "practice" ? `Practice ${size}x${size}` : `${size}x${size}`,
    cw: shareMap(p.grid, state),
  });
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle ${game.mode === "practice" ? "Crossword practice" : "Daily Crossword"} · ${short} · ${sizeLabel}`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    help ? `${help} hint${help === 1 ? "" : "s"} (check, reveal or coach)` : "Clean solve: no hints",
    "funzzle.com/play/crossword",
  ].join("\n");

  return (
    <Recap
      game={SLUG}
      heading={game.mode === "practice" ? `Crossword practice · ${sizeLabel}` : `Daily Crossword · ${short}${game.mode === "archive" ? " · archive" : ""}`}
      title="Solved."
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Grid", value: sizeLabel, note: `${entriesOf(p.grid).length} clues` },
        { label: "Help", value: String(help), note: help ? "Check, reveal, hints" : "Clean solve", good: !help },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: `crossword-practice:${game.practice ?? 0}`, level: String(size) } : { kind: "daily", date },
        label: game.mode === "practice" ? `Crossword practice · ${p.title}` : `Daily Crossword · ${short} · ${sizeLabel}`,
        result: { timeMs: finish.timeMs, mistakes: state.wrong, hints: help },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game={SLUG} href="/play/crossword?practice=next" label="Play a practice crossword" />}
    />
  );
}
