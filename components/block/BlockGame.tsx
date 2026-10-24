"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import {
  bestPlacement,
  canPlace,
  fitsAnywhere,
  DAILY_PIECES,
  isOver,
  isStuck,
  newGame,
  PIECES,
  piecesLeft,
  place,
  secondChance,
  sequence,
  sequenceDone,
  validSequence,
  SIZE,
  type Hint,
  type State,
} from "@/lib/games/block";
import { BLOCK_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { gameStats, recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatScore, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useLocal } from "@/lib/games/kit/useLocal";
import { useTimer } from "@/lib/games/kit/useTimer";
import {
  centeredAnchor,
  firstFit,
  ghostCells,
  liftedPosition,
  nudge,
  PIECE_COLORS,
  previewClears,
  skillsEarned,
  snapAnchor,
  whereText,
  type Ghost,
} from "./state";

const SLUG = "block-puzzle";
const GAME = GAME_BY_SLUG[SLUG];
const MAX_HINTS = 3;
const DAILY_KEY = (date: string) => `fz:block:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:block:archive:${date}`;
const PRACTICE_KEY = "fz:block:practice";
const readBest = () => gameStats(SLUG).bestScore ?? 0;

type Mode = "daily" | "practice" | "archive";

interface BestClear {
  /** Which piece of the game (1-based). */
  n: number;
  lines: number;
  points: number;
  at: number;
}

interface Saved {
  key: string;
  mode: Mode;
  /** The archive puzzle's date. */
  date?: string;
  challengeId?: string;
  seed: string;
  state: State;
  hints: number;
  elapsed: number;
  best?: BestClear;
  /** The player ended the game (stuck, out of pieces, or "End game"). */
  ended?: boolean;
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

export interface DailyBlockProps {
  seed: string;
  pieces: string[];
}

function fresh(mode: Mode, seed: string, pieces: string[] | null, extra: Partial<Saved> = {}): Saved {
  return { key: `${mode}:${seed}`, mode, seed, state: newGame(seed, pieces), hints: 0, elapsed: 0, ...extra };
}

export default function BlockGame({ date, daily }: { date: string; daily: DailyBlockProps }) {
  const dailyKey = `daily:${daily.seed}`;
  const [game, setGame] = useState<Saved>(() => fresh("daily", daily.seed, daily.pieces));
  const [loaded, setLoaded] = useState(false);

  const openDaily = useCallback(
    (challengeId?: string) => {
      const saved = readJson<Saved | null>(DAILY_KEY(date), null);
      const base = saved && saved.key === dailyKey ? saved : fresh("daily", daily.seed, daily.pieces);
      setGame(challengeId ? { ...base, challengeId } : base);
    },
    [date, dailyKey, daily.seed, daily.pieces]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    // "Play a practice game" on the recap loads ?practice=1 as a new page view.
    if (params.get("practice")) {
      history.replaceState(null, "", location.pathname);
      startPractice();
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== SLUG) throw new Error("not a block puzzle challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return setGame(fresh("practice", p.seed, null, { key: `${p.seed}:${challengeId}`, challengeId }));
          if (p.date === date) return openDaily(challengeId);
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily())
        .finally(() => setLoaded(true));
      return;
    } else if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      openArchive(archiveDate).finally(() => setLoaded(true));
      return;
    } else if (readJson<Mode | null>("fz:block:mode", null) === "practice") {
      const saved = readJson<Saved | null>(PRACTICE_KEY, null);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage / URL
      if (saved && !saved.done) setGame(saved);
      else openDaily();
    } else {
      openDaily();
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [date, dailyKey]);

  /** A past day's daily sequence: the stored one, or regenerated from its seed. */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setGame(saved);
    const res = await fetch(`/api/daily-puzzle?game=${SLUG}&date=${day}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return openDaily();
    const d = (await res.json()) as DailyBlockProps;
    const pieces = validSequence(d.pieces) ? d.pieces : sequence(d.seed, DAILY_PIECES);
    setGame(fresh("archive", d.seed, pieces, { key: `archive:${day}:${d.seed}`, date: day, challengeId }));
  }

  function startPractice() {
    countPractice(SLUG);
    const seed = `block-practice:${crypto.randomUUID()}`;
    const next = fresh("practice", seed, null);
    writeJson(PRACTICE_KEY, next);
    writeJson("fz:block:mode", "practice");
    setGame(next);
  }
  const resumePractice = () => {
    writeJson("fz:block:mode", "practice");
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice();
  };
  const backToDaily = () => {
    writeJson("fz:block:mode", "daily");
    openDaily();
  };

  return (
    <Board
      key={`${loaded}:${game.key}`}
      game={game}
      date={game.date ?? date}
      inert={!loaded}
      onPractice={startPractice}
      onResumePractice={resumePractice}
      onDaily={backToDaily}
    />
  );
}

interface Drag {
  slot: number;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  moved: boolean;
}

function Board({
  game,
  date,
  inert,
  onPractice,
  onResumePractice,
  onDaily,
}: {
  game: Saved;
  date: string;
  inert: boolean;
  onPractice: () => void;
  onResumePractice: () => void;
  onDaily: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const isDaily = game.mode !== "practice";
  const ranked = game.mode === "daily";
  const [state, setState] = useState<State>(game.state);
  const [hints, setHints] = useState(game.hints);
  const [best, setBest] = useState<BestClear | undefined>(game.best);
  const [ended, setEnded] = useState(!!game.ended);
  const [hint, setHint] = useState<Hint | null>(null);
  const [why, setWhy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [selected, setSelected] = useState<Ghost | null>(null);
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const over = isOver(state);
  const stuck = isStuck(state);
  const outOfHints = hints >= MAX_HINTS + bonusHints;
  const hintOffer = useRewardedOffer("block-extra-hint", SLUG, outOfHints && !over && !finish && !inert);
  // Second chance: offered once per game when the board is stuck, only if an ad is available.
  const canSecond = stuck && !state.secondChanceUsed && !ended && !finish && !inert;
  const secondOffer = useRewardedOffer("block-second-chance", SLUG, canSecond);
  const timer = useTimer(!inert && !paused && !over && !ended && !finish, game.elapsed);
  const started = useRef(false);
  const left = piecesLeft(state);
  const bestScore = useLocal(readBest, 0);

  // Board size follows the container width.
  const boardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(358);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const cell = width / SIZE;

  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Save progress on every change.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, hints, best, ended, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hints, ended, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", SLUG, { mode: game.mode });
  }, [inert, finish, game.mode]);

  // The game ends by itself when the daily's pieces run out, after a second
  // chance was used, or when no rewarded ad turns up for one.
  useEffect(() => {
    if (!over || ended || finish || inert) return;
    if (sequenceDone(state) || state.secondChanceUsed || secondOffer.settled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the end is detected from state
      setEnded(true);
    }
  }, [over, ended, finish, inert, state, secondOffer.settled]);

  // Finish: rank against today's players (by score), rating, stats and skills.
  useEffect(() => {
    if (!ended || finish || inert) return;
    const timeMs = Math.max(1000, Math.round(timer.now()));
    const score = state.score;
    track("game_complete", SLUG, { mode: game.mode, timeMs, score, pieces: state.placed, hints });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = isDaily ? date : `practice:${game.seed}`;
      const { rating, delta } =
        game.mode === "archive"
          ? { rating: getRating(SLUG).rating, delta: 0 }
          : recordMatch(SLUG, key, { puzzleRating: BLOCK_PUZZLE_RATING, won: true, percentile: percentile ?? undefined, hints, mistakes: 0 });
      recordFinish(SLUG, { won: true, score, hints, level: isDaily ? "daily" : "classic", skills: skillsEarned(state, { daily: isDaily, hints }) });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating, streak: getStreak().current });
    };
    // The end is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    if (ranked) {
      submitResult({ game: SLUG, date, timeMs, mistakes: 0, hints, moves: state.placed, score }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const play = useCallback(
    (slot: number, row: number, col: number) => {
      const s = stateRef.current;
      const id = s.tray[slot];
      if (!id || !canPlace(s.board, id, row, col)) return false;
      const res = place(s, slot, row, col);
      stateRef.current = res.state;
      setState(res.state);
      setSelected(null);
      setHint(null);
      setWhy(false);
      setNote(null);
      const n = res.rows.length + res.cols.length;
      if (n) {
        const cells = new Set<number>();
        for (const r of res.rows) for (let c = 0; c < SIZE; c++) cells.add(r * SIZE + c);
        for (const c of res.cols) for (let r = 0; r < SIZE; r++) cells.add(r * SIZE + c);
        setFlash(cells);
        setTimeout(() => setFlash(new Set()), 260);
        const gained = res.linePoints + res.comboBonus;
        setBest((b) => (!b || gained > b.points ? { n: res.state.placed, lines: n, points: gained, at: Math.round(timer.now()) } : b));
        setNote(
          `${n} line${n === 1 ? "" : "s"} cleared: +${res.points}${res.comboBonus ? ` (combo ×${res.state.combo})` : ""}.`
        );
      }
      return true;
    },
    [timer]
  );

  const showHint = () => {
    if (finish || over || ended) return;
    if (outOfHints) return;
    const h = bestPlacement(stateRef.current);
    if (!h) return;
    setHints((n) => n + 1);
    track("hint_used", SLUG, { reason: h.reason, mode: game.mode });
    setHint(h);
    setWhy(false);
    setSelected(null);
  };

  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    showHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  const takeSecondChance = async () => {
    if (!(await secondOffer.watch())) return;
    const next = secondChance(stateRef.current);
    stateRef.current = next;
    setState(next);
    setNote("Three rows cleared. Second chance used: make it count.");
  };

  // ----- Selection (tap / keyboard) -----
  const select = (slot: number) => {
    const id = state.tray[slot];
    if (!id || over || finish || ended) return;
    if (selected?.slot === slot) {
      setSelected(null);
      return;
    }
    setHint(null);
    setSelected({ slot, ...firstFit(state.board, id) });
  };
  const placeSelected = () => {
    if (!selected) return;
    if (!play(selected.slot, selected.row, selected.col)) setNote("That piece doesn’t fit there. Move it to an open spot.");
  };
  const tapCell = (index: number) => {
    if (!selected) return;
    const id = state.tray[selected.slot]!;
    const r = Math.floor(index / SIZE);
    const c = index % SIZE;
    if (ghostCells(id, selected.row, selected.col).includes(index) && canPlace(state.board, id, selected.row, selected.col)) {
      placeSelected();
      return;
    }
    setSelected({ slot: selected.slot, ...centeredAnchor(id, r, c) });
  };

  // ----- Drag and drop -----
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [dragView, setDragView] = useState<{ slot: number; left: number; top: number; anchor: { row: number; col: number } | null } | null>(null);

  const dragTo = (d: Drag, x: number, y: number) => {
    const id = stateRef.current.tray[d.slot];
    const rect = boardRef.current?.getBoundingClientRect();
    if (!id || !rect) return;
    const pos = liftedPosition(id, x, y, cell, d.touch);
    setDragView({ slot: d.slot, ...pos, anchor: snapAnchor(id, pos.left, pos.top, { left: rect.left, top: rect.top, cell }) });
  };
  const onTrayDown = (e: ReactPointerEvent, slot: number) => {
    if (paused || finish || over || ended || !state.tray[slot]) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { slot, pointerId: e.pointerId, touch: e.pointerType !== "mouse", startX: e.clientX, startY: e.clientY, moved: false };
  };
  const onTrayMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
      d.moved = true;
      setSelected(null);
      setHint(null);
    }
    if (d.moved) dragTo(d, e.clientX, e.clientY);
  };
  const onTrayUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    const view = dragView;
    setDragView(null);
    if (!d || !d.moved) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 50);
    const id = stateRef.current.tray[d.slot];
    const rect = boardRef.current?.getBoundingClientRect();
    if (!id || !rect) return;
    const pos = liftedPosition(id, e.clientX, e.clientY, cell, d.touch);
    const a = snapAnchor(id, pos.left, pos.top, { left: rect.left, top: rect.top, cell }) ?? view?.anchor ?? null;
    if (a && !play(d.slot, a.row, a.col)) setNote("That piece doesn’t fit there.");
  };

  // ----- Keyboard: 1–3 pick a piece, arrows move it, Enter places, H hint -----
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "1" || k === "2" || k === "3") {
        e.preventDefault();
        select(Number(k) - 1);
      } else if (k.toLowerCase() === "h") showHint();
      else if (k === "Escape") setSelected(null);
      else if (selected && k.startsWith("Arrow")) {
        e.preventDefault();
        const id = state.tray[selected.slot]!;
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k] ?? [0, 0];
        setSelected({ slot: selected.slot, ...nudge(id, selected, d[0], d[1]) });
      } else if (selected && (k === "Enter" || k === " ")) {
        if ((e.target as HTMLElement).closest("button") && k === " ") return;
        e.preventDefault();
        placeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <BlockRecap game={game} date={date} state={state} hints={hints} best={best} finish={finish} onClose={() => setShowRecap(false)} />;
  }
  if (showRecap) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center" style={{ background: GAME.tint }}>
        <p className="text-lg font-semibold text-[#111111]">Final score {formatScore(state.score)}. Comparing with today’s players…</p>
      </div>
    );
  }

  // What the board shows over the placed cells: a dragged / selected / coach ghost.
  const ghost: { id: string; row: number; col: number; kind: "drag" | "select" | "coach" } | null = dragView?.anchor
    ? { id: state.tray[dragView.slot]!, ...dragView.anchor, kind: "drag" }
    : selected
      ? { id: state.tray[selected.slot]!, row: selected.row, col: selected.col, kind: "select" }
      : hint
        ? { id: hint.pieceId, row: hint.row, col: hint.col, kind: "coach" }
        : null;
  const ghostSet = new Set(ghost ? ghostCells(ghost.id, ghost.row, ghost.col) : []);
  const ghostOk = !!ghost && canPlace(state.board, ghost.id, ghost.row, ghost.col);
  const clears = ghost && ghostOk ? previewClears(state.board, ghost.id, ghost.row, ghost.col) : { rows: [], cols: [] };
  const clearSet = new Set<number>();
  for (const r of clears.rows) for (let c = 0; c < SIZE; c++) clearSet.add(r * SIZE + c);
  for (const c of clears.cols) for (let r = 0; r < SIZE; r++) clearSet.add(r * SIZE + c);
  const ghostColor = ghost ? PIECE_COLORS[PIECES[ghost.id].color] : "";
  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - hints);
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? "Practice · endless"
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${DAILY_PIECES} pieces`;
  const status = ghost
    ? `${PIECES[ghost.id].name} at ${whereText(ghost.id, ghost.row, ghost.col)}: ${ghostOk ? (clears.rows.length + clears.cols.length ? `fits, clears ${clears.rows.length + clears.cols.length} line${clears.rows.length + clears.cols.length === 1 ? "" : "s"}` : "fits") : "doesn’t fit"}.`
    : "";
  const trayCell = Math.min(22, Math.floor((width - 16) / 3 / 5.4));

  return (
    <GameShell
      tint={GAME.tint}
      title={isDaily ? "Daily Block Puzzle" : "Block Puzzle"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Score {formatScore(state.score)}</Chip>
          {left !== null ? <Chip>Pieces left {left}</Chip> : <Chip>Best {formatScore(Math.max(bestScore, state.score))}</Chip>}
          {state.combo >= 2 && <Chip dark>Combo ×{state.combo}</Chip>}
        </>
      }
    >
      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div
          ref={boardRef}
          role="grid"
          aria-label={`Block Puzzle board, ${state.board.filter(Boolean).length} of 64 squares filled`}
          className="relative grid w-full touch-none select-none grid-cols-8 overflow-hidden rounded-[14px] border-2 border-ink p-[3px]"
          style={{ background: "color-mix(in srgb, #FFA978 16%, var(--ground))", aspectRatio: "1 / 1" }}
        >
          {state.board.map((v, i) => {
            const inGhost = ghostSet.has(i);
            const color = v
              ? PIECE_COLORS[v]
              : inGhost && ghostOk
                ? `color-mix(in srgb, ${ghostColor} ${ghost?.kind === "coach" ? 45 : 60}%, var(--ground))`
                : undefined;
            const willClear = clearSet.has(i);
            return (
              <div
                key={i}
                role="gridcell"
                aria-label={`Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: ${v ? "filled" : "empty"}`}
                onClick={() => tapCell(i)}
                className="m-[1.5px] rounded-[6px]"
                style={{
                  background: flash.has(i) ? "#FFFFFF" : (color ?? "color-mix(in srgb, #8b93b5 14%, var(--ground))"),
                  boxShadow: willClear
                    ? "inset 0 0 0 3px #111111"
                    : inGhost && !ghostOk && !v
                      ? "inset 0 0 0 2px #C8102E"
                      : inGhost && ghost?.kind === "coach"
                        ? "inset 0 0 0 3px #F26B1D"
                        : inGhost && ghost?.kind === "select"
                          ? "inset 0 0 0 3px #5B3DF5"
                          : v
                            ? "inset 0 -3px 0 rgba(0,0,0,0.14)"
                            : undefined,
                  outline: inGhost && v ? "2px solid #C8102E" : undefined,
                  outlineOffset: -2,
                  transition: "background-color 160ms",
                }}
              />
            );
          })}
        </div>
        <span className="sr-only" aria-live="polite">
          {status}
        </span>
      </div>

      {/* The tray: the three pieces in hand. */}
      <div className="grid grid-cols-3 gap-2 px-4" aria-label="Pieces in hand">
        {state.tray.map((id, slot) => {
          const p = id ? PIECES[id] : null;
          const fits = !!id && !over && fitsAnywhere(state.board, id);
          const isSel = selected?.slot === slot;
          const isHint = hint?.slot === slot;
          const lifted = dragView?.slot === slot;
          return (
            <button
              key={slot}
              type="button"
              disabled={!p || !!finish || ended}
              aria-pressed={isSel}
              aria-label={p ? `Piece ${slot + 1}: ${p.name}, ${p.cells.length} square${p.cells.length === 1 ? "" : "s"}${fits ? "" : ", doesn’t fit anywhere"}` : `Slot ${slot + 1}: placed`}
              onPointerDown={(e) => onTrayDown(e, slot)}
              onPointerMove={onTrayMove}
              onPointerUp={onTrayUp}
              onPointerCancel={() => {
                drag.current = null;
                setDragView(null);
              }}
              onClick={() => {
                if (suppressClick.current) return;
                select(slot);
              }}
              className="flex min-h-[108px] touch-none items-center justify-center rounded-[18px] bg-ground p-2 disabled:opacity-100"
              style={{
                boxShadow: isHint ? "0 0 0 3px #F26B1D" : isSel ? "0 0 0 3px #5B3DF5" : "0 0 0 1px color-mix(in srgb, #FFA978 40%, var(--line-strong))",
                opacity: lifted ? 0.25 : fits || !p ? 1 : 0.4,
              }}
            >
              {p && <PieceShape id={p.id} cell={trayCell} />}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="flex items-center gap-2 px-4">
          <span className="flex-1 text-[13px] font-semibold text-muted">Tap the board or use the arrow keys to move it.</span>
          <button type="button" onClick={placeSelected} className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-ground">
            Place
          </button>
          <button type="button" onClick={() => setSelected(null)} className="min-h-11 rounded-full border border-line-strong bg-ground px-4 text-sm font-semibold text-ink">
            Cancel
          </button>
        </div>
      )}

      <div className="px-4">
        {over && !ended && !finish ? (
          <CoachCard
            heading={stuck ? "No room left" : "All pieces placed"}
            tag={`Score ${formatScore(state.score)}`}
            primary={secondOffer.ready && canSecond ? { label: "Watch an ad: clear 3 rows", onClick: takeSecondChance } : { label: "See my score", onClick: () => setEnded(true) }}
            secondary={secondOffer.ready && canSecond ? { label: "End game", onClick: () => setEnded(true) } : undefined}
          >
            {secondOffer.ready && canSecond
              ? "None of your pieces fits. Want a second chance? A short ad clears three rows, once per game."
              : "None of your pieces fits anywhere."}
          </CoachCard>
        ) : hint ? (
          <CoachCard
            heading="Coach · Best spot"
            tag={hint.lines ? `Clears ${hint.lines}` : "Keeps it open"}
            onClose={() => setHint(null)}
            primary={{ label: "Place it", onClick: () => play(hint.slot, hint.row, hint.col) }}
            secondary={why ? undefined : { label: "Why this spot?", onClick: () => setWhy(true) }}
          >
            {hint.text}
            {why && <span className="mt-2 block">{hint.why}</span>}
          </CoachCard>
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              finish || ended
                ? undefined
                : hintsLeft
                  ? { label: "Show best spot", onClick: showHint }
                  : hintOffer.ready
                    ? {
                        label: "Watch an ad for one more hint",
                        onClick: async () => {
                          if (await hintOffer.watch()) {
                            setBonusHints((b) => b + 1);
                            setHintAfterAd(true);
                          }
                        },
                      }
                    : undefined
            }
          >
            {finish || ended
              ? "Game over. Open the recap to see how you did."
              : note ??
                (hintsLeft
                  ? "Drag a piece onto the board, or tap it and then tap where it goes. Stuck? I’ll try every order of your pieces and pick the spot that clears the most and keeps the board open."
                  : "Out of hints. Keep the middle open and avoid single-square holes.")}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-4">
        <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={showHint} disabled={!hintsLeft || over || ended || !!finish} />
        <ToolButton icon="close" label="Cancel" onClick={() => setSelected(null)} disabled={!selected} />
        <ToolButton icon="menu" label="Options" onClick={() => setPaused(true)} />
      </div>

      {finish && (
        <div className="px-4">
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-[#111111] text-base font-semibold text-white">
            See recap
          </button>
        </div>
      )}

      {dragView && state.tray[dragView.slot] && (
        <div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-50" style={{ transform: `translate(${dragView.left}px, ${dragView.top}px)` }}>
          <PieceShape id={state.tray[dragView.slot]!} cell={cell} lifted />
        </div>
      )}

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          {game.mode === "practice" ? (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice();
                }}
              >
                New practice game
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily();
                }}
              >
                Back to today’s Daily Block Puzzle
              </SheetButton>
            </>
          ) : (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice();
              }}
            >
              Practice games
            </SheetButton>
          )}
          {!ended && !finish && state.placed > 0 && (
            <SheetButton
              onClick={() => {
                setPaused(false);
                setEnded(true);
              }}
            >
              End game now · score {formatScore(state.score)}
            </SheetButton>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

/** A piece drawn from its cells (tray, and lifted while dragging). */
function PieceShape({ id, cell, lifted = false }: { id: string; cell: number; lifted?: boolean }) {
  const p = PIECES[id];
  const gap = lifted ? 3 : 2;
  return (
    <div className="relative" style={{ width: p.w * cell, height: p.h * cell, filter: lifted ? "drop-shadow(0 10px 14px rgba(0,0,0,0.28))" : undefined }}>
      {p.cells.map(([r, c]) => (
        <div
          key={`${r}-${c}`}
          className="absolute rounded-[5px]"
          style={{
            left: c * cell + gap / 2,
            top: r * cell + gap / 2,
            width: cell - gap,
            height: cell - gap,
            background: PIECE_COLORS[p.color],
            boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.14)",
          }}
        />
      ))}
    </div>
  );
}

function BlockRecap({
  game,
  date,
  state,
  hints,
  best,
  finish,
  onClose,
}: {
  game: Saved;
  date: string;
  state: State;
  hints: number;
  best?: BestClear;
  finish: Finish;
  onClose: () => void;
}) {
  const isDaily = game.mode !== "practice";
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const showTop = top !== null && game.mode === "daily";
  const params = new URLSearchParams({
    g: SLUG,
    d: date,
    t: String(finish.timeMs),
    sc: String(state.score),
    mv: String(state.placed),
    s: String(finish.streak),
    h: String(hints),
    lv: isDaily ? "Daily" : "Practice",
  });
  if (showTop) params.set("top", String(top));
  const text = [
    `Funzzle ${isDaily ? "Daily Block Puzzle" : "Block Puzzle practice"} · ${short}`,
    `${formatScore(state.score)} pts${showTop ? ` · Top ${Math.max(1, top!)}% today` : ""}`,
    `${state.lines} line${state.lines === 1 ? "" : "s"} · best combo ×${state.bestCombo} · ${hints} hint${hints === 1 ? "" : "s"}`,
    "funzzle.com/play/block-puzzle",
  ].join("\n");

  const allPlaced = isDaily && state.placed >= DAILY_PIECES;
  const keyMove = best
    ? `${best.at >= 1000 ? `at ${formatTime(best.at)}, ` : ""}piece ${best.n} cleared ${best.lines} line${best.lines === 1 ? "" : "s"} for ${best.points} points${best.lines >= 2 ? ", your biggest clear" : ""}.`
    : "you placed your pieces without clearing a line. Lines are where the points are: aim to finish a row or column every few pieces.";
  const nextSkill =
    state.maxLines < 2
      ? "Double clears. Build a row and a column that need the same last square: one piece then clears both for 30 points instead of 20."
      : state.bestCombo < 3
        ? "Combos. Keep two or three nearly full lines ready so pieces in a row each clear one: the bonus grows by 10 each time."
        : !allPlaced && isDaily
          ? `Place all ${DAILY_PIECES}. Keep room for the 3×3 square and the 5-long bars, so the awkward pieces always have a home.`
          : "Fewer holes. A single empty square only takes the 1-square piece: fill along edges and keep empty space in one block.";

  return (
    <Recap
      game={SLUG}
      heading={isDaily ? `Daily Block Puzzle · ${short}${game.mode === "archive" ? " · archive" : ""}` : "Block Puzzle practice"}
      title={allPlaced ? "All placed." : "Game over."}
      timeMs={finish.timeMs}
      score={state.score}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Lines", value: String(state.lines), note: `Best combo ×${state.bestCombo}`, good: state.bestCombo >= 3 },
        { label: "Pieces", value: String(state.placed), note: isDaily ? `of ${DAILY_PIECES}` : `${hints} hint${hints === 1 ? "" : "s"}`, good: allPlaced },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive games are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: isDaily ? { kind: "daily", date } : { kind: "practice", seed: game.seed, level: "classic" },
        label: isDaily ? `Daily Block Puzzle · ${short}` : "Block Puzzle practice",
        result: { timeMs: finish.timeMs, mistakes: 0, hints, moves: state.placed, score: state.score },
        activeId: game.challengeId,
      }}
      coach={{
        keyMove,
        nextSkill,
        learn: {
          title: "How the coach picks a spot",
          body: "It tries your pieces in every order and in their best spots, adds up the points each placement makes, then scores the board left behind: open squares are good, single holes and ragged edges are bad, and it keeps room for the 3×3 square and the 5-long bars.",
        },
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={<PracticeAction game={SLUG} href="/play/block-puzzle?practice=1" label="Play a practice game" />}
    />
  );
}
