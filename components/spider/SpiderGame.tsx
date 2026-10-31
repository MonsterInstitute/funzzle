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
  bestMove,
  cardLabel,
  DAILY_BUDGET,
  deal,
  describeMove,
  isWon,
  movableRun,
  rememberWinningLine,
  solve,
  type Card,
  type Hint,
  type Move,
  type State,
  type SuitCount,
} from "@/lib/games/spider";
import { SPIDER_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import type { DailySpider } from "@/lib/games/dailyPuzzles";
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
import { columnAt, computeLayout, RUNS, samePile, type CardPos, type PileId } from "./layout";
import { autoMove, dealBlocked, dealsLeft, finishSkills, FREE_HINTS, hiddenCount, moveFor, pickCount, runsDone, suitsLabel, type Pick } from "./moves";

const SLUG = "spider-solitaire";
const GAME = GAME_BY_SLUG[SLUG];

type Mode = "daily1" | "daily2" | "daily4" | "practice";
type DailyMode = Exclude<Mode, "practice">;

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
  /** Solver-verified winnable (always true for daily deals; false for 4-suit practice). */
  verified: boolean;
  state: State;
  elapsed: number;
  hints: number;
  bonusHints?: number;
  undos?: number;
  /** Elapsed ms when the first King-to-Ace run went home. */
  firstRunAt?: number;
  /** Elapsed ms when the last face-down card was turned over. */
  revealedAllAt?: number;
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

const modeFor = (suits: SuitCount): DailyMode => `daily${suits}`;
const suitsOf = (mode: DailyMode): SuitCount => Number(mode.slice(5)) as SuitCount;
const KEY = (mode: Mode, date: string, archive = false) =>
  mode === "practice" ? `fz:${SLUG}:practice` : archive ? `fz:${SLUG}:archive:${mode}:${date}` : `fz:${SLUG}:${mode}:${date}`;

function freshDaily(d: DailySpider): Saved {
  return { key: `${d.date}:${d.seed}`, mode: modeFor(d.suits), seed: d.seed, verified: true, state: d.state, elapsed: 0, hints: 0 };
}

/**
 * A practice deal. 1 and 2 suits are proved winnable here with the same
 * search budget as the daily deals (~60 ms / ~0.4 s each; about 3 in 4 and
 * 2 in 3 random deals pass), trying a few seeds. 4 suits would take seconds
 * and hundreds of MB per try, so a 4-suit practice deal is a plain random
 * deal, marked "Not verified".
 */
function findPractice(suits: SuitCount, done: (p: { seed: string; state: State; verified: boolean }) => void) {
  const tries = suits === 1 ? 8 : suits === 2 ? 4 : 1;
  let i = 0;
  const step = () => {
    const seed = `spider-practice:${crypto.randomUUID()}`;
    const state = deal(seed, suits);
    if (suits === 4) return done({ seed, state, verified: false });
    // A win also teaches the coach the line (the solver remembers it).
    if (solve(state, { maxNodes: DAILY_BUDGET[suits] }).result === "win") return done({ seed, state, verified: true });
    if (++i >= tries) return done({ seed, state, verified: false });
    setTimeout(step, 0);
  };
  // Let the "Shuffling" screen paint before the solver runs.
  setTimeout(step, 30);
}

export default function SpiderGame({
  date,
  daily1,
  daily2,
  daily4,
  initialMode,
}: {
  date: string;
  daily1: DailySpider;
  daily2: DailySpider | null;
  /** Null until the cron has stored today's 4-suit deal: it is never generated on a request. */
  daily4: DailySpider | null;
  /** A suit-count page (/play/spider-solitaire/2-suits): open that daily, not the last mode played. */
  initialMode?: DailyMode;
}) {
  const start = initialMode === "daily2" ? daily2 : initialMode === "daily4" ? daily4 : null;
  const [game, setGame] = useState<Saved>(() => freshDaily(start ?? daily1));
  const [loaded, setLoaded] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const dailies = useMemo(() => ({ daily1, daily2, daily4 }) as Record<DailyMode, DailySpider | null>, [daily1, daily2, daily4]);

  const openDaily = useCallback(
    (mode: DailyMode, challengeId?: string) => {
      const d = dailies[mode] ?? daily1;
      const fresh = freshDaily(d);
      const saved = readJson<Saved | null>(KEY(fresh.mode, date), null);
      const pick = saved && saved.key === fresh.key ? saved : fresh;
      setGame(challengeId ? { ...pick, challengeId } : pick);
    },
    [dailies, daily1, date]
  );

  useEffect(() => {
    // The server's verified solutions let the coach answer instantly from the start.
    for (const d of [daily1, daily2, daily4]) if (d) rememberWinningLine(d.state, d.solution);
    const last = readJson<Mode | null>(`fz:${SLUG}:mode`, null);
    // "Deal a practice game" on the recap loads ?practice=<suits> as a new page view.
    const params = new URLSearchParams(location.search);
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const archiveSuits = toSuits(params.get("suits"));
    const challengeId = challengeFromUrl();
    if (challengeId) {
      fetchChallenge(challengeId)
        .then(async (c) => {
          if (c.game !== SLUG) throw new Error("not a spider challenge");
          const p = c.puzzle;
          const suits = toSuits((p.kind === "practice" ? p.level : p.variant)?.replace("suits", "") ?? null);
          if (p.kind === "practice") return openPracticeSeed(p.seed, suits, challengeId);
          if (p.date === date) return openDaily(modeFor(suits), challengeId);
          return openArchive(p.date, suits, challengeId);
        })
        .catch(() => openDaily("daily1"))
        .finally(() => setLoaded(true));
      return;
    }
    if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      openArchive(archiveDate, archiveSuits).finally(() => setLoaded(true));
      return;
    }
    if (want === "1" || want === "2" || want === "4") {
      history.replaceState(null, "", location.pathname);
      newPractice(toSuits(want));
    } else if (initialMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage
      openDaily(initialMode);
    } else if (last === "practice") {
      const saved = readJson<Saved | null>(KEY("practice", date), null);
      if (saved && !saved.done) setGame(saved);
      else openDaily("daily1");
    } else {
      openDaily(last && dailies[last] ? last : "daily1");
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, []);

  /** A past day's daily deal from the archive API (4 suits only when it was stored). */
  async function openArchive(day: string, suits: SuitCount, challengeId?: string) {
    const mode = modeFor(suits);
    const saved = readJson<Saved | null>(KEY(mode, day, true), null);
    if (saved && !challengeId) return setGame(saved);
    try {
      const res = await fetch(`/api/daily-puzzle?game=${SLUG}&date=${day}&suits=${suits}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return openDaily("daily1");
      const d = (await res.json()) as DailySpider;
      rememberWinningLine(d.state, d.solution);
      setGame({ ...freshDaily(d), key: `archive:${day}:${d.seed}`, archive: true, date: day, challengeId });
    } catch {
      openDaily("daily1");
    }
  }

  function openPracticeSeed(seed: string, suits: SuitCount, challengeId: string) {
    const state = deal(seed, suits);
    const verified = suits !== 4 && solve(state, { maxNodes: DAILY_BUDGET[suits] }).result === "win";
    setGame({ key: `${seed}:${challengeId}`, mode: "practice", seed, verified, state, elapsed: 0, hints: 0, challengeId });
  }

  function newPractice(suits: SuitCount) {
    countPractice(SLUG);
    setShuffling(true);
    findPractice(suits, ({ seed, state, verified }) => {
      const next: Saved = { key: seed, mode: "practice", seed, verified, state, elapsed: 0, hints: 0 };
      writeJson(KEY("practice", date), next);
      writeJson(`fz:${SLUG}:mode`, "practice");
      setGame(next);
      setShuffling(false);
    });
  }

  const switchMode = (mode: Mode) => {
    writeJson(`fz:${SLUG}:mode`, mode);
    if (mode === "practice") {
      const saved = readJson<Saved | null>(KEY("practice", date), null);
      if (saved && !saved.done) setGame(saved);
      else newPractice(1);
    } else openDaily(mode);
  };

  if (shuffling) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center px-6 text-center" style={{ background: GAME.tint }}>
        <p className="font-display text-2xl font-bold text-[#111111]">Shuffling a winnable deal…</p>
      </div>
    );
  }
  return (
    <Table
      key={`${loaded}:${game.key}`}
      game={game}
      date={game.date ?? date}
      inert={!loaded}
      has4={!!daily4}
      onMode={switchMode}
      onNewPractice={newPractice}
    />
  );
}

function toSuits(v: string | null): SuitCount {
  return v === "4" ? 4 : v === "2" ? 2 : 1;
}

function Table({
  game,
  date,
  inert,
  has4,
  onMode,
  onNewPractice,
}: {
  game: Saved;
  date: string;
  inert: boolean;
  has4: boolean;
  onMode: (m: Mode) => void;
  onNewPractice: (suits: SuitCount) => void;
}) {
  const storageKey = KEY(game.mode, date, game.archive);
  const [state, setState] = useState<State>(game.state);
  const [past, setPast] = useState<State[]>([]);
  const [future, setFuture] = useState<State[]>([]);
  const [hints, setHints] = useState(game.hints);
  const [bonusHints, setBonusHints] = useState(game.bonusHints ?? 0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const [undos, setUndos] = useState(game.undos ?? 0);
  const [firstRunAt, setFirstRunAt] = useState(game.firstRunAt);
  const [revealedAllAt, setRevealedAllAt] = useState(game.revealedAllAt);
  const [hint, setHint] = useState<Hint | null>(null);
  const [why, setWhy] = useState(false);
  const [noMove, setNoMove] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [selected, setSelected] = useState<Pick | null>(null);
  /** Per-card transition delays for the deal that just happened (cards fly out column by column). */
  const [dealDelay, setDealDelay] = useState<Map<number, number>>(() => new Map());
  const won = isWon(state);
  const timer = useTimer(!inert && !paused && !won && !finish, game.elapsed);
  const started = useRef(false);
  const suits = state.suits;
  const isDaily = game.mode !== "practice";
  // Today's daily deals are ranked; archive deals aren't.
  const ranked = isDaily && !game.archive;
  const hintsLeft = Math.max(0, FREE_HINTS + bonusHints - hints);
  const bonusOffer = useRewardedOffer(`${SLUG}-extra-hint`, SLUG, hintsLeft === 0 && !finish && !inert);

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
  const layout = useMemo(
    () => computeLayout(state, width, typeof window === "undefined" ? 640 : Math.max(380, window.innerHeight - 310)),
    [state, width]
  );

  // Latest state for handlers that run later (pointer-up, coach).
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const play = useCallback(
    (move: Move) => {
      const s = stateRef.current;
      let next: State;
      try {
        next = applyMove(s, move);
      } catch {
        return;
      }
      stateRef.current = next;
      setState(next);
      setPast((p) => [...p, s]);
      setFuture([]);
      const now = Math.round(timer.now());
      if (next.foundations.length > s.foundations.length) setFirstRunAt((t) => t ?? now);
      if (hiddenCount(s) > 0 && hiddenCount(next) === 0) setRevealedAllAt(now);
      // The engine pops the stock: column c gets the card c places from the top.
      setDealDelay(move.kind === "deal" ? new Map(s.stock.slice(-s.tableau.length).map((c, i, a) => [c.id, (a.length - 1 - i) * 40])) : new Map());
      setSelected(null);
      setNoMove(null);
      setHint(null);
      setWhy(false);
    },
    [timer]
  );

  const undo = () => {
    const prev = past.at(-1);
    if (!prev || finish) return;
    setFuture((f) => [state, ...f]);
    setPast((p) => p.slice(0, -1));
    setState(prev);
    setUndos((n) => n + 1);
    setDealDelay(new Map());
    setHint(null);
    setSelected(null);
  };
  const redo = () => {
    const next = future[0];
    if (!next || finish) return;
    setPast((p) => [...p, state]);
    setFuture((f) => f.slice(1));
    setState(next);
    setDealDelay(new Map());
    setHint(null);
    setSelected(null);
  };

  // Save progress.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, {
      ...game,
      state,
      hints,
      bonusHints,
      undos,
      firstRunAt,
      revealedAllAt,
      elapsed: timer.now(),
      done: finish ?? undefined,
    } satisfies Saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hints, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", SLUG, { mode: game.mode, suits });
  }, [inert, finish, game.mode, suits]);

  // Win: rank, rating, stats and skills.
  useEffect(() => {
    if (!won || finish || inert) return;
    const timeMs = Math.round(timer.now());
    track("game_complete", SLUG, { mode: game.mode, suits, timeMs, moves: state.moves, hints, undos });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = isDaily ? `${date}:suits${suits}` : `practice:${game.seed}`;
      // Archive deals are unrated: the day's field has moved on.
      const { rating, delta } = game.archive
        ? { rating: getRating(SLUG).rating, delta: 0 }
        : recordMatch(SLUG, key, { puzzleRating: SPIDER_PUZZLE_RATING[suits], won: true, percentile: percentile ?? undefined, hints, mistakes: 0 });
      recordFinish(SLUG, { won: true, timeMs, hints, level: `suits-${suits}`, skills: finishSkills(suits, hints, undos, state.moves) });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating, streak: getStreak().current });
    };
    // Let the last run fly home before the recap opens.
    const t = setTimeout(() => setShowRecap(true), 750);
    if (ranked) {
      submitResult({ game: SLUG, date, variant: `suits${suits}`, timeMs, mistakes: 0, hints, moves: state.moves }).then((res) =>
        finalize(res ? res.percentile : undefined, res)
      );
    } else finalize();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const showHint = () => {
    if (finish || inert) return;
    if (hints >= FREE_HINTS + bonusHints) return;
    const h = bestMove(stateRef.current);
    if (!h) {
      setHint(null);
      setNoMove("No useful moves left. Undo a few moves, or start a new deal from Options.");
      return;
    }
    setHints((n) => n + 1);
    track("hint_used", SLUG, { reason: h.reason, winning: h.winning, suits });
    setHint(h);
    setWhy(false);
    setSelected(null);
  };

  // The bonus hint opens as soon as the rewarded ad has been watched.
  useEffect(() => {
    if (!hintAfterAd || hintsLeft === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    showHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, hintsLeft]);

  const blocked = dealBlocked(state);
  const dealStock = () => {
    if (finish) return;
    if (blocked) {
      if (state.stock.length) setNoMove(`${blocked} Every column needs at least one card when a new row is dealt.`);
      return;
    }
    play({ kind: "deal" });
  };

  // ----- Pointer: tap to auto-move, drag to a specific column -----
  const drag = useRef<{ pick: Pick; ids: Set<number>; startX: number; startY: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [dragView, setDragView] = useState<{ ids: Set<number>; dx: number; dy: number } | null>(null);

  const idsFor = (pick: Pick): Set<number> => new Set(state.tableau[pick.from].up.slice(-pick.count).map((c) => c.id));

  const onCardDown = (e: ReactPointerEvent, pos: CardPos) => {
    if (paused || finish || pos.pile.kind !== "tableau" || !pos.faceUp) return;
    const from = pos.pile.index;
    const count = pickCount(state, from, pos.runIndex ?? 0);
    if (!count) {
      const col = state.tableau[from];
      const run = movableRun(col);
      setNoMove(
        `Only a run of one suit in order moves together. Here that’s ${run === 1 ? `just the ${cardLabel(col.up.at(-1)!)}` : `the ${cardLabel(col.up[col.up.length - run])} to ${cardLabel(col.up.at(-1)!)}`}.`
      );
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pick = { from, count };
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
      else setNoMove("That run has nowhere to go right now. It needs a card one rank higher, or an empty column.");
      return;
    }
    const rect = boardRef.current!.getBoundingClientRect();
    const to = columnAt(layout, e.clientX - rect.left, e.clientY - rect.top);
    if (to === null) return;
    const m = moveFor(state, d.pick, to);
    if (m) play(m);
  };

  // ----- Keyboard: one button per pile; Enter picks up a run, Enter on another column drops it -----
  const pileButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const kbPiles = layout.piles.filter((p) => p.pile.kind !== "foundation");
  const chooseColumn = (col: number) => {
    if (finish) return;
    if (selected) {
      const m = selected.from === col ? autoMove(state, selected) : moveFor(state, selected, col);
      if (m) play(m);
      else setNoMove("That move isn’t allowed.");
      setSelected(null);
      return;
    }
    const run = movableRun(state.tableau[col]);
    if (run) setSelected({ from: col, count: run });
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
      } else if (k === "d") dealStock();
      else if (k === "h") showHint();
      else if (k === "escape") setSelected(null);
      else if (selected && (k === "arrowup" || k === "arrowdown")) {
        e.preventDefault();
        const max = movableRun(state.tableau[selected.from]);
        setSelected({ ...selected, count: Math.min(max, Math.max(1, selected.count + (k === "arrowup" ? 1 : -1))) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return (
      <SpiderRecap
        game={game}
        date={date}
        state={state}
        hints={hints}
        undos={undos}
        finish={finish}
        firstRunAt={firstRunAt}
        revealedAllAt={revealedAllAt}
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

  // Coach highlight: the run to move and where it goes.
  const hintIds = new Set<number>();
  let hintTarget: number | null = null;
  const hintDeal = hint?.move.kind === "deal";
  if (hint && hint.move.kind === "move") {
    const m = hint.move;
    state.tableau[m.from].up.slice(-m.count).forEach((c) => hintIds.add(c.id));
    hintTarget = m.to;
  }
  const selectedIds = selected ? idsFor(selected) : new Set<number>();
  const runs = runsDone(state);
  const deals = dealsLeft(state);
  const stockRect = layout.piles.find((p) => p.pile.kind === "stock")!;
  const targetRect = hintTarget !== null ? layout.piles.find((p) => samePile(p.pile, { kind: "tableau", index: hintTarget! }))! : null;
  const targetTopY =
    hintTarget !== null
      ? Math.max(targetRect!.y, ...layout.cards.filter((c) => c.pile.kind === "tableau" && c.pile.index === hintTarget).map((c) => c.y))
      : 0;
  const subtitle = `${suitsLabel(suits)}${game.archive ? ` · ${shortDate(date)} · Archive` : ""}${isDaily ? "" : " · Practice"}`;

  return (
    <GameShell
      tint={GAME.tint}
      fullTint
      title={isDaily ? "Daily Spider" : "Spider Solitaire"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Moves {state.moves}</Chip>
          <Chip>Score {state.score}</Chip>
          {game.verified ? (
            <Chip dark>
              <Icon name="check" size={14} strokeWidth={2.4} />
              Winnable deal
            </Chip>
          ) : (
            <Chip>Not verified</Chip>
          )}
        </>
      }
    >
      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div ref={boardRef} className="relative w-full touch-none select-none" style={{ height: layout.height }} aria-label="Spider Solitaire table" role="application">
          {/* Empty pile outlines */}
          {layout.piles.map((p) => (
            <div
              key={`slot-${p.pile.kind}-${"index" in p.pile ? p.pile.index : 0}`}
              aria-hidden="true"
              onClick={p.pile.kind === "stock" ? dealStock : undefined}
              className="absolute flex items-center justify-center rounded-md border-2 border-dashed border-[#B7D79A] text-[#7D9C62]"
              style={{ left: p.x, top: p.y, width: layout.cardW, height: layout.cardH }}
            >
              {p.pile.kind === "foundation" && <span className="font-display text-[11px] font-bold">K</span>}
            </div>
          ))}

          {layout.cards.map((pos) => {
            const dragging = dragView?.ids.has(pos.card.id);
            const isStock = pos.pile.kind === "stock";
            const isStockTop = isStock && pos.z === state.stock.length - 1;
            const delay = pos.delayMs ?? dealDelay.get(pos.card.id) ?? 0;
            return (
              <div
                key={pos.card.id}
                onPointerDown={(e) => (isStock ? undefined : onCardDown(e, pos))}
                onPointerMove={onCardMove}
                onPointerUp={onCardUp}
                onPointerCancel={() => {
                  drag.current = null;
                  setDragView(null);
                }}
                onClick={isStock ? dealStock : undefined}
                className="absolute left-0 top-0"
                style={{
                  width: layout.cardW,
                  height: layout.cardH,
                  zIndex: dragging ? 1000 + pos.z : pos.z,
                  transform: `translate(${pos.x + (dragging ? dragView!.dx : 0)}px, ${pos.y + (dragging ? dragView!.dy : 0)}px)`,
                  transition: dragging ? "none" : `transform 200ms cubic-bezier(.2,.8,.2,1) ${delay}ms`,
                  cursor: pos.movable || isStock ? "pointer" : "default",
                }}
              >
                <CardFace
                  card={pos.card}
                  faceUp={pos.faceUp}
                  w={layout.cardW}
                  h={layout.cardH}
                  count={isStockTop ? deals : undefined}
                  dim={isStock && !!blocked}
                  ring={hintIds.has(pos.card.id) ? "coach" : selectedIds.has(pos.card.id) ? "select" : undefined}
                />
              </div>
            );
          })}

          {targetRect && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-md"
              style={{ left: targetRect.x - 2, top: targetTopY - 2, width: layout.cardW + 4, height: layout.cardH + 4, outline: "2px dashed #F26B1D", outlineOffset: 2, zIndex: 900 }}
            />
          )}
          {hintDeal && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-md"
              style={{ left: stockRect.x - 2, top: -2, width: stockRect.w + 4, height: layout.cardH + 4, boxShadow: "0 0 0 3px #F26B1D", zIndex: 900 }}
            />
          )}

          {/* Keyboard access: one focusable control per pile (pointer events go to the cards). */}
          {kbPiles.map((p, i) => (
            <button
              key={`kb-${i}`}
              ref={(el) => {
                pileButtons.current[i] = el;
              }}
              type="button"
              aria-label={pileLabel(state, p.pile, selected)}
              aria-pressed={p.pile.kind === "tableau" && selected?.from === p.pile.index ? true : undefined}
              onClick={() => (p.pile.kind === "tableau" ? chooseColumn(p.pile.index) : dealStock())}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  pileButtons.current[(i + (e.key === "ArrowRight" ? 1 : kbPiles.length - 1)) % kbPiles.length]?.focus();
                }
              }}
              className="pointer-events-none absolute rounded-md opacity-0 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#5B3DF5]"
              style={{ left: p.x, top: p.y, width: p.w, height: Math.min(p.h, layout.cardH * 3), zIndex: 950 }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4">
        <div className="flex justify-between text-[13px] font-semibold text-[#3B4D2A]">
          <span>Runs complete</span>
          <span className="font-mono">
            {runs} / {RUNS}
          </span>
        </div>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded bg-[#D9EEC4]">
          <div className="h-2 rounded bg-[#4F8A22] transition-[width]" style={{ width: `${(runs / RUNS) * 100}%` }} />
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
            {describeMove(state, hint.move)}.
            {why && <span className="mt-2 block">{whyText(hint)}</span>}
          </CoachCard>
        ) : noMove ? (
          <CoachCard heading="Coach" onClose={() => setNoMove(null)}>
            {noMove}
          </CoachCard>
        ) : (
          <CoachCard
            heading="Coach"
            tag={finish ? undefined : hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              finish
                ? undefined
                : hintsLeft
                  ? { label: "Show best move", onClick: showHint }
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
              ? "Won. Open the recap to see how you did."
              : hintsLeft
                ? "Tap a card to send its run to the best spot, or drag it. Stuck? I’ll find a move from a line that wins."
                : "You’ve used this deal’s three hints. Undo is unlimited: try a line, and take it back if it goes nowhere."}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 px-4">
        <ToolButton surface="white" icon="undo" label="Undo" onClick={undo} disabled={!past.length || !!finish} />
        <ToolButton surface="white" icon="redo" label="Redo" onClick={redo} disabled={!future.length || !!finish} />
        <ToolButton surface="white" icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={showHint} disabled={!hintsLeft || !!finish} />
        <ToolButton surface="white" icon="copy" label={`Deal · ${deals}`} onClick={dealStock} disabled={!!blocked || !!finish} />
        <ToolButton surface="white" icon="menu" label="Options" onClick={() => setPaused(true)} />
      </div>
      {blocked && state.stock.length > 0 && !finish && (
        <p className="m-0 px-4 text-center text-[13px] font-medium text-[#3B4D2A]">Fill every empty column to deal the next row.</p>
      )}

      {finish && (
        <div className="px-4">
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-[#111111] text-base font-semibold text-white">
            See recap
          </button>
        </div>
      )}

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          <div className="grid grid-cols-3 gap-2">
            {(["daily1", "daily2", "daily4"] as const).map((m) => {
              const unavailable = m === "daily4" && !has4;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={game.mode === m && !game.archive}
                  disabled={unavailable}
                  onClick={() => {
                    setPaused(false);
                    onMode(m);
                  }}
                  className={`min-h-11 rounded-full border text-sm font-semibold disabled:opacity-40 ${game.mode === m && !game.archive ? "border-ink bg-ink text-ground" : "border-line-strong text-ink"}`}
                >
                  Daily · {suitsLabel(suitsOf(m))}
                </button>
              );
            })}
          </div>
          {!has4 && <p className="m-0 text-xs text-muted">Today’s 4-suit deal is still being checked by the solver. Try again later today.</p>}
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 4] as const).map((n) => (
              <SheetButton
                key={n}
                onClick={() => {
                  setPaused(false);
                  onNewPractice(n);
                }}
              >
                Practice · {suitsLabel(n)}
              </SheetButton>
            ))}
          </div>
          <p className="m-0 text-xs text-muted">1- and 2-suit practice deals are checked winnable; 4-suit practice deals are random.</p>
        </PauseSheet>
      )}
    </GameShell>
  );
}

function pileLabel(state: State, pile: PileId, selected: Pick | null): string {
  if (pile.kind === "stock") {
    const blocked = dealBlocked(state);
    return blocked ? `Stock, ${dealsLeft(state)} deals left. ${blocked}` : `Stock, ${dealsLeft(state)} deals left. Deal a row`;
  }
  if (pile.kind === "foundation") return `Run ${pile.index + 1}`;
  const col = state.tableau[pile.index];
  const picked = selected?.from === pile.index ? `. Picked up ${selected.count} card${selected.count === 1 ? "" : "s"}` : "";
  return `Column ${pile.index + 1}: ${col.down.length} hidden, ${col.up.length ? col.up.map(cardLabel).join(", ") : "no face-up cards"}${picked}`;
}

function whyText(h: Hint): string {
  return `${h.text} ${h.winning ? "The solver checked a full winning line from here; this is its next step." : "No guaranteed win was found from here, so this is the most useful move by the usual priorities."}`;
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** A narrow card: rank and suit share the top strip, which is all that shows when cards overlap. */
function CardFace({ card, faceUp, w, h, count, dim, ring }: { card: Card; faceUp: boolean; w: number; h: number; count?: number; dim?: boolean; ring?: "coach" | "select" }) {
  const shadow = ring === "coach" ? "0 0 0 3px #F26B1D" : ring === "select" ? "0 0 0 3px #5B3DF5" : undefined;
  if (!faceUp) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-md border-[1.5px] border-white font-mono text-[12px] font-semibold text-white"
        style={{ background: "#5B3DF5", boxShadow: shadow ?? "0 0 0 1px #3A22C9", opacity: dim ? 0.55 : undefined }}
        aria-hidden="true"
      >
        {count}
      </div>
    );
  }
  const color = `var(--suit-${card.suit})`;
  const rankSize = Math.max(10, Math.round(w * 0.34));
  return (
    <div className="flex h-full w-full flex-col rounded-md border border-[#CADBB8] bg-white px-[3px] pt-[2px]" style={{ color, boxShadow: shadow }} aria-label={cardLabel(card)}>
      <span className="flex items-center gap-px leading-none">
        <span className="font-display font-bold tracking-[-0.06em]" style={{ fontSize: rankSize }}>
          {RANKS[card.rank]}
        </span>
        <SuitIcon suit={card.suit} size={Math.max(8, Math.round(w * 0.26))} color={color} />
      </span>
      <span className="mt-auto self-center pb-[3px] leading-none">
        <SuitIcon suit={card.suit} size={Math.round(Math.min(w * 0.55, h * 0.36))} color={color} />
      </span>
    </div>
  );
}

function SpiderRecap({
  game,
  date,
  state,
  hints,
  undos,
  finish,
  firstRunAt,
  revealedAllAt,
  onClose,
}: {
  game: Saved;
  date: string;
  state: State;
  hints: number;
  undos: number;
  finish: Finish;
  firstRunAt?: number;
  revealedAllAt?: number;
  onClose: () => void;
}) {
  const isDaily = game.mode !== "practice";
  const suits = state.suits;
  const short = shortDate(date);
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const params = new URLSearchParams({
    g: SLUG,
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(hints),
    mv: String(state.moves),
    lv: isDaily ? suitsLabel(suits) : `Practice · ${suitsLabel(suits)}`,
  });
  if (top !== null && isDaily) params.set("top", String(top));
  const text = [
    `Funzzle ${isDaily ? "Daily Spider" : "Spider practice"} · ${short} · ${suitsLabel(suits)}`,
    `${formatTime(finish.timeMs)}${top !== null && isDaily ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${state.moves} moves · ${hints} hint${hints === 1 ? "" : "s"} · ${undos} undo${undos === 1 ? "" : "s"}`,
    "funzzle.com/play/spider-solitaire",
  ].join("\n");

  const keyMove = revealedAllAt
    ? `at ${formatTime(revealedAllAt)} you turned over the last face-down card. With everything in view, the rest was sorting runs home.`
    : firstRunAt
      ? `at ${formatTime(firstRunAt)} your first King-to-Ace run went home. Every cleared run gives the other columns more room.`
      : "you cleared all eight runs.";
  const nextSkill =
    hints > 0
      ? "A no-hint win. Before each move, ask whether it turns over a card or keeps a suit together; that’s what the coach asks too."
      : undos > 30
        ? `Fewer take-backs. You undid ${undos} moves; before dealing, look for every move that turns a card over or joins a suit.`
        : suits === 1
          ? "Two suits. Mixed suits can’t move together, so building on the same suit starts to matter."
          : suits === 2
            ? "Four suits. Same-suit building and empty columns decide almost every game."
            : `Win in fewer moves. Count your moves next time and try to beat ${state.moves}.`;

  return (
    <Recap
      game={SLUG}
      heading={isDaily ? `Daily Spider · ${short}${game.archive ? " · archive" : ""}` : "Spider practice"}
      title="Won."
      timeMs={finish.timeMs}
      percentile={isDaily && !game.archive ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Moves", value: String(state.moves), note: `Score ${state.score}` },
        { label: "Hints", value: String(hints), note: hints ? "Coach helped" : "No help needed", good: !hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.archive ? "Archive deals are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: isDaily ? { kind: "daily", date, variant: `suits${suits}` } : { kind: "practice", seed: game.seed, level: `suits${suits}` },
        label: isDaily ? `Daily Spider · ${short} · ${suitsLabel(suits)}` : `Spider practice · ${suitsLabel(suits)}`,
        result: { timeMs: finish.timeMs, mistakes: 0, hints, moves: state.moves },
        activeId: game.challengeId,
      }}
      coach={{
        keyMove,
        nextSkill,
        learn: {
          title: "Three habits of strong Spider players",
          body: "1. Turn over face-down cards first, starting with the shortest columns. 2. Build on the same suit whenever you can: only same-suit runs move as one and get cleared. 3. Keep an empty column free until it lets you rearrange a run, and tidy up every column before you deal.",
        },
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={<PracticeAction game={SLUG} href={`/play/${SLUG}?practice=${suits}`} label="Deal a practice game" />}
    />
  );
}
