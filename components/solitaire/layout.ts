/**
 * Where every card sits on the board for a given state. Cards are absolutely
 * positioned and keyed by id, so a move is just new coordinates and CSS
 * transitions animate it. Pure, so it is easy to test and reason about.
 */
import { SUITS, type Card, type State } from "@/lib/games/solitaire";

export type PileId =
  | { kind: "stock" }
  | { kind: "waste" }
  | { kind: "foundation"; index: number }
  | { kind: "tableau"; index: number };

export interface CardPos {
  card: Card;
  x: number;
  y: number;
  z: number;
  faceUp: boolean;
  pile: PileId;
  /** Index within the column's face-up run (tableau only), for picking runs. */
  runIndex?: number;
  /** Whether a tap on it can start a move (top of waste/foundation, any face-up tableau card). */
  movable: boolean;
}

export interface PileRect {
  pile: PileId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  cardW: number;
  cardH: number;
  height: number;
  cards: CardPos[];
  piles: PileRect[];
}

const GAP = 6;

export function computeLayout(state: State, width: number, maxHeight: number): Layout {
  const cardW = Math.floor((width - GAP * 6) / 7);
  const cardH = Math.round(cardW * 1.39);
  const colX = (i: number) => i * (cardW + GAP);
  const tableauTop = cardH + 14;
  const cards: CardPos[] = [];
  const piles: PileRect[] = [];

  // Stock: a stack of backs; only the top one is drawn (others share position).
  state.stock.forEach((card, i) => {
    cards.push({ card, x: colX(0), y: 0, z: i, faceUp: false, pile: { kind: "stock" }, movable: false });
  });
  piles.push({ pile: { kind: "stock" }, x: colX(0), y: 0, w: cardW, h: cardH });

  // Waste: draw 3 fans the top three cards.
  const fan = state.draw === 3 ? Math.min(3, state.waste.length) : 1;
  const fanStep = Math.round(cardW * 0.28);
  state.waste.forEach((card, i) => {
    const fromTop = state.waste.length - 1 - i;
    const offset = fromTop < fan ? (fan - 1 - fromTop) * fanStep : 0;
    cards.push({ card, x: colX(1) + offset, y: 0, z: 100 + i, faceUp: true, pile: { kind: "waste" }, movable: fromTop === 0 });
  });
  piles.push({ pile: { kind: "waste" }, x: colX(1), y: 0, w: cardW + (fan - 1) * fanStep, h: cardH });

  state.foundations.forEach((pile, f) => {
    pile.forEach((card, i) => {
      cards.push({ card, x: colX(3 + f), y: 0, z: 200 + i, faceUp: true, pile: { kind: "foundation", index: f }, movable: i === pile.length - 1 });
    });
    piles.push({ pile: { kind: "foundation", index: f }, x: colX(3 + f), y: 0, w: cardW, h: cardH });
  });

  // Tableau: squeeze the offsets of long columns so they fit the screen.
  let height = tableauTop + cardH;
  state.tableau.forEach((col, c) => {
    let downStep = Math.round(cardH * 0.22);
    let upStep = Math.round(cardH * 0.4);
    const span = (n: number, m: number) => n * downStep + Math.max(0, m - 1) * upStep;
    const room = Math.max(cardH * 2, maxHeight - tableauTop - cardH);
    if (span(col.down.length, col.up.length) > room) {
      const scale = room / span(col.down.length, col.up.length);
      downStep = Math.max(5, Math.floor(downStep * scale));
      upStep = Math.max(Math.round(cardH * 0.2), Math.floor(upStep * scale));
    }
    let y = tableauTop;
    let z = 300;
    col.down.forEach((card) => {
      cards.push({ card, x: colX(c), y, z: z++, faceUp: false, pile: { kind: "tableau", index: c }, movable: false });
      y += downStep;
    });
    col.up.forEach((card, i) => {
      cards.push({ card, x: colX(c), y, z: z++, faceUp: true, pile: { kind: "tableau", index: c }, runIndex: i, movable: true });
      if (i < col.up.length - 1) y += upStep;
    });
    const bottom = (col.down.length || col.up.length ? y : tableauTop) + cardH;
    height = Math.max(height, bottom);
    piles.push({ pile: { kind: "tableau", index: c }, x: colX(c), y: tableauTop, w: cardW, h: Math.max(cardH, bottom - tableauTop) });
  });

  return { cardW, cardH, height: Math.max(height, tableauTop + cardH * 2.6), cards, piles };
}

export const FOUNDATION_SUITS = SUITS;

export function samePile(a: PileId, b: PileId): boolean {
  return a.kind === b.kind && ("index" in a ? a.index : -1) === ("index" in b ? b.index : -1);
}
