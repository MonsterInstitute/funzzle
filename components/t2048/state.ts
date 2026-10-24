/**
 * 2048 play state: the engine state plus undo history, the undo and hint
 * budget, and what the recap needs (when each big tile first appeared, how
 * often the biggest tile sat in a corner).
 */
import { boardOf, isOver, maxInCorner, maxTile, move, newGame, type Dir, type State } from "@/lib/games/t2048";

/** Free undos per game; more only through an opt-in rewarded ad. */
export const FREE_UNDOS = 1;
/** Free coach hints per game; more only through an opt-in rewarded ad. */
export const MAX_HINTS = 3;
const HISTORY = 30;

export interface PlayState {
  game: State;
  /** Earlier positions, newest last (undo). */
  past: State[];
  hints: number;
  undosUsed: number;
  /** Undos earned by watching a rewarded ad. */
  bonusUndos: number;
  /** Moves made with a 64+ tile on the board, and how many of those had the biggest tile in a corner. */
  bigMoves: number;
  cornerMoves: number;
  /** First time each tile (exponent ≥ 7, i.e. 128) appeared: move number and elapsed ms. */
  reached: Record<number, { move: number; at: number }>;
  /** The game is over: no moves left and the player finished, or "End game". */
  ended: boolean;
}

export type Action =
  | { type: "move"; dir: Dir; at: number }
  | { type: "undo" }
  | { type: "grant-undo" }
  | { type: "hint-used" }
  | { type: "end" };

export function initialState(seed: string): PlayState {
  return { game: newGame(seed), past: [], hints: 0, undosUsed: 0, bonusUndos: 0, bigMoves: 0, cornerMoves: 0, reached: {}, ended: false };
}

export function undosLeft(s: PlayState): number {
  return Math.max(0, FREE_UNDOS + s.bonusUndos - s.undosUsed);
}

export function canUndo(s: PlayState): boolean {
  return !s.ended && s.past.length > 0 && undosLeft(s) > 0;
}

export function stuck(s: PlayState): boolean {
  return isOver(s.game);
}

export function reducer(s: PlayState, a: Action): PlayState {
  if (s.ended && a.type !== "hint-used") return s;
  switch (a.type) {
    case "move": {
      const next = move(s.game, a.dir);
      if (!next) return s;
      const max = maxTile(next);
      const reached = { ...s.reached };
      for (const t of next.tiles) if (t.v >= 7 && !reached[t.v]) reached[t.v] = { move: next.moves, at: a.at };
      const big = max >= 6;
      return {
        ...s,
        game: next,
        past: [...s.past, s.game].slice(-HISTORY),
        bigMoves: s.bigMoves + (big ? 1 : 0),
        cornerMoves: s.cornerMoves + (big && maxInCorner(boardOf(next)) ? 1 : 0),
        reached,
      };
    }
    case "undo": {
      if (!canUndo(s)) return s;
      return { ...s, game: s.past[s.past.length - 1], past: s.past.slice(0, -1), undosUsed: s.undosUsed + 1 };
    }
    case "grant-undo":
      return { ...s, bonusUndos: s.bonusUndos + 1 };
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
    case "end":
      return { ...s, ended: true };
  }
}

/** Share of big-tile moves with the biggest tile in a corner, 0–1 (1 before any big tile). */
export function cornerShare(s: PlayState): number {
  return s.bigMoves ? s.cornerMoves / s.bigMoves : 1;
}

/** Skill tree ids (lib/games/kit/achievements SKILL_TREES["2048"]) this game earned. */
export function skillsFor(s: PlayState): string[] {
  const max = maxTile(s.game);
  const out: string[] = [];
  if (max >= 8) out.push("reach-256");
  if (max >= 9) out.push("reach-512");
  if (max >= 10) out.push("reach-1024");
  if (max >= 11) out.push("reach-2048");
  if (max >= 12) out.push("reach-4096");
  if (s.bigMoves >= 100 && cornerShare(s) >= 0.8) out.push("corner");
  if (max >= 10 && s.undosUsed === 0 && s.hints === 0) out.push("no-undo-1024");
  return out;
}
