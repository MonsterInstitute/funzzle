/**
 * Klondike rules: dealing, legal moves, applying moves and Windows-style
 * scoring. States are immutable values so the UI can keep an undo history
 * by holding on to old states.
 */

import { createRng } from "@/lib/games/kit/rng";
import { CARDS, SUITS, canStack, suitIndex, type Card, type Suit } from "./cards";

export interface Column {
  /** Face-down cards, bottom first. */
  down: Card[];
  /** Face-up run, bottom first; always a valid alternating descending run. */
  up: Card[];
}

export interface State {
  /** Top of the stock is the last element. */
  stock: Card[];
  /** Top of the waste (the playable card) is the last element. */
  waste: Card[];
  /** Four piles indexed by suit order S, H, D, C; each holds A.. upwards. */
  foundations: Card[][];
  tableau: Column[];
  draw: 1 | 3;
  recycles: number;
  score: number;
  moves: number;
}

export type Move =
  | { kind: "draw" }
  | { kind: "recycle" }
  | { kind: "waste-to-tableau"; to: number }
  | { kind: "waste-to-foundation" }
  | { kind: "tableau-to-foundation"; from: number }
  | { kind: "tableau-to-tableau"; from: number; to: number; count: number }
  | { kind: "foundation-to-tableau"; suit: Suit; to: number };

/** Windows Solitaire standard scoring. */
export const SCORE = {
  wasteToTableau: 5,
  wasteToFoundation: 10,
  tableauToFoundation: 10,
  turnOver: 5,
  foundationToTableau: -15,
  recycleDraw1: -100,
  recycleDraw3: -20,
} as const;

/** Deterministic deal: same seed and draw mode always give the same layout. */
export function deal(seed: string, draw: 1 | 3 = 1): State {
  const deck = createRng(seed).shuffle(CARDS.slice());
  const tableau: Column[] = Array.from({ length: 7 }, () => ({ down: [], up: [] }));
  let next = 0;
  // Deal row by row like a person would: column i gets i face-down cards and one face-up.
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) {
      const card = deck[next++];
      if (col === row) tableau[col].up.push(card);
      else tableau[col].down.push(card);
    }
  }
  return {
    stock: deck.slice(next),
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    draw,
    recycles: 0,
    score: 0,
    moves: 0,
  };
}

function top<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

function inColumn(i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < 7;
}

function canFound(state: State, card: Card): boolean {
  return state.foundations[suitIndex(card.suit)].length === card.rank - 1;
}

/** Whether `card` (or a run led by it) may land on column `to`. */
function fitsColumn(state: State, card: Card, to: number): boolean {
  const target = state.tableau[to];
  const onto = top(target.up);
  if (!onto) return target.down.length === 0 && card.rank === 13;
  return canStack(card, onto);
}

/** Returns why a move is illegal, or null when it is legal. */
function illegalReason(state: State, move: Move): string | null {
  switch (move.kind) {
    case "draw":
      return state.stock.length > 0 ? null : "stock is empty";
    case "recycle":
      if (state.stock.length > 0) return "stock is not empty";
      return state.waste.length > 0 ? null : "waste is empty";
    case "waste-to-foundation": {
      const card = top(state.waste);
      if (!card) return "waste is empty";
      return canFound(state, card) ? null : "card does not fit the foundation";
    }
    case "waste-to-tableau": {
      const card = top(state.waste);
      if (!card) return "waste is empty";
      if (!inColumn(move.to)) return "bad column";
      return fitsColumn(state, card, move.to) ? null : "card does not fit that column";
    }
    case "tableau-to-foundation": {
      if (!inColumn(move.from)) return "bad column";
      const card = top(state.tableau[move.from].up);
      if (!card) return "column is empty";
      return canFound(state, card) ? null : "card does not fit the foundation";
    }
    case "tableau-to-tableau": {
      if (!inColumn(move.from) || !inColumn(move.to) || move.from === move.to) return "bad column";
      const up = state.tableau[move.from].up;
      if (!Number.isInteger(move.count) || move.count < 1 || move.count > up.length) return "bad count";
      return fitsColumn(state, up[up.length - move.count], move.to) ? null : "run does not fit that column";
    }
    case "foundation-to-tableau": {
      const s = SUITS.indexOf(move.suit);
      if (s < 0 || !inColumn(move.to)) return "bad move";
      const card = top(state.foundations[s]);
      if (!card) return "foundation is empty";
      return fitsColumn(state, card, move.to) ? null : "card does not fit that column";
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
  if (state.stock.length > 0) moves.push({ kind: "draw" });
  else if (state.waste.length > 0) moves.push({ kind: "recycle" });
  const waste = top(state.waste);
  if (waste) {
    if (canFound(state, waste)) moves.push({ kind: "waste-to-foundation" });
    for (let to = 0; to < 7; to++) {
      if (fitsColumn(state, waste, to)) moves.push({ kind: "waste-to-tableau", to });
    }
  }
  for (let from = 0; from < 7; from++) {
    const up = state.tableau[from].up;
    const card = top(up);
    if (!card) continue;
    if (canFound(state, card)) moves.push({ kind: "tableau-to-foundation", from });
    for (let count = 1; count <= up.length; count++) {
      for (let to = 0; to < 7; to++) {
        if (to !== from && fitsColumn(state, up[up.length - count], to)) {
          moves.push({ kind: "tableau-to-tableau", from, to, count });
        }
      }
    }
  }
  for (let s = 0; s < 4; s++) {
    const card = top(state.foundations[s]);
    if (!card) continue;
    for (let to = 0; to < 7; to++) {
      if (fitsColumn(state, card, to)) moves.push({ kind: "foundation-to-tableau", suit: SUITS[s], to });
    }
  }
  return moves;
}

function cloneState(state: State): State {
  return {
    ...state,
    stock: state.stock.slice(),
    waste: state.waste.slice(),
    foundations: state.foundations.map((f) => f.slice()),
    tableau: state.tableau.map((c) => ({ down: c.down.slice(), up: c.up.slice() })),
  };
}

/** Turns over the top face-down card when a column's face-up run is gone. */
function flip(state: State, col: number): number {
  const column = state.tableau[col];
  if (column.up.length === 0 && column.down.length > 0) {
    column.up.push(column.down.pop()!);
    return SCORE.turnOver;
  }
  return 0;
}

/** Applies a move and returns the new state; throws on an illegal move. */
export function applyMove(state: State, move: Move): State {
  const reason = illegalReason(state, move);
  if (reason) throw new Error(`Illegal move ${JSON.stringify(move)}: ${reason}`);
  const next = cloneState(state);
  let delta = 0;
  switch (move.kind) {
    case "draw": {
      const n = Math.min(next.draw, next.stock.length);
      for (let i = 0; i < n; i++) next.waste.push(next.stock.pop()!);
      break;
    }
    case "recycle":
      next.stock = next.waste.reverse();
      next.waste = [];
      next.recycles++;
      delta = next.draw === 1 ? SCORE.recycleDraw1 : SCORE.recycleDraw3;
      break;
    case "waste-to-foundation": {
      const card = next.waste.pop()!;
      next.foundations[suitIndex(card.suit)].push(card);
      delta = SCORE.wasteToFoundation;
      break;
    }
    case "waste-to-tableau":
      next.tableau[move.to].up.push(next.waste.pop()!);
      delta = SCORE.wasteToTableau;
      break;
    case "tableau-to-foundation": {
      const card = next.tableau[move.from].up.pop()!;
      next.foundations[suitIndex(card.suit)].push(card);
      delta = SCORE.tableauToFoundation + flip(next, move.from);
      break;
    }
    case "tableau-to-tableau": {
      const up = next.tableau[move.from].up;
      next.tableau[move.to].up.push(...up.splice(up.length - move.count));
      delta = flip(next, move.from);
      break;
    }
    case "foundation-to-tableau":
      next.tableau[move.to].up.push(next.foundations[suitIndex(move.suit)].pop()!);
      delta = SCORE.foundationToTableau;
      break;
  }
  next.score = Math.max(0, next.score + delta);
  next.moves++;
  return next;
}

export function isWon(state: State): boolean {
  return state.foundations.every((f) => f.length === 13);
}

/**
 * True when nothing is hidden and nothing is left in the stock or waste.
 * Every face-up run is in descending order, so the lowest remaining card is
 * always on top of some column and can go home: the game is already won.
 */
export function canAutoFinish(state: State): boolean {
  return (
    !isWon(state) &&
    state.stock.length === 0 &&
    state.waste.length === 0 &&
    state.tableau.every((c) => c.down.length === 0)
  );
}

/**
 * Foundation moves that finish the game, lowest card first so the animation
 * looks natural. Empty when canAutoFinish(state) is false.
 */
export function autoFinish(state: State): Move[] {
  if (!canAutoFinish(state)) return [];
  const moves: Move[] = [];
  let current = state;
  while (!isWon(current)) {
    let best = -1;
    for (let from = 0; from < 7; from++) {
      const card = top(current.tableau[from].up);
      if (card && canFound(current, card) && (best < 0 || card.rank < top(current.tableau[best].up)!.rank)) {
        best = from;
      }
    }
    if (best < 0) throw new Error("autoFinish: no foundation move available");
    const move: Move = { kind: "tableau-to-foundation", from: best };
    moves.push(move);
    current = applyMove(current, move);
  }
  return moves;
}

/**
 * Identity of a position for caching, ignoring score, move count and recycle
 * count (they do not change which moves are possible).
 */
export function positionKey(state: State): string {
  const ids = (cards: Card[]) => cards.map((c) => String.fromCharCode(48 + c.id)).join("");
  return [
    state.draw,
    ids(state.stock),
    ids(state.waste),
    state.foundations.map((f) => f.length).join(","),
    ...state.tableau.map((c) => ids(c.down) + "|" + ids(c.up)),
  ].join("/");
}
