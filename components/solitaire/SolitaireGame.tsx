"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import { Icon } from "@/components/kit/Icons";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import Recap from "@/components/kit/Recap";
import SuitIcon from "@/components/kit/SuitIcon";
import {
  applyMove,
  autoFinish,
  bestMove,
  canAutoFinish,
  cardLabel,
  deal,
  isWon,
  rememberWinningLine,
  solve,
  SUITS,
  type Card,
  type Move,
  type State,
} from "@/lib/games/solitaire";
import type { Hint } from "@/lib/games/solitaire";
import { SOLITAIRE_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import type { DailySolitaire } from "@/lib/games/dailyPuzzles";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getStreak, markDone, setStatus } from "@/lib/games/kit/daily";
import { recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { computeLayout, samePile, type CardPos, type PileId } from "./layout";
import { autoMove, cardsHome, hiddenCount, moveFor, type Pick } from "./moves";

type Mode = "daily1" | "daily3" | "practice";

interface Saved {
  key: string;
  mode: Mode;
  seed: string;
  /** Solver-verified winnable (always true for daily deals). */
  verified: boolean;
  state: State;
  elapsed: number;
  hints: number;
  /** Elapsed ms when the last hidden card was turned over. */
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

const GAME = GAME_BY_SLUG.solitaire;
const KEY = (mode: Mode, date: string) => (mode === "practice" ? "fz:solitaire:practice" : `fz:solitaire:${mode}:${date}`);

function freshDaily(d: DailySolitaire, mode: Mode): Saved {
  return { key: `${d.date}:${d.seed}`, mode, seed: d.seed, verified: true, state: d.state, elapsed: 0, hints: 0 };
}

export default function SolitaireGame({ date, daily1, daily3 }: { date: string; daily1: DailySolitaire; daily3: DailySolitaire }) {
  const [game, setGame] = useState<Saved>(() => freshDaily(daily1, "daily1"));
  const [loaded, setLoaded] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  const openDaily = useCallback(
    (mode: "daily1" | "daily3") => {
      const d = mode === "daily1" ? daily1 : daily3;
      const fresh = freshDaily(d, mode);
      const saved = readJson<Saved | null>(KEY(mode, date), null);
      setGame(saved && saved.key === fresh.key ? saved : fresh);
    },
    [daily1, daily3, date]
  );

  useEffect(() => {
    // The server's verified solution lets the coach answer instantly from the start.
    rememberWinningLine(daily1.state, daily1.solution);
    rememberWinningLine(daily3.state, daily3.solution);
    const last = readJson<Mode | null>("fz:solitaire:mode", null);
    if (last === "practice") {
      const saved = readJson<Saved | null>(KEY("practice", date), null);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage
      if (saved && !saved.done) setGame(saved);
      else openDaily("daily1");
    } else {
      openDaily(last === "daily3" ? "daily3" : "daily1");
    }
    setLoaded(true);
  }, [daily1, daily3, date, openDaily]);

  const newPractice = (draw: 1 | 3) => {
    setShuffling(true);
    // Let the "Shuffling" state paint before the solver runs.
    setTimeout(() => {
      let chosen: { seed: string; state: State; verified: boolean } | null = null;
      for (let i = 0; i < 6 && !chosen; i++) {
        const seed = `solitaire-practice:${crypto.randomUUID()}`;
        const state = deal(seed, draw);
        const res = solve(state, { maxNodes: 60_000 });
        if (res.result === "win") chosen = { seed, state, verified: true };
        else if (i === 5) chosen = { seed, state, verified: false };
      }
      const next: Saved = { key: chosen!.seed, mode: "practice", seed: chosen!.seed, verified: chosen!.verified, state: chosen!.state, elapsed: 0, hints: 0 };
      writeJson(KEY("practice", date), next);
      writeJson("fz:solitaire:mode", "practice");
      setGame(next);
      setShuffling(false);
    }, 30);
  };

  const switchMode = (mode: Mode) => {
    writeJson("fz:solitaire:mode", mode);
    if (mode === "practice") {
      const saved = readJson<Saved | null>(KEY("practice", date), null);
      if (saved && !saved.done) setGame(saved);
      else newPractice(1);
    } else openDaily(mode);
  };

  if (shuffling) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center" style={{ background: GAME.tint }}>
        <p className="font-display text-2xl font-bold text-[#111111]">Shuffling a winnable deal…</p>
      </div>
    );
  }
  return <Table key={`${loaded}:${game.key}`} game={game} date={date} inert={!loaded} onMode={switchMode} onNewPractice={newPractice} />;
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
  onNewPractice: (draw: 1 | 3) => void;
}) {
  const storageKey = KEY(game.mode, date);
  const [state, setState] = useState<State>(game.state);
  const [past, setPast] = useState<State[]>([]);
  const [future, setFuture] = useState<State[]>([]);
  const [hints, setHints] = useState(game.hints);
  const [revealedAllAt, setRevealedAllAt] = useState(game.revealedAllAt);
  const [hint, setHint] = useState<Hint | null>(null);
  const [why, setWhy] = useState(false);
  const [noMove, setNoMove] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [selected, setSelected] = useState<Pick | null>(null);
  const won = isWon(state);
  const timer = useTimer(!inert && !paused && !won && !finish, game.elapsed);
  const started = useRef(false);
  const draw = state.draw;
  const isDaily = game.mode !== "practice";

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

  // Latest state for handlers that run later (auto-finish timers, pointer-up).
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const play = useCallback(
    (move: Move, opts: { fromHint?: boolean } = {}) => {
      const s = stateRef.current;
      let next: State;
      try {
        next = applyMove(s, move);
      } catch {
        return;
      }
      stateRef.current = next;
      setState(next);
      setPast((p) => [...p, s].slice(-500));
      setFuture([]);
      if (hiddenCount(s) > 0 && hiddenCount(next) === 0) setRevealedAllAt(Math.round(timer.now()));
      setSelected(null);
      setNoMove(null);
      if (!opts.fromHint) setHint(null);
      setWhy(false);
    },
    [timer]
  );

  const undo = () => {
    const prev = past.at(-1);
    if (!prev || autoPlaying) return;
    setFuture((f) => [state, ...f]);
    setPast((p) => p.slice(0, -1));
    setState(prev);
    setHint(null);
  };
  const redo = () => {
    const next = future[0];
    if (!next || autoPlaying) return;
    setPast((p) => [...p, state]);
    setFuture((f) => f.slice(1));
    setState(next);
    setHint(null);
  };

  // Save progress and the homepage line.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, hints, revealedAllAt, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    if (isDaily && !finish && state.moves > 0) {
      setStatus("solitaire", date, { state: "playing", meta: `Draw ${draw} · ${cardsHome(state)} of 52 cards home · ${formatClock(timer.now())}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hints, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "solitaire", { mode: game.mode, draw });
  }, [inert, finish, game.mode, draw]);

  // Win: rank, rating, streak, Daily Set.
  useEffect(() => {
    if (!won || finish || inert) return;
    const timeMs = Math.round(timer.now());
    track("game_complete", "solitaire", { mode: game.mode, draw, timeMs, moves: state.moves, hints });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = isDaily ? `${date}:draw${draw}` : `practice:${game.seed}`;
      const { rating, delta } = recordMatch("solitaire", key, {
        puzzleRating: SOLITAIRE_PUZZLE_RATING[draw],
        won: true,
        percentile: percentile ?? undefined,
        hints,
        mistakes: 0,
      });
      if (isDaily) markDone("solitaire", date, { timeMs, hints, percentile: percentile ?? undefined, ratingDelta: delta, label: `Draw ${draw}` });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating, streak: getStreak().current });
    };
    // The win is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    if (isDaily) {
      submitResult({ game: "solitaire", date, variant: `draw${draw}`, timeMs, mistakes: 0, hints, moves: state.moves }).then((res) =>
        finalize(res ? res.percentile : undefined, res)
      );
    } else finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const runAutoFinish = () => {
    if (!canAutoFinish(state) || autoPlaying) return;
    const moves = autoFinish(state);
    setAutoPlaying(true);
    moves.forEach((m, i) => setTimeout(() => {
      play(m);
      if (i === moves.length - 1) setAutoPlaying(false);
    }, 70 * i));
  };

  const showHint = () => {
    if (finish || autoPlaying) return;
    const h = bestMove(state);
    if (!h) {
      setHint(null);
      setNoMove("No useful moves left. Undo a few moves, or deal again from Options.");
      return;
    }
    setHints((n) => n + 1);
    track("hint_used", "solitaire", { reason: h.reason, winning: h.winning });
    setHint(h);
    setWhy(false);
  };

  const drawOrRecycle = () => {
    if (state.stock.length) play({ kind: "draw" });
    else if (state.waste.length) play({ kind: "recycle" });
  };

  // ----- Pointer: tap to auto-move, drag to a specific pile -----
  const drag = useRef<{ pick: Pick; ids: Set<number>; startX: number; startY: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [dragView, setDragView] = useState<{ ids: Set<number>; dx: number; dy: number } | null>(null);

  const pickFor = (pos: CardPos): Pick | null => {
    if (!pos.movable) return null;
    if (pos.pile.kind === "tableau") {
      const col = state.tableau[pos.pile.index];
      return { pile: pos.pile, count: col.up.length - (pos.runIndex ?? 0) };
    }
    return { pile: pos.pile, count: 1 };
  };
  const idsFor = (pick: Pick): Set<number> => {
    if (pick.pile.kind === "tableau") return new Set(state.tableau[pick.pile.index].up.slice(-pick.count).map((c) => c.id));
    if (pick.pile.kind === "waste") return new Set([state.waste.at(-1)!.id]);
    if (pick.pile.kind === "foundation") return new Set([state.foundations[pick.pile.index].at(-1)!.id]);
    return new Set();
  };

  const onCardDown = (e: ReactPointerEvent, pos: CardPos) => {
    if (paused || finish || autoPlaying) return;
    if (pos.pile.kind === "stock") return;
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
      // Tap: if a pick is selected (keyboard), tapping counts as choosing a target.
      const m = autoMove(state, d.pick);
      if (m) play(m);
      else setNoMove("That card has no move right now.");
      return;
    }
    const rect = boardRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const target = layout.piles.find((p) => x >= p.x - 4 && x <= p.x + p.w + 4 && y >= p.y - 4 && y <= p.y + p.h + 30);
    if (!target) return;
    const m = moveFor(state, d.pick, target.pile);
    if (m) play(m);
  };

  // ----- Keyboard -----
  const pileButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const choosePile = (pile: PileId) => {
    if (pile.kind === "stock") {
      drawOrRecycle();
      return;
    }
    if (selected) {
      const m = samePile(selected.pile, pile) ? autoMove(state, selected) : moveFor(state, selected, pile);
      if (m) play(m);
      else setNoMove("That move isn’t allowed.");
      setSelected(null);
      return;
    }
    const top = [...layout.cards].reverse().find((c) => samePile(c.pile, pile) && c.movable);
    if (!top) return;
    const pick = pickFor(top);
    if (pick) setSelected(pile.kind === "tableau" ? { ...pick, count: 1 } : pick);
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
      } else if (k === "d") drawOrRecycle();
      else if (k === "h") showHint();
      else if (k === "a") runAutoFinish();
      else if (k === "escape") setSelected(null);
      else if (selected && selected.pile.kind === "tableau" && (k === "arrowup" || k === "arrowdown")) {
        e.preventDefault();
        const max = state.tableau[selected.pile.index].up.length;
        setSelected({ ...selected, count: Math.min(max, Math.max(1, selected.count + (k === "arrowup" ? 1 : -1))) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <SolitaireRecap game={game} date={date} state={state} hints={hints} finish={finish} revealedAllAt={revealedAllAt} onClose={() => setShowRecap(false)} onNewPractice={onNewPractice} />;
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
    const wasteTop = state.waste.at(-1);
    if ((m.kind === "waste-to-tableau" || m.kind === "waste-to-foundation") && wasteTop) hintIds.add(wasteTop.id);
    if (m.kind === "tableau-to-foundation") hintIds.add(state.tableau[m.from].up.at(-1)!.id);
    if (m.kind === "tableau-to-tableau") state.tableau[m.from].up.slice(-m.count).forEach((c) => hintIds.add(c.id));
    if (m.kind === "foundation-to-tableau") hintIds.add(state.foundations[SUITS.indexOf(m.suit)].at(-1)!.id);
    if ("to" in m) hintTarget = { kind: "tableau", index: m.to };
    if (m.kind === "waste-to-foundation" || m.kind === "tableau-to-foundation") {
      const card = m.kind === "waste-to-foundation" ? state.waste.at(-1)! : state.tableau[m.from].up.at(-1)!;
      hintTarget = { kind: "foundation", index: SUITS.indexOf(card.suit) };
    }
    if (m.kind === "draw" || m.kind === "recycle") hintTarget = { kind: "stock" };
  }
  const selectedIds = selected ? idsFor(selected) : new Set<number>();
  const home = cardsHome(state);
  const pileRect = (p: PileId) => layout.piles.find((r) => samePile(r.pile, p))!;
  const targetRect = hintTarget ? pileRect(hintTarget) : null;
  const targetTopY = hintTarget && hintTarget.kind === "tableau"
    ? Math.max(targetRect!.y, ...layout.cards.filter((c) => samePile(c.pile, hintTarget!)).map((c) => c.y))
    : targetRect?.y ?? 0;

  return (
    <GameShell
      tint={GAME.tint}
      fullTint
      title={isDaily ? "Daily Solitaire" : "Solitaire"}
      subtitle={`Klondike · Draw ${draw}${isDaily ? "" : " · Practice"}`}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Moves {state.moves}</Chip>
          <Chip>Score {state.score}</Chip>
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
        <div
          ref={boardRef}
          className="relative w-full touch-none select-none"
          style={{ height: layout.height }}
          aria-label="Solitaire table"
          role="application"
        >
          {/* Empty pile outlines */}
          {layout.piles.map((p) => {
            if (p.pile.kind === "waste") return null;
            const foundationSuit = p.pile.kind === "foundation" ? SUITS[p.pile.index] : null;
            return (
              <div
                key={`slot-${p.pile.kind}-${"index" in p.pile ? p.pile.index : 0}`}
                aria-hidden="true"
                onClick={p.pile.kind === "stock" ? drawOrRecycle : undefined}
                className="absolute flex items-center justify-center rounded-lg border-2 border-dashed border-[#9CC3AA]"
                style={{ left: p.x, top: p.y, width: layout.cardW, height: layout.cardH, color: "#6E9A80" }}
              >
                {foundationSuit && <SuitIcon suit={foundationSuit} size={Math.round(layout.cardW * 0.42)} color="#6E9A80" />}
                {p.pile.kind === "stock" && !state.stock.length && state.waste.length > 0 && <Icon name="refresh" size={20} />}
              </div>
            );
          })}

          {layout.cards.map((pos) => {
            const dragging = dragView?.ids.has(pos.card.id);
            const isStockTop = pos.pile.kind === "stock" && pos.z === state.stock.length - 1;
            if (pos.pile.kind === "stock" && !isStockTop) return null;
            return (
              <div
                key={pos.card.id}
                onPointerDown={(e) => (pos.pile.kind === "stock" ? undefined : onCardDown(e, pos))}
                onPointerMove={onCardMove}
                onPointerUp={onCardUp}
                onPointerCancel={() => {
                  drag.current = null;
                  setDragView(null);
                }}
                onClick={pos.pile.kind === "stock" ? drawOrRecycle : undefined}
                className="absolute left-0 top-0"
                style={{
                  width: layout.cardW,
                  height: layout.cardH,
                  zIndex: dragging ? 1000 + pos.z : pos.z,
                  transform: `translate(${pos.x + (dragging ? dragView!.dx : 0)}px, ${pos.y + (dragging ? dragView!.dy : 0)}px)`,
                  transition: dragging ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1)",
                  cursor: pos.movable || pos.pile.kind === "stock" ? "pointer" : "default",
                }}
              >
                <CardFace
                  card={pos.card}
                  faceUp={pos.faceUp}
                  w={layout.cardW}
                  h={layout.cardH}
                  count={isStockTop ? state.stock.length : undefined}
                  ring={hintIds.has(pos.card.id) ? "coach" : selectedIds.has(pos.card.id) ? "select" : undefined}
                />
              </div>
            );
          })}

          {targetRect && hintTarget?.kind !== "stock" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-lg"
              style={{ left: targetRect.x - 2, top: targetTopY - 2, width: layout.cardW + 4, height: layout.cardH + 4, outline: "2px dashed #F26B1D", outlineOffset: 2, zIndex: 900 }}
            />
          )}
          {hintTarget?.kind === "stock" && (
            <div aria-hidden="true" className="pointer-events-none absolute rounded-lg" style={{ left: -2, top: -2, width: layout.cardW + 4, height: layout.cardH + 4, boxShadow: "0 0 0 3px #F26B1D", zIndex: 900 }} />
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
        <div className="flex justify-between text-[13px] font-semibold text-[#2F4A3A]">
          <span>Cards home</span>
          <span className="font-mono">{home} / 52</span>
        </div>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded bg-[#CFE8D8]">
          <div className="h-2 rounded bg-[#1F7A4D] transition-[width]" style={{ width: `${(home / 52) * 100}%` }} />
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
            {hint.text}
            {why && <span className="mt-2 block">{whyText(hint)}</span>}
          </CoachCard>
        ) : noMove ? (
          <CoachCard heading="Coach" onClose={() => setNoMove(null)}>
            {noMove}
          </CoachCard>
        ) : (
          <CoachCard heading="Coach" tag={hints ? `${hints} hint${hints === 1 ? "" : "s"} used` : undefined} primary={finish ? undefined : { label: "Show best move", onClick: showHint }}>
            {finish ? "Won. Open the recap to see how you did." : "Tap a card to send it to its best spot, or drag it. Stuck? I’ll find a move from a line that wins."}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 px-4">
        <ToolButton surface="white" icon="undo" label="Undo" onClick={undo} disabled={!past.length || autoPlaying} />
        <ToolButton surface="white" icon="redo" label="Redo" onClick={redo} disabled={!future.length || autoPlaying} />
        <ToolButton surface="white" icon="hint" label="Hint" accent onClick={showHint} disabled={!!finish} />
        <ToolButton surface="white" icon="arrowRight" label="Auto-finish" onClick={runAutoFinish} disabled={!canAutoFinish(state) || autoPlaying} />
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
          <div className="grid grid-cols-2 gap-2">
            {(["daily1", "daily3"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={game.mode === m}
                onClick={() => {
                  setPaused(false);
                  onMode(m);
                }}
                className={`min-h-11 rounded-full border text-sm font-semibold ${game.mode === m ? "border-ink bg-ink text-ground" : "border-line-strong text-ink"}`}
              >
                Daily · Draw {m === "daily1" ? 1 : 3}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([1, 3] as const).map((d) => (
              <SheetButton
                key={d}
                onClick={() => {
                  setPaused(false);
                  onNewPractice(d);
                }}
              >
                New practice deal · Draw {d}
              </SheetButton>
            ))}
          </div>
        </PauseSheet>
      )}
    </GameShell>
  );
}

function pileLabel(state: State, pile: PileId): string {
  const top = (cards: Card[]) => (cards.length ? cardLabel(cards[cards.length - 1]) : "empty");
  switch (pile.kind) {
    case "stock":
      return state.stock.length ? `Stock, ${state.stock.length} cards. Draw` : state.waste.length ? "Stock empty. Turn the waste over" : "Stock empty";
    case "waste":
      return `Waste, top card ${top(state.waste)}`;
    case "foundation":
      return `${["Spades", "Hearts", "Diamonds", "Clubs"][pile.index]} foundation, ${top(state.foundations[pile.index])}`;
    case "tableau": {
      const col = state.tableau[pile.index];
      return `Column ${pile.index + 1}: ${col.down.length} hidden, ${col.up.length ? col.up.map(cardLabel).join(", ") : "no face-up cards"}`;
    }
  }
}

const WHY: Record<Hint["reason"], string> = {
  reveal: "Hidden cards are what make Klondike hard: each one you turn over is a new card in play and new moves.",
  foundation: "A card on its foundation is done and safe. Nothing in the columns needs it as a base anymore.",
  "empty-column": "An empty column is the most flexible spot on the table: only a King can start it, which lets you dig out what’s under one.",
  "king-to-empty": "Moving a King into an empty column frees the cards it was sitting on.",
  build: "Building down from the waste gets a card into play without spending a column.",
  draw: "Nothing on the table helps yet, so the next useful card is in the stock.",
  recycle: "The stock is empty; turning the waste over gives you another pass through the cards.",
  unblock: "This uncovers a card that can go straight home next move.",
};

function whyText(h: Hint): string {
  return `${WHY[h.reason]} ${h.winning ? "The solver checked a full winning line from here; this is its next step." : "No guaranteed win was found from here, so this is the most useful move by the usual priorities."}`;
}

function CardFace({ card, faceUp, w, h, count, ring }: { card: Card; faceUp: boolean; w: number; h: number; count?: number; ring?: "coach" | "select" }) {
  const shadow = ring === "coach" ? "0 0 0 3px #F26B1D" : ring === "select" ? "0 0 0 3px #5B3DF5" : undefined;
  if (!faceUp) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-lg border-2 border-white font-mono text-[13px] font-semibold text-white"
        style={{ background: "#5B3DF5", boxShadow: shadow ?? "0 0 0 1px #3A22C9" }}
        aria-hidden="true"
      >
        {count}
      </div>
    );
  }
  const rank = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][card.rank];
  const color = `var(--suit-${card.suit})`;
  return (
    <div
      className="flex h-full w-full flex-col rounded-lg border border-[#C9DACF] bg-white px-[5px] py-1"
      style={{ color, boxShadow: shadow }}
      aria-label={cardLabel(card)}
    >
      <span className="font-display font-bold leading-none" style={{ fontSize: Math.round(w * 0.32) }}>
        {rank}
      </span>
      <span className="leading-none">
        <SuitIcon suit={card.suit} size={Math.round(w * 0.24)} color={color} />
      </span>
      <span className="mt-auto self-center leading-none">
        <SuitIcon suit={card.suit} size={Math.round(Math.min(w * 0.46, h * 0.34))} color={color} />
      </span>
    </div>
  );
}

function SolitaireRecap({
  game,
  date,
  state,
  hints,
  finish,
  revealedAllAt,
  onClose,
  onNewPractice,
}: {
  game: Saved;
  date: string;
  state: State;
  hints: number;
  finish: Finish;
  revealedAllAt?: number;
  onClose: () => void;
  onNewPractice: (draw: 1 | 3) => void;
}) {
  const isDaily = game.mode !== "practice";
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const params = new URLSearchParams({
    g: "solitaire",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(hints),
    mv: String(state.moves),
    lv: isDaily ? `Draw ${state.draw}` : `Practice · Draw ${state.draw}`,
  });
  if (top !== null && isDaily) params.set("top", String(top));
  const text = [
    `Funzzle ${isDaily ? "Daily Solitaire" : "Solitaire practice"} · ${short} · Draw ${state.draw}`,
    `${formatTime(finish.timeMs)}${top !== null && isDaily ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${state.moves} moves · ${hints} hint${hints === 1 ? "" : "s"}`,
    "funzzle.com/play/solitaire",
  ].join("\n");

  const keyMove = revealedAllAt
    ? `at ${formatTime(revealedAllAt)} you turned over the last hidden card. From there it was only a matter of sending cards home.`
    : "you cleared the table without leaving a hidden card behind.";
  const nextSkill =
    state.recycles > 2
      ? "Draw less, build more. You went through the stock " + state.recycles + " times; before drawing, check every column for a move that turns over a card."
      : hints > 0
        ? "A no-hint win. Before each move, ask which hidden card it frees; that’s the question the coach asks too."
        : state.draw === 1
          ? "Draw 3. Only every third card is playable, so you have to plan which cards to leave in the waste."
          : "Win in fewer moves. Count your moves next time and try to beat " + state.moves + ".";

  return (
    <Recap
      game="solitaire"
      heading={isDaily ? `Daily Solitaire · ${short}` : "Solitaire practice"}
      title="Won."
      timeMs={finish.timeMs}
      percentile={isDaily ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Moves", value: String(state.moves), note: `Score ${state.score}` },
        { label: "Hints", value: String(hints), note: hints ? "Coach helped" : "No help needed", good: !hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      coach={{
        keyMove,
        nextSkill,
        learn: {
          title: "The three rules good players follow",
          body: "1. Turn over hidden cards first, starting with the longest columns. 2. Only empty a column when you have a King ready for it. 3. Don’t rush cards home if the columns still need them as a base.",
        },
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={
        <button type="button" onClick={() => onNewPractice(state.draw)} className="min-h-[52px] rounded-full border border-line-strong text-[15px] font-semibold text-ink">
          Deal a practice game
        </button>
      }
    />
  );
}
