/**
 * Turning taps, drags and key presses into Spider moves. Pure: unit-tested in
 * tests/unit/spider-moves.test.ts.
 */
import { isLegal, movableRun, type Move, type State, type SuitCount } from "@/lib/games/spider";

/** Free coach hints per deal; after that, an opt-in rewarded ad gives one more. */
export const FREE_HINTS = 3;

export interface Pick {
  /** Source column. */
  from: number;
  /** Cards from the top of the column (within its same-suit run). */
  count: number;
}

/** The move that puts a picked run onto column `to`, if legal. */
export function moveFor(state: State, pick: Pick, to: number): Move | null {
  if (to === pick.from) return null;
  const move: Move = { kind: "move", from: pick.from, to, count: pick.count };
  return isLegal(state, move) ? move : null;
}

/**
 * Best destination for a tap (one-hand play): onto the same suit first (the
 * run grows and can still move as one), then onto any card one rank higher,
 * and only then an empty column, which is too valuable to fill for nothing:
 * moving a whole column into an empty one is never offered. Ties go to the
 * nearest column to the right.
 */
export function autoMove(state: State, pick: Pick): Move | null {
  const src = state.tableau[pick.from];
  const base = src.up[src.up.length - pick.count];
  if (!base) return null;
  const wholeColumn = pick.count === src.up.length && src.down.length === 0;
  let best: Move | null = null;
  let bestScore = 0;
  for (let k = 1; k < state.tableau.length; k++) {
    const to = (pick.from + k) % state.tableau.length;
    const move = moveFor(state, pick, to);
    if (!move) continue;
    const onto = state.tableau[to].up.at(-1);
    const score = !onto ? (wholeColumn ? 0 : 1) : onto.suit === base.suit ? 3 : 2;
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}

/** Number of cards a column's tap at face-up index `runIndex` picks up, or 0 when that card can't move. */
export function pickCount(state: State, from: number, runIndex: number): number {
  const col = state.tableau[from];
  const count = col.up.length - runIndex;
  return count >= 1 && count <= movableRun(col) ? count : 0;
}

export function runsDone(state: State): number {
  return state.foundations.length;
}

export function hiddenCount(state: State): number {
  return state.tableau.reduce((n, c) => n + c.down.length, 0);
}

/** Deals of ten left in the stock. */
export function dealsLeft(state: State): number {
  return Math.ceil(state.stock.length / state.tableau.length);
}

/** Why the stock can't be dealt right now, or null when it can. */
export function dealBlocked(state: State): string | null {
  if (!state.stock.length) return "The stock is empty.";
  if (state.tableau.some((c) => c.up.length + c.down.length === 0)) return "Fill every empty column before dealing.";
  return null;
}

export const suitsLabel = (suits: SuitCount) => `${suits} suit${suits === 1 ? "" : "s"}`;

/** Skills for SKILL_TREES["spider-solitaire"] (lib/games/kit/achievements.ts) earned by a win. */
export function finishSkills(suits: SuitCount, hints: number, undos: number, moves: number): string[] {
  return [
    suits === 1 ? "win-1-suit" : suits === 2 ? "win-2-suits" : "win-4-suits",
    ...(hints ? [] : ["no-hint"]),
    ...(undos ? [] : ["no-undo"]),
    ...(moves < 200 ? ["efficient"] : []),
    ...(suits === 4 && !hints ? ["4-suits-unaided"] : []),
  ];
}
