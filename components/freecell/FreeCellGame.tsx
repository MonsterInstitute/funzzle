"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import { Icon } from "@/components/kit/Icons";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import SuitIcon from "@/components/kit/SuitIcon";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import {
  applyMove,
  autoMoves,
  bestMove,
  cardLabel,
  deal,
  describeMove,
  emptyColumns,
  isWon,
  rememberWinningLine,
  runLength,
  solve,
  SUITS,
  type Card,
  type Hint,
  type Move,
  type State,
} from "@/lib/games/freecell";
import { FREECELL_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import type { DailyFreeCell } from "@/lib/games/dailyPuzzles";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getStreak } from "@/lib/games/kit/daily";
import { recordFinish } from "@/lib/games/kit/achievements";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { computeLayout, samePile, type CardPos, type PileId } from "./layout";
import { autoMove, canAutoFinish, cardsHome, cellsInUse, finishMoves, moveFor, runTooLong, tapTooLong, tooLongMessage, winSkills, type Pick } from "./moves";

type Mode = "daily" | "practice";

/** Coach hints per deal before the rewarded offer (see showHint). */
const FREE_HINTS = 3;
/** Undos on today's ranked daily deal before the rewarded offer (see undo). */
const FREE_UNDOS = 3;

interface Saved {
  key: string;
  mode: Mode;
  /** A past day's daily deal (/archive): unranked. */
  archive?: boolean;
  /** The puzzle's date when it isn't today's (archive). */
  date?: string;
  /** Opened from a friend's challenge link (lib/games/kit/challenge.ts). */
  challengeId?: string;
  seed: string;
  /** Solver-verified winnable (always true for daily deals). */
  verified: boolean;
  state: State;
  /** Moves the player made (the engine's count also includes auto-moves home). */
  moves: number;
  elapsed: number;
  hints: number;
  undos: number;
  /** Extra hints / undos earned from rewarded ads. */
  bonusHints?: number;
  bonusUndos?: number;
  /** Most free cells in use at once (never goes down, even after an undo). */
  peakCells?: number;
  /** Longest run moved in one go. */
  longestRun?: number;
  /** Elapsed ms when a column first became empty. */
  firstEmptyAt?: number;
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

/** A position plus the player's move count, as kept in the undo history. */
interface Board {
  state: State;
  moves: number;
}

const GAME = GAME_BY_SLUG.freecell;
const KEY = (mode: Mode, date: string, archive = false) =>
  mode === "practice" ? "fz:freecell:practice" : archive ? `fz:freecell:archive:${date}` : `fz:freecell:daily:${date}`;
const MODE_KEY = "fz:freecell:mode";

function freshDaily(d: DailyFreeCell): Saved {
  return { key: `${d.date}:${d.seed}`, mode: "daily", seed: d.seed, verified: true, state: d.state, moves: 0, elapsed: 0, hints: 0, undos: 0 };
}

export default function FreeCellGame({ date, daily }: { date: string; daily: DailyFreeCell }) {
  const [game, setGame] = useState<Saved>(() => freshDaily(daily));
  const [loaded, setLoaded] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  const openDaily = useCallback(() => {
    const fresh = freshDaily(daily);
    const saved = readJson<Saved | null>(KEY("daily", date), null);
    setGame(saved && saved.key === fresh.key ? saved : fresh);
  }, [daily, date]);

  useEffect(() => {
    // The server's verified solution lets the coach answer instantly from the start.
    rememberWinningLine(daily.state, daily.solution);
    const last = readJson<Mode | null>(MODE_KEY, null);
    // "Deal a practice game" on the recap loads /play/freecell?practice=1 as a
    // new page view (components/kit/PracticeAction).
    const params = new URLSearchParams(location.search);
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (challengeId) {
      // A friend's challenge: the same deal they played.
      fetchChallenge(challengeId)
        .then(async (c) => {
          if (c.game !== "freecell") throw new Error("not a freecell challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPracticeSeed(p.seed, challengeId);
          if (p.date === date) {
            const saved = readJson<Saved | null>(KEY("daily", date), null);
            const fresh = freshDaily(daily);
            return setGame({ ...(saved && saved.key === fresh.key ? saved : fresh), challengeId });
          }
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily())
        .finally(() => setLoaded(true));
      return;
    }
    if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      openArchive(archiveDate).finally(() => setLoaded(true));
      return;
    }
    if (params.get("practice")) {
      history.replaceState(null, "", location.pathname);
      newPractice();
    } else if (last === "practice") {
      const saved = readJson<Saved | null>(KEY("practice", date), null);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage
      if (saved && !saved.done) setGame(saved);
      else openDaily();
    } else {
      openDaily();
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [daily, date, openDaily]);

  /** A past day's daily deal: the stored one, or regenerated from its seed. */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(KEY("daily", day, true), null);
    if (saved && !challengeId) return setGame(saved);
    const res = await fetch(`/api/daily-puzzle?game=freecell&date=${day}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return openDaily();
    const d = (await res.json()) as DailyFreeCell;
    rememberWinningLine(d.state, d.solution);
    setGame({ ...freshDaily(d), key: `archive:${day}:${d.seed}`, archive: true, date: day, challengeId });
  }

  function openPracticeSeed(seed: string, challengeId: string) {
    const state = deal(seed);
    const verified = solve(state, { maxNodes: 60_000 }).result === "win";
    setGame({ key: `${seed}:${challengeId}`, mode: "practice", seed, verified, state, moves: 0, elapsed: 0, hints: 0, undos: 0, challengeId });
  }

  function newPractice() {
    countPractice("freecell");
    setShuffling(true);
    // Let the "Shuffling" state paint before the solver runs.
    setTimeout(() => {
      let chosen: { seed: string; state: State; verified: boolean } | null = null;
      for (let i = 0; i < 6 && !chosen; i++) {
        const seed = `freecell-practice:${crypto.randomUUID()}`;
        const state = deal(seed);
        // A win also teaches the coach this deal's line (solver.ts remembers it).
        const res = solve(state, { maxNodes: 60_000 });
        if (res.result === "win") chosen = { seed, state, verified: true };
        else if (i === 5) chosen = { seed, state, verified: false };
      }
      const next: Saved = { key: chosen!.seed, mode: "practice", seed: chosen!.seed, verified: chosen!.verified, state: chosen!.state, moves: 0, elapsed: 0, hints: 0, undos: 0 };
      writeJson(KEY("practice", date), next);
      writeJson(MODE_KEY, "practice");
      setGame(next);
      setShuffling(false);
    }, 30);
  }

  const switchMode = (mode: Mode) => {
    writeJson(MODE_KEY, mode);
    if (mode === "practice") {
      const saved = readJson<Saved | null>(KEY("practice", date), null);
      if (saved && !saved.done) setGame(saved);
      else newPractice();
    } else openDaily();
  };

  if (shuffling) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center" style={{ background: GAME.tint }}>
        <p className="font-display text-2xl font-bold text-[#111111]">Shuffling a winnable deal…</p>
      </div>
    );
  }
  return <Table key={`${loaded}:${game.key}`} game={game} date={game.date ?? date} inert={!loaded} onMode={switchMode} onNewPractice={newPractice} />;
}

/** Plays the safe moves home after a move; returns the final state and each moved card's animation delay. */
function withAutoMoves(state: State, moves: Move[] = autoMoves(state)): { state: State; delays: Map<number, number> } {
  const delays = new Map<number, number>();
  let s = state;
  moves.forEach((m, i) => {
    const card = m.kind === "cell-to-foundation" ? s.cells[m.cell]! : m.kind === "tableau-to-foundation" ? s.tableau[m.from].at(-1)! : null;
    if (card) delays.set(card.id, 160 + i * 70);
    s = applyMove(s, m);
  });
  return { state: s, delays };
}

function Table({
  game,
  date,
  inert,
  onMode,
  onNewPractice,
}: {
  game: Saved;
  date: string;
  inert: boolean;
  onMode: (m: Mode) => void;
  onNewPractice: () => void;
}) {
  const storageKey = KEY(game.mode, date, game.archive);
  const [board, setBoard] = useState<Board>({ state: game.state, moves: game.moves });
  const [past, setPast] = useState<Board[]>([]);
  const [future, setFuture] = useState<Board[]>([]);
  const [delays, setDelays] = useState<Map<number, number>>(() => new Map());
  const [hints, setHints] = useState(game.hints);
  const [undos, setUndos] = useState(game.undos);
  const [bonusHints, setBonusHints] = useState(game.bonusHints ?? 0);
  const [bonusUndos, setBonusUndos] = useState(game.bonusUndos ?? 0);
  const [peakCells, setPeakCells] = useState(game.peakCells ?? 0);
  const [longestRun, setLongestRun] = useState(game.longestRun ?? 0);
  const [firstEmptyAt, setFirstEmptyAt] = useState(game.firstEmptyAt);
  const [hint, setHint] = useState<Hint | null>(null);
  const [why, setWhy] = useState(false);
  const [notice, setNotice] = useState<"hints" | "undos" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [selected, setSelected] = useState<Pick | null>(null);
  const { state, moves } = board;
  const won = isWon(state);
  const timer = useTimer(!inert && !paused && !won && !finish, game.elapsed);
  const started = useRef(false);
  const isDaily = game.mode === "daily";
  // Today's daily deal is ranked; archive and practice deals aren't.
  const ranked = isDaily && !game.archive;

  // Coach limits. Hints: FREE_HINTS per deal, then a rewarded ad buys one more
  // when an ad is ready; with no ad available the coach keeps helping (hints
  // are still counted in the result and the rating). Undo: unlimited on
  // practice and archive deals; today's daily is ranked, so it gets
  // FREE_UNDOS and one more per rewarded ad. Without an ad, undo stays limited
  // on the daily only.
  const hintsLeft = FREE_HINTS + bonusHints - hints;
  const undosLeft = ranked ? FREE_UNDOS + bonusUndos - undos : Infinity;
  const hintOffer = useRewardedOffer("freecell-extra-hint", "freecell", hintsLeft <= 0 && !finish && !inert);
  const undoOffer = useRewardedOffer("freecell-extra-undo", "freecell", ranked && undosLeft <= 0 && !finish && !inert);

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
  const layout = useMemo(() => computeLayout(state, width, typeof window === "undefined" ? 700 : Math.max(420, window.innerHeight - 330)), [state, width]);

  // Latest board for handlers that run later (pointer-up).
  const boardStateRef = useRef(board);
  useLayoutEffect(() => {
    boardStateRef.current = board;
  }, [board]);

  const commit = useCallback((next: Board, moved: Map<number, number>) => {
    boardStateRef.current = next;
    setBoard(next);
    setDelays(moved);
  }, []);

  const play = useCallback(
    (move: Move) => {
      const b = boardStateRef.current;
      let afterMove: State;
      try {
        afterMove = applyMove(b.state, move);
      } catch {
        setHint(null);
        return;
      }
      // Safe cards go home on their own, as part of the same move (one undo step).
      const auto = withAutoMoves(afterMove);
      setPast((p) => [...p, b].slice(-1000));
      setFuture([]);
      commit({ state: auto.state, moves: b.moves + 1 }, auto.delays);
      setPeakCells((n) => Math.max(n, cellsInUse(afterMove)));
      if (move.kind === "tableau-to-tableau") setLongestRun((n) => Math.max(n, move.count));
      if (firstEmptyAt === undefined && emptyColumns(auto.state) > 0) setFirstEmptyAt(Math.round(timer.now()));
      setSelected(null);
      setMessage(null);
      setNotice(null);
      setHint(null);
      setWhy(false);
    },
    [commit, firstEmptyAt, timer]
  );

  // A deal (or a saved game) can start with safe cards ready to go home.
  useEffect(() => {
    if (inert || finish) return;
    const moves = autoMoves(boardStateRef.current.state);
    if (!moves.length) return;
    const auto = withAutoMoves(boardStateRef.current.state, moves);
    commit({ ...boardStateRef.current, state: auto.state }, auto.delays);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, [inert]);

  const doUndo = () => {
    const prev = past.at(-1);
    if (!prev) return;
    setFuture((f) => [board, ...f]);
    setPast((p) => p.slice(0, -1));
    commit(prev, new Map());
    setUndos((n) => n + 1);
    setHint(null);
    setNotice(null);
    setMessage(null);
  };
  const undo = () => {
    if (!past.length || finish) return;
    if (undosLeft <= 0) {
      setHint(null);
      setNotice("undos");
      return;
    }
    doUndo();
  };
  const redo = () => {
    const next = future[0];
    if (!next || finish) return;
    setPast((p) => [...p, board]);
    setFuture((f) => f.slice(1));
    commit(next, new Map());
    setHint(null);
  };

  // Save progress.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, {
      ...game,
      state,
      moves,
      hints,
      undos,
      bonusHints,
      bonusUndos,
      peakCells,
      longestRun,
      firstEmptyAt,
      elapsed: timer.now(),
      done: finish ?? undefined,
    } satisfies Saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, hints, undos, bonusHints, bonusUndos, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "freecell", { mode: game.mode });
  }, [inert, finish, game.mode]);

  // Win: rank, rating, skills. FreeCell isn't in the Daily Set, so no markDone.
  useEffect(() => {
    if (!won || finish || inert) return;
    const timeMs = Math.round(timer.now());
    track("game_complete", "freecell", { mode: game.mode, timeMs, moves, hints, undos });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = isDaily ? date : `practice:${game.seed}`;
      // Archive deals are unrated: the day's field has moved on.
      const { rating, delta } = game.archive
        ? { rating: getRating("freecell").rating, delta: 0 }
        : recordMatch("freecell", key, {
            puzzleRating: FREECELL_PUZZLE_RATING,
            won: true,
            percentile: percentile ?? undefined,
            hints,
            mistakes: 0,
          });
      recordFinish("freecell", {
        won: true,
        timeMs,
        hints,
        level: isDaily ? "daily" : "practice",
        skills: winSkills({ hints, undos, moves, timeMs, peakCells, longestRun }),
      });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating, streak: getStreak().current });
    };
    // Let the last cards fly home before the recap opens.
    const wait = Math.max(0, ...delays.values()) + 400;
    const t = setTimeout(() => setShowRecap(true), wait);
    if (ranked) {
      submitResult({ game: "freecell", date, variant: "", timeMs, mistakes: 0, hints, moves }).then((res) =>
        finalize(res ? res.percentile : undefined, res)
      );
    } else finalize();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const runAutoFinish = () => {
    if (!canAutoFinish(state) || finish) return;
    const auto = withAutoMoves(state, finishMoves(state));
    setPast((p) => [...p, board]);
    setFuture([]);
    commit({ ...board, state: auto.state }, auto.delays);
    setHint(null);
    setNotice(null);
    setMessage(null);
  };

  const askCoach = () => {
    const h = bestMove(boardStateRef.current.state);
    if (!h) {
      setHint(null);
      setMessage("No useful moves left. Undo a few moves, or deal again from Options.");
      return;
    }
    setHints((n) => n + 1);
    track("hint_used", "freecell", { reason: h.reason, winning: h.winning });
    setNotice(null);
    setMessage(null);
    setHint(h);
    setWhy(false);
  };
  const showHint = () => {
    if (finish) return;
    if (hintsLeft <= 0 && hintOffer.ready) {
      setHint(null);
      setNotice("hints");
      return;
    }
    askCoach();
  };

  // ----- Pointer: tap to auto-move, drag to a specific pile -----
  const drag = useRef<{ pick: Pick; ids: Set<number>; startX: number; startY: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [dragView, setDragView] = useState<{ ids: Set<number>; dx: number; dy: number } | null>(null);

  const pickFor = (pos: CardPos): Pick | null => {
    if (!pos.movable) return null;
    if (pos.pile.kind === "tableau") return { pile: pos.pile, count: state.tableau[pos.pile.index].length - (pos.depth ?? 0) };
    return { pile: pos.pile, count: 1 };
  };
  const idsFor = (pick: Pick): Set<number> => {
    if (pick.pile.kind === "tableau") return new Set(state.tableau[pick.pile.index].slice(-pick.count).map((c) => c.id));
    if (pick.pile.kind === "cell") {
      const card = state.cells[pick.pile.index];
      return new Set(card ? [card.id] : []);
    }
    return new Set();
  };
  const explainNoMove = (pick: Pick, to?: PileId) => {
    const max = to ? runTooLong(state, pick, to) : tapTooLong(state, pick);
    if (max !== null) setMessage(tooLongMessage(state, pick.count, max));
    else if (!to) setMessage(pick.count > 1 ? "That run has nowhere to go right now." : "That card has no move right now.");
  };

  const onCardDown = (e: ReactPointerEvent, pos: CardPos) => {
    if (paused || finish) return;
    const pick = pickFor(pos);
    if (!pick) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { pick, ids: idsFor(pick), startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false };
  };
  const onCardMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.dx = e.clientX - d.startX;
    d.dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(d.dx, d.dy) > 6) d.moved = true;
    if (d.moved) setDragView({ ids: d.ids, dx: d.dx, dy: d.dy });
  };
  const onCardUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragView(null);
    if (!d) return;
    if (!d.moved) {
      const m = autoMove(state, d.pick);
      if (m) play(m);
      else explainNoMove(d.pick);
      return;
    }
    const rect = boardRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const target = layout.piles.find((p) => x >= p.x - 3 && x <= p.x + p.w + 3 && y >= p.y - 4 && y <= p.y + p.h + 30);
    if (!target || samePile(target.pile, d.pick.pile)) return;
    const m = moveFor(state, d.pick, target.pile);
    if (m) play(m);
    else explainNoMove(d.pick, target.pile);
  };

  // ----- Keyboard -----
  const pileButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const choosePile = (pile: PileId) => {
    if (finish) return;
    if (selected) {
      const m = samePile(selected.pile, pile) ? autoMove(state, selected) : moveFor(state, selected, pile);
      if (m) play(m);
      else {
        const max = samePile(selected.pile, pile) ? tapTooLong(state, selected) : runTooLong(state, selected, pile);
        setMessage(max !== null ? tooLongMessage(state, selected.count, max) : "That move isn’t allowed.");
      }
      setSelected(null);
      return;
    }
    if (pile.kind === "tableau" && state.tableau[pile.index].length) setSelected({ pile, count: 1 });
    else if (pile.kind === "cell" && state.cells[pile.index]) setSelected({ pile, count: 1 });
  };

  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        redo();
      } else if (mod) {
        return;
      } else if (k === "h") showHint();
      else if (k === "a") runAutoFinish();
      else if (k === "escape") setSelected(null);
      else if (selected && selected.pile.kind === "tableau" && (k === "arrowup" || k === "arrowdown")) {
        e.preventDefault();
        const max = runLength(state.tableau[selected.pile.index]);
        setSelected({ ...selected, count: Math.min(max, Math.max(1, selected.count + (k === "arrowup" ? 1 : -1))) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return (
      <FreeCellRecap
        game={game}
        date={date}
        moves={moves}
        hints={hints}
        undos={undos}
        peakCells={peakCells}
        longestRun={longestRun}
        firstEmptyAt={firstEmptyAt}
        finish={finish}
        onClose={() => setShowRecap(false)}
      />
    );
  }
  if (showRecap) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center" style={{ background: GAME.tint }}>
        <p className="text-lg font-semibold text-[#111111]">Won! Comparing with today’s players…</p>
      </div>
    );
  }

  // Coach highlight: the cards to move and where they go.
  const hintIds = new Set<number>();
  let hintTarget: PileId | null = null;
  if (hint) {
    const m = hint.move;
    if (m.kind === "cell-to-foundation" || m.kind === "cell-to-tableau") hintIds.add(state.cells[m.cell]!.id);
    if (m.kind === "tableau-to-cell" || m.kind === "tableau-to-foundation") hintIds.add(state.tableau[m.from].at(-1)!.id);
    if (m.kind === "tableau-to-tableau") state.tableau[m.from].slice(-m.count).forEach((c) => hintIds.add(c.id));
    if (m.kind === "cell-to-tableau" || m.kind === "tableau-to-tableau") hintTarget = { kind: "tableau", index: m.to };
    if (m.kind === "tableau-to-cell") hintTarget = { kind: "cell", index: m.cell };
    if (m.kind === "cell-to-foundation" || m.kind === "tableau-to-foundation") {
      const card = m.kind === "cell-to-foundation" ? state.cells[m.cell]! : state.tableau[m.from].at(-1)!;
      hintTarget = { kind: "foundation", index: SUITS.indexOf(card.suit) };
    }
  }
  const selectedIds = selected ? idsFor(selected) : new Set<number>();
  const home = cardsHome(state);
  const targetRect = hintTarget ? layout.piles.find((r) => samePile(r.pile, hintTarget!))! : null;
  const targetTopY =
    hintTarget && hintTarget.kind === "tableau"
      ? Math.max(targetRect!.y, ...layout.cards.filter((c) => samePile(c.pile, hintTarget!)).map((c) => c.y))
      : (targetRect?.y ?? 0);
  const finishable = canAutoFinish(state) && !finish;

  return (
    <GameShell
      tint={GAME.tint}
      fullTint
      title={isDaily ? "Daily FreeCell" : "FreeCell"}
      subtitle={isDaily ? (game.archive ? "Archive deal" : "Today’s deal") : "Practice deal"}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Moves {moves}</Chip>
          <Chip>Free cells {4 - cellsInUse(state)}</Chip>
          {game.verified && (
            <Chip dark>
              <Icon name="check" size={14} strokeWidth={2.4} />
              Winnable deal
            </Chip>
          )}
        </>
      }
    >
      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div ref={boardRef} className="relative w-full touch-none select-none" style={{ height: layout.height }} aria-label="FreeCell table" role="application">
          {/* Empty slots: free cells and suit-marked foundations */}
          {layout.piles.map((p) =>
            p.pile.kind === "tableau" && state.tableau[p.pile.index].length ? null : (
              <div
                key={`slot-${p.pile.kind}-${p.pile.index}`}
                aria-hidden="true"
                className={`absolute flex items-center justify-center rounded-lg border-2 ${p.pile.kind === "cell" ? "border-solid bg-white/40" : "border-dashed"} border-[#8EC6D6]`}
                style={{ left: p.x, top: p.y, width: layout.cardW, height: layout.cardH, color: "#4F8597" }}
              >
                {p.pile.kind === "foundation" && <SuitIcon suit={SUITS[p.pile.index]} size={Math.round(layout.cardW * 0.42)} color="#4F8597" />}
              </div>
            )
          )}

          {layout.cards.map((pos) => {
            const dragging = dragView?.ids.has(pos.card.id);
            const delay = delays.get(pos.card.id);
            return (
              <div
                key={pos.card.id}
                onPointerDown={(e) => onCardDown(e, pos)}
                onPointerMove={onCardMove}
                onPointerUp={onCardUp}
                onPointerCancel={() => {
                  drag.current = null;
                  setDragView(null);
                }}
                className="absolute left-0 top-0"
                style={{
                  width: layout.cardW,
                  height: layout.cardH,
                  zIndex: dragging ? 1000 + pos.z : pos.z,
                  transform: `translate(${pos.x + (dragging ? dragView!.dx : 0)}px, ${pos.y + (dragging ? dragView!.dy : 0)}px)`,
                  transition: dragging ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1)",
                  transitionDelay: !dragging && delay ? `${delay}ms` : undefined,
                  cursor: pos.movable ? "pointer" : "default",
                }}
              >
                <CardFace card={pos.card} w={layout.cardW} h={layout.cardH} ring={hintIds.has(pos.card.id) ? "coach" : selectedIds.has(pos.card.id) ? "select" : undefined} />
              </div>
            );
          })}

          {targetRect && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-lg"
              style={{ left: targetRect.x - 2, top: targetTopY - 2, width: layout.cardW + 4, height: layout.cardH + 4, outline: "2px dashed #F26B1D", outlineOffset: 2, zIndex: 900 }}
            />
          )}

          {/* Keyboard access: one focusable control per pile (pointer events go to the cards). */}
          {layout.piles.map((p, i) => (
            <button
              key={`kb-${i}`}
              ref={(el) => {
                pileButtons.current[i] = el;
              }}
              type="button"
              tabIndex={0}
              aria-label={pileLabel(state, p.pile)}
              onClick={() => choosePile(p.pile)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  pileButtons.current[(i + (e.key === "ArrowRight" ? 1 : layout.piles.length - 1)) % layout.piles.length]?.focus();
                }
              }}
              className="pointer-events-none absolute rounded-lg opacity-0 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#5B3DF5]"
              style={{ left: p.x, top: p.y, width: p.w, height: Math.min(p.h, layout.cardH * 2), zIndex: 950 }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4">
        <div className="flex justify-between text-[13px] font-semibold text-[#21495A]">
          <span>Cards home</span>
          <span className="font-mono">{home} / 52</span>
        </div>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded bg-[#C4E5EE]">
          <div className="h-2 rounded bg-[#0B6E8A] transition-[width]" style={{ width: `${(home / 52) * 100}%` }} />
        </div>
      </div>

      <div className="px-4">
        {hint ? (
          <CoachCard
            heading="Coach · Best move"
            tag={hint.winning ? "Winning line" : "Best guess"}
            onClose={() => setHint(null)}
            primary={{ label: "Make this move", onClick: () => play(hint.move) }}
            secondary={why ? undefined : { label: "Why this one?", onClick: () => setWhy(true) }}
          >
            <strong className="font-semibold">{describeMove(state, hint.move)}.</strong> {hint.text}
            {why && <span className="mt-2 block">{whyText(hint)}</span>}
          </CoachCard>
        ) : notice === "hints" ? (
          <CoachCard
            heading="Coach"
            tag="No free hints left"
            onClose={() => setNotice(null)}
            primary={
              hintOffer.ready
                ? {
                    label: "Watch an ad for one more hint",
                    onClick: async () => {
                      if (await hintOffer.watch()) {
                        setBonusHints((n) => n + 1);
                        askCoach();
                      }
                    },
                  }
                : { label: "Show best move", onClick: askCoach }
            }
          >
            You’ve used this deal’s {FREE_HINTS} free hints. Look for a card that can go home, or a move that empties a column.
          </CoachCard>
        ) : notice === "undos" ? (
          <CoachCard
            heading="Coach"
            tag="No undos left"
            onClose={() => setNotice(null)}
            primary={
              undoOffer.ready
                ? {
                    label: "Watch an ad for one more undo",
                    onClick: async () => {
                      if (await undoOffer.watch()) {
                        setBonusUndos((n) => n + 1);
                        doUndo();
                      }
                    },
                  }
                : undefined
            }
          >
            Today’s deal is ranked, so it comes with {FREE_UNDOS} undos. Practice deals have unlimited undo.
          </CoachCard>
        ) : message ? (
          <CoachCard heading="Coach" onClose={() => setMessage(null)}>
            {message}
          </CoachCard>
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft > 0 ? `${hintsLeft} free hint${hintsLeft === 1 ? "" : "s"} left` : `${hints} hints used`}
            primary={finish ? undefined : { label: "Show best move", onClick: showHint }}
          >
            {finish
              ? "Won. Open the recap to see how you did."
              : "Tap a card or run to send it to its best spot, or drag it. Safe cards go home on their own. Stuck? I’ll find a move from a line that wins."}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 px-4">
        <ToolButton surface="white" icon="undo" label={ranked ? `Undo · ${Math.max(0, undosLeft)}` : "Undo"} onClick={undo} disabled={!past.length || !!finish} />
        <ToolButton surface="white" icon="redo" label="Redo" onClick={redo} disabled={!future.length || !!finish} />
        <ToolButton surface="white" icon="hint" label="Hint" accent onClick={showHint} disabled={!!finish} />
        <ToolButton surface="white" icon="arrowRight" label="Auto-finish" onClick={runAutoFinish} disabled={!finishable} />
        <ToolButton surface="white" icon="menu" label="Options" onClick={() => setPaused(true)} />
      </div>

      {finish && (
        <div className="px-4">
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-[#111111] text-base font-semibold text-white">
            See recap
          </button>
        </div>
      )}

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          <button
            type="button"
            aria-pressed={isDaily && !game.archive}
            onClick={() => {
              setPaused(false);
              onMode("daily");
            }}
            className={`min-h-11 rounded-full border text-sm font-semibold ${isDaily && !game.archive ? "border-ink bg-ink text-ground" : "border-line-strong text-ink"}`}
          >
            Today’s daily deal
          </button>
          <SheetButton
            onClick={() => {
              setPaused(false);
              onNewPractice();
            }}
          >
            New practice deal
          </SheetButton>
        </PauseSheet>
      )}
    </GameShell>
  );
}

function pileLabel(state: State, pile: PileId): string {
  switch (pile.kind) {
    case "cell": {
      const card = state.cells[pile.index];
      return `Free cell ${pile.index + 1}, ${card ? cardLabel(card) : "empty"}`;
    }
    case "foundation": {
      const f = state.foundations[pile.index];
      return `${["Spades", "Hearts", "Diamonds", "Clubs"][pile.index]} foundation, ${f.length ? cardLabel(f[f.length - 1]) : "empty"}`;
    }
    case "tableau": {
      const col = state.tableau[pile.index];
      return `Column ${pile.index + 1}: ${col.length ? col.map(cardLabel).join(", ") : "empty"}`;
    }
  }
}

const WHY: Record<Hint["reason"], string> = {
  foundation: "A card on its foundation is done: nothing in the columns needs it as a base anymore.",
  "free-low": "Low cards are what every suit waits on. Uncovering one lets it go home and frees the cards stacked on it.",
  "empty-column": "An empty column takes any card or run and doubles how many cards a supermove can carry.",
  "free-cell": "Each free cell you keep open adds one card to the runs you can move at once.",
  dig: "A low card buried deep holds up its whole suit, so digging toward it early pays off later.",
  "to-empty": "Using the empty column now keeps your free cells open for the moves that need them.",
  park: "A free cell is a short-term parking spot: use it when the card under it matters more.",
  build: "Building down in alternating colors keeps cards in the columns instead of the free cells.",
};

function whyText(h: Hint): string {
  return `${WHY[h.reason]} ${h.winning ? "The solver checked a full winning line from here; this is its next step." : "No guaranteed win was found from here, so this is the most useful move by the usual priorities."}`;
}

function CardFace({ card, w, h, ring }: { card: Card; w: number; h: number; ring?: "coach" | "select" }) {
  const shadow = ring === "coach" ? "0 0 0 3px #F26B1D" : ring === "select" ? "0 0 0 3px #5B3DF5" : undefined;
  const rank = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][card.rank];
  const color = `var(--suit-${card.suit})`;
  const pad = Math.max(3, Math.round(w * 0.1));
  return (
    <div
      className="flex h-full w-full flex-col rounded-lg border border-[#BFD9E1] bg-white py-[3px]"
      style={{ color, boxShadow: shadow, paddingLeft: pad, paddingRight: pad }}
      aria-label={cardLabel(card)}
    >
      <span className="flex items-center gap-[2px] leading-none">
        <span className="font-display font-bold leading-none" style={{ fontSize: Math.round(w * (rank === "10" ? 0.3 : 0.34)), letterSpacing: rank === "10" ? "-0.06em" : undefined }}>
          {rank}
        </span>
        <SuitIcon suit={card.suit} size={Math.round(w * 0.26)} color={color} />
      </span>
      <span className="mt-auto self-center leading-none">
        <SuitIcon suit={card.suit} size={Math.round(Math.min(w * 0.5, h * 0.36))} color={color} />
      </span>
    </div>
  );
}

function FreeCellRecap({
  game,
  date,
  moves,
  hints,
  undos,
  peakCells,
  longestRun,
  firstEmptyAt,
  finish,
  onClose,
}: {
  game: Saved;
  date: string;
  moves: number;
  hints: number;
  undos: number;
  peakCells: number;
  longestRun: number;
  firstEmptyAt?: number;
  finish: Finish;
  onClose: () => void;
}) {
  const isDaily = game.mode === "daily";
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const params = new URLSearchParams({
    g: "freecell",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(hints),
    mv: String(moves),
    lv: isDaily ? "Winnable deal" : "Practice",
  });
  if (top !== null && isDaily) params.set("top", String(top));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const text = [
    `Funzzle ${isDaily ? "Daily FreeCell" : "FreeCell practice"} · ${short}`,
    `${formatTime(finish.timeMs)}${top !== null && isDaily ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${plural(moves, "move")} · ${plural(hints, "hint")} · ${plural(undos, "undo")}`,
    "funzzle.com/play/freecell",
  ].join("\n");

  const keyMove =
    firstEmptyAt !== undefined
      ? `at ${formatTime(firstEmptyAt)} you emptied your first column. From then on runs could move in one go${longestRun >= 2 ? `, like your ${longestRun}-card supermove` : ""}.`
      : "you won without ever emptying a column, working only through the free cells. That takes careful planning.";
  const nextSkill =
    hints > 0
      ? "A no-hint win. Before each move, ask which buried Ace or two it frees; that’s the first question the coach asks too."
      : peakCells > 2
        ? `Win with two free cells or fewer. You had ${peakCells} in use at once; building down and emptying columns keeps cells open.`
        : longestRun < 2
          ? "Supermoves. Moving a whole run at once saves moves, and an empty column doubles how long that run can be."
          : moves >= 100
            ? `Win in under 100 moves. You took ${moves}; plan a few moves ahead before parking cards.`
            : `Speed. Same priorities, less hesitation: try to beat ${formatTime(finish.timeMs)} on the next deal.`;

  return (
    <Recap
      game="freecell"
      heading={isDaily ? `Daily FreeCell · ${short}${game.archive ? " · archive" : ""}` : "FreeCell practice"}
      title="Won."
      timeMs={finish.timeMs}
      percentile={isDaily && !game.archive ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Moves", value: String(moves), note: undos ? plural(undos, "undo") : "No undos", good: !undos },
        { label: "Hints", value: String(hints), note: hints ? "Coach helped" : "No help needed", good: !hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.archive ? "Archive deals are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: isDaily ? { kind: "daily", date } : { kind: "practice", seed: game.seed, level: "standard" },
        label: isDaily ? `Daily FreeCell · ${short}` : "FreeCell practice",
        result: { timeMs: finish.timeMs, mistakes: 0, hints, moves },
        activeId: game.challengeId,
      }}
      coach={{
        keyMove,
        nextSkill,
        learn: {
          title: "The four FreeCell priorities",
          body: "1. Free the Aces and twos first: every suit waits on them. 2. Keep free cells empty; each one you fill shrinks the runs you can move. 3. An empty column is worth more than a free cell, since it doubles your supermove. 4. Before you fill the last cell, make sure you can empty one again.",
        },
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={<PracticeAction game="freecell" href="/play/freecell?practice=1" label="Deal a practice game" />}
    />
  );
}
