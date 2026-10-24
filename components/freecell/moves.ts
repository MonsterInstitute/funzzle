/**
 * Turning taps and drags into FreeCell engine moves, and the small board
 * facts the screen shows. Pure: unit-tested in tests/unit/freecell-moves.test.ts.
 */
import { applyMove, freeCells, emptyColumns, isLegal, maxRun, runLength, type Move, type State } from "@/lib/games/freecell";
import { canStack } from "@/lib/games/solitaire/cards";
import type { PileId } from "./layout";

export interface Pick {
  pile: PileId;
  /** For column picks: how many cards from the top of the column. */
  count: number;
}

const top = <T,>(items: T[]): T | undefined => items[items.length - 1];

/** The move that puts a picked card (or run) onto `to`, if legal. */
export function moveFor(state: State, pick: Pick, to: PileId): Move | null {
  let move: Move | null = null;
  const from = pick.pile;
  if (from.kind === "cell") {
    if (to.kind === "foundation") move = { kind: "cell-to-foundation", cell: from.index };
    else if (to.kind === "tableau") move = { kind: "cell-to-tableau", cell: from.index, to: to.index };
  } else if (from.kind === "tableau") {
    if (pick.count === 1 && to.kind === "foundation") move = { kind: "tableau-to-foundation", from: from.index };
    else if (pick.count === 1 && to.kind === "cell") {
      // Dropping on a taken cell means "a free cell": use the first empty one.
      const cell = state.cells[to.index] === null ? to.index : state.cells.indexOf(null);
      if (cell >= 0) move = { kind: "tableau-to-cell", from: from.index, cell };
    } else if (to.kind === "tableau" && to.index !== from.index) {
      move = { kind: "tableau-to-tableau", from: from.index, to: to.index, count: pick.count };
    }
  }
  // Any foundation target means "its own foundation": the engine picks the pile by suit.
  return move && isLegal(state, move) ? move : null;
}

/**
 * When a run would fit on `to` but is longer than the free cells and empty
 * columns allow, the most cards that could move there; otherwise null.
 */
export function runTooLong(state: State, pick: Pick, to: PileId): number | null {
  if (pick.pile.kind !== "tableau" || to.kind !== "tableau" || pick.count < 2 || to.index === pick.pile.index) return null;
  const col = state.tableau[pick.pile.index];
  if (pick.count > runLength(col)) return null;
  const base = col[col.length - pick.count];
  const onto = top(state.tableau[to.index]);
  if (onto && !canStack(base, onto)) return null;
  const max = maxRun(state, !onto);
  return pick.count > max ? max : null;
}

/** "That run is 5 cards. With 1 free cell and no empty column you can move 2 at once." */
export function tooLongMessage(state: State, count: number, max: number): string {
  const cells = freeCells(state);
  const empties = emptyColumns(state);
  const cellText = `${cells || "no"} free cell${cells === 1 ? "" : "s"}`;
  const colText = `${empties || "no"} empty column${empties === 1 ? "" : "s"}`;
  return `That run is ${count} cards. With ${cellText} and ${colText} you can move ${max} at once. Free a cell or empty a column first.`;
}

/**
 * Best destination for a tap (one-hand play): home if it can go home, then a
 * column it builds on, then a free cell (single cards), then an empty column,
 * which is worth more than a free cell so it is the last resort.
 */
export function autoMove(state: State, pick: Pick): Move | null {
  if (pick.pile.kind === "foundation") return null;
  if (pick.count === 1) {
    const home = moveFor(state, pick, { kind: "foundation", index: 0 });
    if (home) return home;
  }
  const filled: number[] = [];
  const empty: number[] = [];
  state.tableau.forEach((col, i) => (col.length ? filled : empty).push(i));
  for (const i of filled) {
    const m = moveFor(state, pick, { kind: "tableau", index: i });
    if (m) return m;
  }
  if (pick.pile.kind === "tableau" && pick.count === 1) {
    const cell = state.cells.indexOf(null);
    if (cell >= 0) {
      const m = moveFor(state, pick, { kind: "cell", index: cell });
      if (m) return m;
    }
  }
  for (const i of empty) {
    const m = moveFor(state, pick, { kind: "tableau", index: i });
    if (m) return m;
  }
  return null;
}

/** For a tap with no move: the run-length limit that blocked it, if any. */
export function tapTooLong(state: State, pick: Pick): number | null {
  for (let i = 0; i < state.tableau.length; i++) {
    const max = runTooLong(state, pick, { kind: "tableau", index: i });
    if (max !== null) return max;
  }
  return null;
}

export function cardsHome(state: State): number {
  return state.foundations.reduce((n, f) => n + f.length, 0);
}

export function cellsInUse(state: State): number {
  return state.cells.length - freeCells(state);
}

/**
 * Nothing is left to decide once every column runs downward in rank from the
 * bottom (colors don't matter): the lowest card left is then always on top of
 * a column or in a free cell, and it is always the next card its suit needs.
 */
export function canAutoFinish(state: State): boolean {
  if (cardsHome(state) === 52) return false;
  return state.tableau.every((col) => col.every((card, i) => i === 0 || col[i - 1].rank >= card.rank));
}

/** The foundation moves that finish a game canAutoFinish accepts, lowest card first. */
export function finishMoves(state: State): Move[] {
  const moves: Move[] = [];
  let s = state;
  for (let guard = 0; guard < 52 && cardsHome(s) < 52; guard++) {
    let best: { move: Move; rank: number } | null = null;
    s.cells.forEach((card, cell) => {
      if (card && (!best || card.rank < best.rank)) best = { move: { kind: "cell-to-foundation", cell }, rank: card.rank };
    });
    s.tableau.forEach((col, from) => {
      const card = top(col);
      if (card && (!best || card.rank < best.rank)) best = { move: { kind: "tableau-to-foundation", from }, rank: card.rank };
    });
    const pick = best as { move: Move; rank: number } | null;
    if (!pick || !isLegal(s, pick.move)) break;
    moves.push(pick.move);
    s = applyMove(s, pick.move);
  }
  return moves;
}

/** Skills a win counts toward (SKILL_TREES.freecell in lib/games/kit/achievements.ts). */
export function winSkills(r: { hints: number; undos: number; moves: number; timeMs: number; peakCells: number; longestRun: number }): string[] {
  return [
    "win",
    ...(r.hints ? [] : ["no-hint"]),
    ...(r.longestRun >= 2 ? ["supermove"] : []),
    ...(r.peakCells <= 2 ? ["two-cells"] : []),
    ...(r.timeMs < 300_000 ? ["fast"] : []),
    ...(r.moves < 100 ? ["efficient"] : []),
    ...(!r.hints && !r.undos ? ["clean"] : []),
  ];
}
