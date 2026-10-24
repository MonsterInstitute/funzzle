/**
 * Spider rules: dealing, legal moves, applying moves and Microsoft-style
 * scoring. States are immutable plain values (JSON-serializable), so the UI
 * can keep an undo history by holding on to old states.
 *
 * Two things happen automatically after every move, as in every digital
 * Spider: a column whose face-up cards are all gone turns over its next
 * face-down card, and a complete King-to-Ace run of one suit on top of a
 * column goes to the foundation.
 */

import { createRng } from "@/lib/games/kit/rng";
import { DECKS, follows, type Card, type SuitCount } from "./cards";

export interface Column {
  /** Face-down cards, bottom first. */
  down: Card[];
  /** Face-up cards, bottom first. Not always one run: a deal drops a card on anything. */
  up: Card[];
}

export interface State {
  suits: SuitCount;
  /** Top of the stock is the last element; a deal gives column 0 the top card first. */
  stock: Card[];
  tableau: Column[];
  /** Completed runs in the order they were made, each listed King first. */
  foundations: Card[][];
  score: number;
  moves: number;
}

export type Move = { kind: "move"; from: number; to: number; count: number } | { kind: "deal" };

export const COLUMNS = 10;
/** Cards dealt to the tableau at the start: 6 in each of the first four columns, 5 elsewhere. */
export const TABLEAU_CARDS = 54;

/** Microsoft Spider scoring. */
export const SCORE = {
  start: 500,
  move: -1,
  run: 100,
} as const;

/** Deterministic deal: same seed and suit count always give the same layout. */
export function deal(seed: string, suits: SuitCount = 1): State {
  const deck = createRng(seed).shuffle(DECKS[suits].slice());
  const tableau: Column[] = Array.from({ length: COLUMNS }, () => ({ down: [], up: [] }));
  let next = 0;
  // Row by row like a person would; the last card in each column lands face up.
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const height = col < 4 ? 6 : 5;
      if (row >= height) continue;
      const card = deck[next++];
      if (row === height - 1) tableau[col].up.push(card);
      else tableau[col].down.push(card);
    }
  }
  return { suits, stock: deck.slice(next), tableau, foundations: [], score: SCORE.start, moves: 0 };
}

function top<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

function inColumn(i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < COLUMNS;
}

/** How many cards on top of the column move together: the same-suit descending run. */
export function movableRun(column: Column): number {
  const up = column.up;
  if (up.length === 0) return 0;
  let n = 1;
  while (n < up.length && follows(up[up.length - n], up[up.length - n - 1])) n++;
  return n;
}

/** Dealing needs cards in the stock and at least one card in every column. */
export function canDeal(state: State): boolean {
  return state.stock.length > 0 && state.tableau.every((c) => c.up.length + c.down.length > 0);
}

/** Returns why a move is illegal, or null when it is legal. */
function illegalReason(state: State, move: Move): string | null {
  switch (move.kind) {
    case "deal":
      if (state.stock.length === 0) return "stock is empty";
      return canDeal(state) ? null : "every column needs a card before dealing";
    case "move": {
      if (!inColumn(move.from) || !inColumn(move.to) || move.from === move.to) return "bad column";
      const source = state.tableau[move.from];
      if (!Number.isInteger(move.count) || move.count < 1 || move.count > movableRun(source)) return "bad count";
      const onto = top(state.tableau[move.to].up);
      if (!onto) return state.tableau[move.to].down.length === 0 ? null : "bad column";
      const base = source.up[source.up.length - move.count];
      return onto.rank === base.rank + 1 ? null : "run does not fit that column";
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
  for (let from = 0; from < COLUMNS; from++) {
    const up = state.tableau[from].up;
    const run = movableRun(state.tableau[from]);
    for (let count = 1; count <= run; count++) {
      const base = up[up.length - count];
      for (let to = 0; to < COLUMNS; to++) {
        if (to === from) continue;
        const onto = top(state.tableau[to].up);
        if (onto ? onto.rank === base.rank + 1 : state.tableau[to].down.length === 0) {
          moves.push({ kind: "move", from, to, count });
        }
      }
    }
  }
  if (canDeal(state)) moves.push({ kind: "deal" });
  return moves;
}

function cloneState(state: State): State {
  return {
    ...state,
    stock: state.stock.slice(),
    tableau: state.tableau.map((c) => ({ down: c.down.slice(), up: c.up.slice() })),
    foundations: state.foundations.map((f) => f.slice()),
  };
}

/** Turns over the top face-down card when a column's face-up cards are gone. */
function flip(state: State, col: number): void {
  const column = state.tableau[col];
  if (column.up.length === 0 && column.down.length > 0) column.up.push(column.down.pop()!);
}

/** Sends complete K-to-A runs on top of the column home; returns how many went. */
function collect(state: State, col: number): number {
  const column = state.tableau[col];
  let runs = 0;
  while (column.up.length >= 13 && movableRun(column) >= 13 && top(column.up)!.rank === 1) {
    state.foundations.push(column.up.splice(column.up.length - 13));
    flip(state, col);
    runs++;
  }
  return runs;
}

/** Applies a move and returns the new state; throws on an illegal move. */
export function applyMove(state: State, move: Move): State {
  const reason = illegalReason(state, move);
  if (reason) throw new Error(`Illegal move ${JSON.stringify(move)}: ${reason}`);
  const next = cloneState(state);
  let runs = 0;
  if (move.kind === "deal") {
    for (let col = 0; col < COLUMNS && next.stock.length > 0; col++) next.tableau[col].up.push(next.stock.pop()!);
    for (let col = 0; col < COLUMNS; col++) runs += collect(next, col);
  } else {
    const up = next.tableau[move.from].up;
    next.tableau[move.to].up.push(...up.splice(up.length - move.count));
    flip(next, move.from);
    runs = collect(next, move.to);
  }
  next.score = Math.max(0, next.score + SCORE.move + runs * SCORE.run);
  next.moves++;
  return next;
}

export function isWon(state: State): boolean {
  return state.stock.length === 0 && state.tableau.every((c) => c.up.length + c.down.length === 0);
}

/**
 * Identity of a position for caching, ignoring score and move count (they do
 * not change which moves are possible). Card ids are used, so two positions
 * that only differ by swapping identical-looking cards get different keys.
 */
export function positionKey(state: State): string {
  const ids = (cards: Card[]) => cards.map((c) => String.fromCharCode(48 + c.id)).join("");
  return [
    state.suits,
    ids(state.stock),
    state.foundations.length,
    ...state.tableau.map((c) => ids(c.down) + "|" + ids(c.up)),
  ].join("/");
}
