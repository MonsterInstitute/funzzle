"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import { Icon } from "@/components/kit/Icons";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import {
  applyMatch,
  bestMove,
  generateDeal,
  getLayout,
  isFree,
  isLayoutId,
  isStuck,
  isValidState,
  isWon,
  knownLine,
  matchCount,
  matchingPairs,
  remaining,
  rememberWinningLine,
  shuffleCount,
  shuffleRemaining,
  undo as undoMatch,
  type Hint,
  type LayoutId,
  type Pair,
  type State,
} from "@/lib/games/mahjong";
import { MAHJONG_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import type { DailyMahjong } from "@/lib/games/dailyPuzzles";
import { gameStats, recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { COMFORT_TILE_W, computeBoard, fitTileWidth, MAHJONG_BOARD_MAX } from "./board";
import {
  FREE_HINTS,
  hintsLeft as hintsLeftFor,
  keyMoveText,
  LEARN,
  layoutSummary,
  nextSkillText,
  PRACTICE_LAYOUTS,
  shuffleCost,
  skillsFor,
  tapTile,
  tileLabel,
  topCleared,
  type Mode,
} from "./play";
import TileFace from "./TileFace";

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
  /** Solver-verified: the deal's winning line replays to an empty board. */
  verified: boolean;
  /** The deal as dealt, for "Restart". */
  start: State;
  state: State;
  elapsed: number;
  hints: number;
  /** Extra hints earned from rewarded ads. */
  bonus?: number;
  /** Practice: the one free shuffle has been used. */
  freeShuffleUsed?: boolean;
  /** Elapsed ms when the top layer was cleared (recap's key move). */
  topClearedAt?: number;
  /** A winning line from `state`, so the coach answers instantly after a reload. */
  line?: Pair[];
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

const GAME = GAME_BY_SLUG.mahjong;
const MODE_KEY = "fz:mahjong:mode";
const KEY = (mode: Mode, date: string, archive = false) =>
  mode === "practice" ? "fz:mahjong:practice" : archive ? `fz:mahjong:archive:${date}` : `fz:mahjong:daily:${date}`;

function freshDaily(d: DailyMahjong): Saved {
  return { key: `${d.date}:${d.seed}`, mode: "daily", seed: d.seed, verified: true, start: d.state, state: d.state, elapsed: 0, hints: 0 };
}

function validSaved(s: Saved | null): s is Saved {
  return !!s && typeof s.key === "string" && isValidState(s.state) && isValidState(s.start);
}

/** Teach the coach the saved winning line, so its first hint after a reload is instant. */
function teach(s: Saved) {
  if (s.line) rememberWinningLine(s.state, s.line);
}

/** A solvable practice deal for a layout, and its winning line. */
function practiceDeal(layout: LayoutId, seed?: string): { seed: string; state: State; solution: Pair[] } {
  for (let i = 0; i < 8; i++) {
    const s = seed ?? `mahjong-practice:${crypto.randomUUID()}`;
    try {
      return { seed: s, ...generateDeal(layout, s) };
    } catch {
      if (seed) throw new Error(`No deal for ${seed}`);
    }
  }
  throw new Error("No practice deal");
}

/** Phones get the 72-tile board by default; larger screens the Turtle. */
const defaultPracticeLayout = (): LayoutId => (typeof window !== "undefined" && window.innerWidth < 640 ? "quick" : "turtle");

export default function MahjongGame({ date, daily }: { date: string; daily: DailyMahjong }) {
  const [game, setGame] = useState<Saved>(() => freshDaily(daily));
  const [loaded, setLoaded] = useState(false);

  const openDaily = useCallback(
    (challengeId?: string) => {
      const fresh = freshDaily(daily);
      const saved = readJson<Saved | null>(KEY("daily", date), null);
      const g = validSaved(saved) && saved.key === fresh.key ? saved : fresh;
      teach(g);
      setGame(challengeId ? { ...g, challengeId } : g);
    },
    [daily, date]
  );

  useEffect(() => {
    // The server's verified solution lets the coach answer instantly from the start.
    rememberWinningLine(daily.state, daily.solution);
    const last = readJson<Mode | null>(MODE_KEY, null);
    // "Deal a practice game" on the recap loads /play/mahjong?practice=<layout>
    // as a new page view (components/kit/PracticeAction).
    const params = new URLSearchParams(location.search);
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (challengeId) {
      fetchChallenge(challengeId)
        .then(async (c) => {
          if (c.game !== "mahjong") throw new Error("not a mahjong challenge");
          const p = c.puzzle;
          if (p.kind === "practice") {
            if (!isLayoutId(p.level)) throw new Error("bad layout");
            return openPracticeSeed(p.seed, p.level, challengeId);
          }
          if (p.date === date) return openDaily(challengeId);
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
    if (want !== null) {
      history.replaceState(null, "", location.pathname);
      newPractice(isLayoutId(want) ? want : defaultPracticeLayout());
    } else if (last === "practice") {
      const saved = readJson<Saved | null>(KEY("practice", date), null);
      if (validSaved(saved) && !saved.done) {
        teach(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage
        setGame(saved);
      } else openDaily();
    } else {
      openDaily();
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [daily, date, openDaily]);

  /** A past day's daily deal: the stored one, or fetched from the archive API. */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(KEY("daily", day, true), null);
    if (validSaved(saved) && !challengeId) {
      teach(saved);
      return setGame(saved);
    }
    try {
      const res = await fetch(`/api/daily-puzzle?game=mahjong&date=${day}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return openDaily();
      const d = (await res.json()) as DailyMahjong;
      if (!isValidState(d.state)) return openDaily();
      const verified = rememberWinningLine(d.state, d.solution);
      setGame({ ...freshDaily(d), verified, key: `archive:${day}:${d.seed}`, archive: true, date: day, challengeId });
    } catch {
      openDaily();
    }
  }

  function openPracticeSeed(seed: string, layout: LayoutId, challengeId: string) {
    const d = practiceDeal(layout, seed);
    const verified = rememberWinningLine(d.state, d.solution);
    setGame({ key: `${seed}:${challengeId}`, mode: "practice", seed, verified, start: d.state, state: d.state, elapsed: 0, hints: 0, challengeId });
  }

  function newPractice(layout: LayoutId) {
    countPractice("mahjong");
    const d = practiceDeal(layout);
    const verified = rememberWinningLine(d.state, d.solution);
    const next: Saved = { key: d.seed, mode: "practice", seed: d.seed, verified, start: d.state, state: d.state, elapsed: 0, hints: 0 };
    writeJson(KEY("practice", date), next);
    writeJson(MODE_KEY, "practice");
    setGame(next);
  }

  const goDaily = () => {
    writeJson(MODE_KEY, "daily");
    openDaily();
  };

  return (
    <Table key={`${loaded}:${game.key}`} game={game} date={game.date ?? date} inert={!loaded} onDaily={goDaily} onNewPractice={newPractice} />
  );
}

const WHY: Record<Hint["reason"], string> = {
  "last-two": "When only two of a kind are left, they can only ever pair with each other, so taking them costs nothing.",
  "all-four": "With all four of a kind free, every way of pairing them works out the same: no choice to get wrong.",
  "keep-third": "Three of a kind are free, so one pairing is better than the others. Keep the third tile where it blocks the least, ready for the fourth.",
  frees: "Every tile you uncover is a new tile in play. Matches that free tiles under a stack or along a row keep your options open.",
  step: "Nothing opens up yet, so the coach takes the pair that holds up the most tiles.",
};

function whyText(h: Hint): string {
  return `${WHY[h.reason]} ${h.winning ? "The solver checked a line that clears the whole board from here; this is its next match." : "No full clear was found from here in time, so this is the best match by the usual priorities."}`;
}

function Table({
  game,
  date,
  inert,
  onDaily,
  onNewPractice,
}: {
  game: Saved;
  date: string;
  inert: boolean;
  onDaily: () => void;
  onNewPractice: (layout: LayoutId) => void;
}) {
  const storageKey = KEY(game.mode, date, game.archive);
  const [state, setState] = useState<State>(game.state);
  const [future, setFuture] = useState<State[]>([]);
  const [hints, setHints] = useState(game.hints);
  const [bonus, setBonus] = useState(game.bonus ?? 0);
  const [freeShuffleUsed, setFreeShuffleUsed] = useState(!!game.freeShuffleUsed);
  const [topClearedAt, setTopClearedAt] = useState(game.topClearedAt);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [why, setWhy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [zoom, setZoom] = useState(1);
  const [afterAd, setAfterAd] = useState<"hint" | "shuffle" | null>(null);
  const won = isWon(state);
  const timer = useTimer(!inert && !paused && !won && !finish, game.elapsed);
  const started = useRef(false);
  const isDaily = game.mode === "daily";
  // Today's daily deal is ranked; archive deals aren't.
  const ranked = isDaily && !game.archive;
  const layout = getLayout(state.layout);
  const left = hintsLeftFor(hints, bonus);
  const stuck = isStuck(state);
  const cost = shuffleCost(game.mode, freeShuffleUsed);
  const outOfHints = left === 0;
  const bonusOffer = useRewardedOffer("mahjong-extra-hint", "mahjong", outOfHints && !finish && !inert);
  // The shuffle a stuck board would get (deterministic), or null when no
  // arrangement of the remaining tiles can be cleared.
  const shuffled = useMemo(() => (stuck ? shuffleRemaining(state, `${game.seed}:shuffle:${state.history.length}`) : null), [stuck, state, game.seed]);
  const openPairs = useMemo(() => matchingPairs(state).length, [state]);

  // Board size follows the container (and, on desktop, the window height).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<{ w: number; h: number }>({ w: 358, h: Infinity });
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 32;
      // Phones fit the width; wide screens also keep the board within the window's height.
      const h = window.innerWidth >= 640 ? Math.max(320, window.innerHeight - 300) : Infinity;
      setAvail((a) => (a.w === w && a.h === h ? a : { w, h }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const fit = fitTileWidth(state.layout, avail.w, avail.h);
  const canZoom = fit < COMFORT_TILE_W;
  const board = useMemo(() => computeBoard(state.layout, avail.w, avail.h, canZoom ? zoom : 1), [state.layout, avail, zoom, canZoom]);

  const commit = useCallback(
    (next: State) => {
      setState(next);
      setFuture([]);
      setSelected(null);
      setHint(null);
      setWhy(false);
      setNote(null);
      if (topClearedAt === undefined && topCleared(next)) setTopClearedAt(Math.round(timer.now()));
    },
    [timer, topClearedAt]
  );

  const play = (pair: Pair) => {
    try {
      commit(applyMatch(state, pair));
    } catch {
      setSelected(null);
    }
  };

  const undo = () => {
    if (!state.history.length) return;
    setFuture((f) => [state, ...f]);
    setState(undoMatch(state));
    setSelected(null);
    setHint(null);
    setNote(null);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setState(next);
    setSelected(null);
    setHint(null);
    setNote(null);
  };
  const restart = () => {
    setState(game.start);
    setFuture([]);
    setSelected(null);
    setHint(null);
    setNote(null);
  };

  // Save progress.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, {
      ...game,
      state,
      hints,
      bonus,
      freeShuffleUsed,
      topClearedAt,
      line: won ? undefined : knownLine(state),
      elapsed: timer.now(),
      done: finish ?? undefined,
    } satisfies Saved);
    // timer.now is read on purpose without re-running every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hints, bonus, freeShuffleUsed, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "mahjong", { mode: game.mode, layout: state.layout });
  }, [inert, finish, game.mode, state.layout]);

  // Cleared: rank (today's daily), rating and skills. Mahjong isn't in the Daily Set.
  useEffect(() => {
    if (!won || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const matches = matchCount(state);
    const shuffles = shuffleCount(state);
    track("game_complete", "mahjong", { mode: game.mode, layout: state.layout, timeMs, moves: matches, hints, shuffles });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = isDaily ? `${date}:${state.layout}` : `practice:${game.seed}`;
      // Archive deals are unrated: the day's field has moved on.
      const { rating, delta } = game.archive
        ? { rating: getRating("mahjong").rating, delta: 0 }
        : recordMatch("mahjong", key, {
            puzzleRating: MAHJONG_PUZZLE_RATING[state.layout],
            won: true,
            percentile: percentile ?? undefined,
            hints,
            mistakes: 0,
          });
      const clearedBefore = gameStats("mahjong").levels;
      recordFinish("mahjong", { won: true, timeMs, hints, level: state.layout, skills: skillsFor({ layout: state.layout, hints, shuffles, timeMs, clearedBefore }) });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating, streak: getStreak().current });
    };
    // The clear is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    if (ranked) {
      submitResult({ game: "mahjong", date, variant: state.layout, timeMs, mistakes: 0, hints, moves: matches }).then((res) =>
        finalize(res ? res.percentile : undefined, res)
      );
    } else finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const showHint = () => {
    if (finish || inert) return;
    if (left <= 0) return;
    const h = bestMove(state);
    if (!h) return;
    setHints((n) => n + 1);
    track("hint_used", "mahjong", { reason: h.reason, winning: h.winning });
    setHint(h);
    setWhy(false);
    setSelected(null);
    setNote(null);
  };

  const shuffle = () => {
    if (!stuck || finish || inert) return;
    if (!shuffled) return;
    if (cost && left <= 0) return;
    rememberWinningLine(shuffled.state, shuffled.solution);
    if (cost) setHints((n) => n + 1);
    else setFreeShuffleUsed(true);
    track("hint_used", "mahjong", { reason: "shuffle", free: !cost });
    commit(shuffled.state);
  };

  // The bonus hint (or shuffle) runs as soon as the rewarded ad has been watched.
  useEffect(() => {
    if (!afterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setAfterAd(null);
    if (afterAd === "shuffle") shuffle();
    else showHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterAd, outOfHints]);

  const watchForHint = async (then: "hint" | "shuffle") => {
    if (await bonusOffer.watch()) {
      setBonus((b) => b + 1);
      setAfterAd(then);
    }
  };

  const onTile = (p: number) => {
    if (inert || paused || finish) return;
    const r = tapTile(state, selected, p);
    switch (r.kind) {
      case "none":
        return;
      case "blocked":
        setSelected(null);
        setNote(r.text);
        return;
      case "deselect":
        setSelected(null);
        return;
      case "select":
        setSelected(r.p);
        setNote(null);
        return;
      case "match":
        play(r.pair);
        return;
    }
  };

  // Keyboard: H hint, U / Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, S shuffle, Esc deselect.
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
      else if (k === "u") undo();
      else if (k === "s") shuffle();
      else if (k === "escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <MahjongRecap game={game} date={date} state={state} hints={hints} finish={finish} topClearedAt={topClearedAt} onClose={() => setShowRecap(false)} />;
  }
  if (showRecap) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center" style={{ background: GAME.tint }}>
        <p className="text-lg font-semibold text-[#111111]">Cleared! Comparing with today’s players…</p>
      </div>
    );
  }

  const hinted = new Set(hint ? hint.pair : []);
  const total = state.tiles.length;
  const gone = total - remaining(state);
  const canShuffle = stuck && !!shuffled && (cost === 0 || left > 0) && !finish;
  const subtitle = `${layout.name} · ${total} tiles${game.archive ? " · Archive" : isDaily ? "" : " · Practice"}`;

  let coach;
  if (hint) {
    coach = (
      <CoachCard
        heading="Coach · Show a match"
        tag={hint.winning ? "Winning line" : "Best guess"}
        onClose={() => setHint(null)}
        primary={{ label: "Match these", onClick: () => play(hint.pair) }}
        secondary={why ? undefined : { label: "Why this one?", onClick: () => setWhy(true) }}
      >
        {hint.text}
        {why && <span className="mt-2 block">{whyText(hint)}</span>}
      </CoachCard>
    );
  } else if (stuck && !finish) {
    if (!shuffled) {
      coach = (
        <CoachCard heading="Coach · Stuck" primary={{ label: "Undo", onClick: undo }} secondary={{ label: "Restart deal", onClick: restart }}>
          No free pairs left, and these {remaining(state)} tiles can’t be cleared in any order: two of a kind are stacked so one always blocks the other. Undo a few matches to take another path, or restart the deal.
        </CoachCard>
      );
    } else if (cost === 0) {
      coach = (
        <CoachCard heading="Coach · Stuck" primary={{ label: "Shuffle (free)", onClick: shuffle }} secondary={{ label: "Undo", onClick: undo }}>
          No free pairs left. Your first shuffle in practice is free: it deals the remaining tiles again into a position that can be cleared. Or undo a few matches and try another way.
        </CoachCard>
      );
    } else if (left > 0) {
      coach = (
        <CoachCard heading="Coach · Stuck" tag={`${left} hint${left === 1 ? "" : "s"} left`} primary={{ label: "Shuffle · uses a hint", onClick: shuffle }} secondary={{ label: "Undo", onClick: undo }}>
          No free pairs left. A shuffle deals the remaining tiles again into a position that can be cleared, and counts as one hint. Or undo a few matches and try another way.
        </CoachCard>
      );
    } else {
      coach = (
        <CoachCard
          heading="Coach · Stuck"
          tag="No hints left"
          primary={bonusOffer.ready ? { label: "Watch an ad for one more hint", onClick: () => watchForHint("shuffle") } : { label: "Undo", onClick: undo }}
          secondary={bonusOffer.ready ? { label: "Undo", onClick: undo } : { label: "Restart deal", onClick: restart }}
        >
          No free pairs left, and a shuffle needs a hint. Undo a few matches to find another way{bonusOffer.ready ? ", or watch a short ad for one more hint and shuffle" : ", or restart the deal"}.
        </CoachCard>
      );
    }
  } else if (note) {
    coach = (
      <CoachCard heading="Coach" onClose={() => setNote(null)}>
        {note}
      </CoachCard>
    );
  } else {
    coach = (
      <CoachCard
        heading="Coach"
        tag={left ? `${left} hint${left === 1 ? "" : "s"} left` : "No hints left"}
        primary={
          finish
            ? undefined
            : left
              ? { label: "Show a match", onClick: showHint }
              : bonusOffer.ready
                ? { label: "Watch an ad for one more hint", onClick: () => watchForHint("hint") }
                : undefined
        }
      >
        {finish
          ? "Cleared. Open the recap to see how you did."
          : left
            ? `Tap two matching free tiles to remove them. A tile is free when nothing is on it and its left or right side is open. Stuck? I’ll show a match from a line that clears the board.${canZoom && isDaily ? " Small screen? Zoom in, or play the 72-tile Quick board from Options." : ""}`
            : `You’ve used your ${FREE_HINTS} hints. Look for kinds where all four tiles are free: any pairing of those is safe.`}
      </CoachCard>
    );
  }

  return (
    <GameShell
      tint={GAME.tint}
      fullTint
      maxWidth={MAHJONG_BOARD_MAX}
      title={isDaily ? "Daily Mahjong" : "Mahjong"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Tiles {remaining(state)}</Chip>
          <Chip>Open pairs {openPairs}</Chip>
          {canZoom && (
            <Chip onClick={() => setZoom((z) => (z > 1 ? 1 : 1.6))} pressed={zoom > 1}>
              Zoom {zoom > 1 ? "on" : "off"}
            </Chip>
          )}
          {game.verified && (
            <Chip dark>
              <Icon name="check" size={14} strokeWidth={2.4} />
              Solvable deal
            </Chip>
          )}
        </>
      }
    >
      <div ref={wrapRef} className="w-full overflow-x-auto px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div role="group" aria-label={`Mahjong board, ${layout.name}`} className="relative mx-auto select-none" style={{ width: board.width, height: board.height }}>
          {board.tiles.map((t, i) => {
            const id = state.tiles[t.p];
            const isGone = state.removed[t.p];
            const free = !isGone && isFree(state, t.p);
            const sel = selected === t.p;
            const isHint = hinted.has(t.p);
            const e = board.edge;
            const ring = isHint ? "inset 0 0 0 3px #F26B1D" : sel ? "inset 0 0 0 3px #5B3DF5" : "";
            return (
              <button
                key={t.p}
                type="button"
                data-pos={t.p}
                data-tile={id}
                data-free={free ? "1" : undefined}
                data-hint={isHint ? "1" : undefined}
                tabIndex={free ? 0 : -1}
                disabled={isGone || inert}
                aria-hidden={isGone || undefined}
                aria-label={isGone ? undefined : tileLabel(state, t.p, { selected: sel, hinted: isHint })}
                aria-pressed={isGone ? undefined : sel}
                title={isGone ? undefined : tileLabel(state, t.p)}
                onClick={() => onTile(t.p)}
                className="absolute p-0 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[#5B3DF5]"
                style={{
                  left: t.left,
                  top: t.top,
                  width: board.tileW,
                  height: board.tileH,
                  zIndex: i + 1,
                  borderRadius: board.tileW * 0.14,
                  border: "1px solid #E3D2C0",
                  background: isHint ? "#FFEBDD" : sel ? "#ECE8FF" : free ? "#FFFDF7" : "#F2EADF",
                  boxShadow: `${ring ? `${ring}, ` : ""}${e * 0.5}px ${e * 0.5}px 0 #EBC0BA, ${e}px ${e}px 0 #C9746E, ${e + 1 + t.z}px ${e + 2 + t.z * 1.5}px ${Math.max(2, e * 1.5) + t.z * 2}px rgba(70,25,25,${0.24 + t.z * 0.04})`,
                  opacity: isGone ? 0 : 1,
                  visibility: isGone ? "hidden" : undefined,
                  transform: isGone ? "scale(0.85)" : sel ? "translate(-1px, -2px)" : undefined,
                  transition: isGone
                    ? "opacity 160ms ease-out, transform 160ms ease-out, visibility 0s 160ms"
                    : "opacity 160ms ease-out, transform 120ms ease-out, background-color 120ms",
                  cursor: free ? "pointer" : "default",
                  pointerEvents: isGone ? "none" : undefined,
                  touchAction: "manipulation",
                }}
              >
                <span className="block h-full w-full p-[6%]" style={{ opacity: free ? 1 : 0.8 }}>
                  <TileFace id={id} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3.5">
        <div className="flex flex-col gap-2 px-4">
          <div className="flex justify-between text-[13px] font-semibold text-[#5A2A26]">
            <span>Tiles cleared</span>
            <span className="font-mono">
              {gone} / {total}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded bg-[#F8D3CF]">
            <div className="h-2 rounded bg-[#B3473F] transition-[width]" style={{ width: `${(gone / total) * 100}%` }} />
          </div>
        </div>

        <div className="px-4">{coach}</div>

        <div className="grid grid-cols-5 gap-2 px-4">
          <ToolButton surface="white" icon="undo" label="Undo" onClick={undo} disabled={!state.history.length} />
          <ToolButton surface="white" icon="redo" label="Redo" onClick={redo} disabled={!future.length} />
          <ToolButton surface="white" icon="hint" label={`Hint · ${left}`} accent onClick={showHint} disabled={!left || !!finish || stuck} />
          <ToolButton surface="white" icon="refresh" label="Shuffle" onClick={shuffle} disabled={!canShuffle} />
          <ToolButton surface="white" icon="menu" label="Options" onClick={() => setPaused(true)} />
        </div>

        {finish && (
          <div className="px-4">
            <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-[#111111] text-base font-semibold text-white">
              See recap
            </button>
          </div>
        )}
      </div>

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          {!(isDaily && !game.archive) && (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onDaily();
              }}
            >
              Today’s Daily Mahjong · Turtle
            </SheetButton>
          )}
          <span className="mt-1 text-sm font-semibold">New practice deal</span>
          <div className="grid grid-cols-2 gap-2">
            {PRACTICE_LAYOUTS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPaused(false);
                  onNewPractice(id);
                }}
                className="min-h-11 rounded-full border border-line-strong px-3 text-sm font-semibold text-ink"
              >
                {layoutSummary(id)}
              </button>
            ))}
          </div>
          <SheetButton
            onClick={() => {
              setPaused(false);
              restart();
            }}
          >
            Restart this deal
          </SheetButton>
        </PauseSheet>
      )}
    </GameShell>
  );
}

function MahjongRecap({
  game,
  date,
  state,
  hints,
  finish,
  topClearedAt,
  onClose,
}: {
  game: Saved;
  date: string;
  state: State;
  hints: number;
  finish: Finish;
  topClearedAt?: number;
  onClose: () => void;
}) {
  const isDaily = game.mode === "daily";
  const layout = getLayout(state.layout);
  const matches = matchCount(state);
  const shuffles = shuffleCount(state);
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const params = new URLSearchParams({
    g: "mahjong",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(hints),
    mv: String(matches),
    lv: isDaily ? layout.name : `Practice · ${layout.name}`,
  });
  if (top !== null && isDaily) params.set("top", String(top));
  const text = [
    `Funzzle ${isDaily ? "Daily Mahjong" : "Mahjong practice"} · ${short} · ${layout.name}`,
    `${formatTime(finish.timeMs)}${top !== null && isDaily ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${matches} pairs · ${hints} hint${hints === 1 ? "" : "s"}${shuffles ? ` · ${shuffles} shuffle${shuffles === 1 ? "" : "s"}` : ""}`,
    "funzzle.com/play/mahjong",
  ].join("\n");

  return (
    <Recap
      game="mahjong"
      heading={isDaily ? `Daily Mahjong · ${short}${game.archive ? " · archive" : ""}` : "Mahjong practice"}
      title="Cleared."
      timeMs={finish.timeMs}
      percentile={isDaily && !game.archive ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Pairs", value: String(matches), note: shuffles ? `${shuffles} shuffle${shuffles === 1 ? "" : "s"}` : "No shuffles", good: !shuffles },
        { label: "Hints", value: String(hints), note: hints ? "Coach helped" : "No help needed", good: !hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.archive ? "Archive deals are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: isDaily ? { kind: "daily", date, variant: state.layout } : { kind: "practice", seed: game.seed, level: state.layout },
        label: isDaily ? `Daily Mahjong · ${short} · ${layout.name}` : `Mahjong practice · ${layout.name}`,
        result: { timeMs: finish.timeMs, mistakes: 0, hints, moves: matches },
        activeId: game.challengeId,
      }}
      coach={{
        keyMove: keyMoveText(state, topClearedAt),
        nextSkill: nextSkillText(state, hints, finish.timeMs),
        learn: LEARN,
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={<PracticeAction game="mahjong" href={`/play/mahjong?practice=${state.layout}`} label="Deal a practice game" />}
    />
  );
}
