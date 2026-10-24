/**
 * FreeCell rules: dealing, legal moves (including supermoves), applying moves
 * and safe auto-moves to the foundations. States are immutable, JSON-safe
 * values so the UI can keep an undo history and the server can ship a deal
 * to the browser as-is.
 */

import { createRng } from "@/lib/games/kit/rng";
import { CARDS, canStack, suitIndex, type Card } from "@/lib/games/solitaire/cards";

export const COLUMNS = 8;
export const CELLS = 4;

export interface State {
  /** Eight columns, bottom first; the last card of each is the playable one. */
  tableau: Card[][];
  /** Four free cells, null when empty. */
  cells: (Card | null)[];
  /** Four piles indexed by suit order S, H, D, C; each holds A.. upwards. */
  foundations: Card[][];
  moves: number;
}

export type Move =
  | { kind: "tableau-to-cell"; from: number; cell: number }
  | { kind: "tableau-to-foundation"; from: number }
  | { kind: "tableau-to-tableau"; from: number; to: number; count: number }
  | { kind: "cell-to-foundation"; cell: number }
  | { kind: "cell-to-tableau"; cell: number; to: number };

/** Deterministic deal: the same seed always gives the same layout. */
export function deal(seed: string): State {
  const deck = createRng(seed).shuffle(CARDS.slice());
  const tableau: Card[][] = Array.from({ length: COLUMNS }, () => []);
  // Deal row by row across the eight columns: the first four get 7 cards, the rest 6.
  deck.forEach((card, i) => tableau[i % COLUMNS].push(card));
  return { tableau, cells: [null, null, null, null], foundations: [[], [], [], []], moves: 0 };
}

function top<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

function inRange(i: number, n: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < n;
}

function canFound(state: State, card: Card): boolean {
  return state.foundations[suitIndex(card.suit)].length === card.rank - 1;
}

/** Length of the alternating descending run on top of a column. */
export function runLength(column: Card[]): number {
  if (column.length === 0) return 0;
  let n = 1;
  while (n < column.length && canStack(column[column.length - n], column[column.length - n - 1])) n++;
  return n;
}

export function freeCells(state: State): number {
  return state.cells.filter((c) => c === null).length;
}

export function emptyColumns(state: State): number {
  return state.tableau.filter((c) => c.length === 0).length;
}

/**
 * Most cards a supermove may carry: (free cells + 1) × 2^(empty columns). An
 * empty destination column cannot also serve as a stepping stone, so moving
 * into one halves the limit.
 */
export function maxRun(state: State, toEmpty: boolean): number {
  const empties = emptyColumns(state) - (toEmpty ? 1 : 0);
  return (freeCells(state) + 1) * 2 ** Math.max(0, empties);
}

/** Returns why a move is illegal, or null when it is legal. */
function illegalReason(state: State, move: Move): string | null {
  switch (move.kind) {
    case "tableau-to-cell": {
      if (!inRange(move.from, COLUMNS) || !inRange(move.cell, CELLS)) return "bad index";
      if (!top(state.tableau[move.from])) return "column is empty";
      return state.cells[move.cell] === null ? null : "free cell is taken";
    }
    case "tableau-to-foundation": {
      if (!inRange(move.from, COLUMNS)) return "bad column";
      const card = top(state.tableau[move.from]);
      if (!card) return "column is empty";
      return canFound(state, card) ? null : "card does not fit the foundation";
    }
    case "cell-to-foundation": {
      if (!inRange(move.cell, CELLS)) return "bad cell";
      const card = state.cells[move.cell];
      if (!card) return "free cell is empty";
      return canFound(state, card) ? null : "card does not fit the foundation";
    }
    case "cell-to-tableau": {
      if (!inRange(move.cell, CELLS) || !inRange(move.to, COLUMNS)) return "bad index";
      const card = state.cells[move.cell];
      if (!card) return "free cell is empty";
      const onto = top(state.tableau[move.to]);
      return !onto || canStack(card, onto) ? null : "card does not fit that column";
    }
    case "tableau-to-tableau": {
      if (!inRange(move.from, COLUMNS) || !inRange(move.to, COLUMNS) || move.from === move.to) return "bad column";
      const col = state.tableau[move.from];
      if (!Number.isInteger(move.count) || move.count < 1 || move.count > runLength(col)) return "bad count";
      const onto = top(state.tableau[move.to]);
      if (onto && !canStack(col[col.length - move.count], onto)) return "run does not fit that column";
      return move.count <= maxRun(state, !onto) ? null : "not enough free cells and empty columns for that run";
    }
    default:
      return "unknown move";
  }
}

export function isLegal(state: State, move: Move): boolean {
  return illegalReason(state, move) === null;
}

export function legalMoves(state: State): Move[] {
  const moves: Move[] = [];
  const firstCell = state.cells.indexOf(null);
  state.cells.forEach((card, cell) => {
    if (!card) return;
    if (canFound(state, card)) moves.push({ kind: "cell-to-foundation", cell });
    for (let to = 0; to < COLUMNS; to++) {
      const onto = top(state.tableau[to]);
      if (!onto || canStack(card, onto)) moves.push({ kind: "cell-to-tableau", cell, to });
    }
  });
  const capEmpty = maxRun(state, true);
  const capFull = maxRun(state, false);
  for (let from = 0; from < COLUMNS; from++) {
    const col = state.tableau[from];
    const card = top(col);
    if (!card) continue;
    if (canFound(state, card)) moves.push({ kind: "tableau-to-foundation", from });
    if (firstCell >= 0) moves.push({ kind: "tableau-to-cell", from, cell: firstCell });
    const run = runLength(col);
    for (let to = 0; to < COLUMNS; to++) {
      if (to === from) continue;
      const onto = top(state.tableau[to]);
      if (onto) {
        // At most one run length fits: the one whose base is one rank below `onto`.
        const count = onto.rank - card.rank;
        if (count >= 1 && count <= run && count <= capFull && canStack(col[col.length - count], onto)) {
          moves.push({ kind: "tableau-to-tableau", from, to, count });
        }
      } else {
        for (let count = 1; count <= Math.min(run, capEmpty); count++) {
          moves.push({ kind: "tableau-to-tableau", from, to, count });
        }
      }
    }
  }
  return moves;
}

function cloneState(state: State): State {
  return {
    tableau: state.tableau.map((c) => c.slice()),
    cells: state.cells.slice(),
    foundations: state.foundations.map((f) => f.slice()),
    moves: state.moves,
  };
}

/** Applies a move and returns the new state; throws on an illegal move. */
export function applyMove(state: State, move: Move): State {
  const reason = illegalReason(state, move);
  if (reason) throw new Error(`Illegal move ${JSON.stringify(move)}: ${reason}`);
  const next = cloneState(state);
  switch (move.kind) {
    case "tableau-to-cell":
      next.cells[move.cell] = next.tableau[move.from].pop()!;
      break;
    case "tableau-to-foundation": {
      const card = next.tableau[move.from].pop()!;
      next.foundations[suitIndex(card.suit)].push(card);
      break;
    }
    case "cell-to-foundation": {
      const card = next.cells[move.cell]!;
      next.cells[move.cell] = null;
      next.foundations[suitIndex(card.suit)].push(card);
      break;
    }
    case "cell-to-tableau":
      next.tableau[move.to].push(next.cells[move.cell]!);
      next.cells[move.cell] = null;
      break;
    case "tableau-to-tableau": {
      const col = next.tableau[move.from];
      next.tableau[move.to].push(...col.splice(col.length - move.count));
      break;
    }
  }
  next.moves++;
  return next;
}

export function isWon(state: State): boolean {
  return state.foundations.every((f) => f.length === 13);
}

/**
 * A card is safe to send home when no card could ever need to be placed on
 * it: Aces and twos always, otherwise once both opposite-colour cards one
 * rank lower are already home.
 */
export function isSafeHome(state: State, card: Card): boolean {
  if (!canFound(state, card)) return false;
  if (card.rank <= 2) return true;
  const red = card.suit === "H" || card.suit === "D";
  const [a, b] = red ? [0, 3] : [1, 2];
  return state.foundations[a].length >= card.rank - 1 && state.foundations[b].length >= card.rank - 1;
}

/**
 * The safe foundation moves available now and after each other, in play
 * order (free cells first, then columns left to right, repeated until none
 * is left). The UI plays these after every move.
 */
export function autoMoves(state: State): Move[] {
  const moves: Move[] = [];
  let current = state;
  for (let changed = true; changed; ) {
    changed = false;
    for (let cell = 0; cell < CELLS; cell++) {
      const card = current.cells[cell];
      if (card && isSafeHome(current, card)) {
        const move: Move = { kind: "cell-to-foundation", cell };
        moves.push(move);
        current = applyMove(current, move);
        changed = true;
      }
    }
    for (let from = 0; from < COLUMNS; from++) {
      const card = top(current.tableau[from]);
      if (card && isSafeHome(current, card)) {
        const move: Move = { kind: "tableau-to-foundation", from };
        moves.push(move);
        current = applyMove(current, move);
        changed = true;
      }
    }
  }
  return moves;
}

/** Identity of a position for caching, ignoring the move count. */
export function positionKey(state: State): string {
  const ids = (cards: Card[]) => cards.map((c) => String.fromCharCode(48 + c.id)).join("");
  return [
    state.cells.map((c) => (c ? String.fromCharCode(48 + c.id) : "-")).join(""),
    state.foundations.map((f) => f.length).join(","),
    ...state.tableau.map(ids),
  ].join("/");
}
