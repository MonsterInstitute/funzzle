/**
 * Where every card sits on the FreeCell board: four free cells and four
 * foundations on the top row, eight columns below, all on one 8-slot grid so
 * the board fits a 390px phone. Cards are absolutely positioned and keyed by
 * id, so a move is just new coordinates and CSS transitions animate it. Pure,
 * so it is easy to test (tests/unit/freecell-layout.test.ts).
 */
import { runLength, type Card, type State } from "@/lib/games/freecell";

export type PileId =
  | { kind: "cell"; index: number }
  | { kind: "foundation"; index: number }
  | { kind: "tableau"; index: number };

export interface CardPos {
  card: Card;
  x: number;
  y: number;
  z: number;
  pile: PileId;
  /** Index within the column (tableau only), for picking runs. */
  depth?: number;
  /** Whether a tap or drag on it can start a move. */
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
  /** Top of the columns. */
  tableauTop: number;
  cards: CardPos[];
  piles: PileRect[];
}

export const GAP = 4;
/** Smallest offset between stacked cards once a long column is squeezed. */
export const MIN_STEP = 9;

export function computeLayout(state: State, width: number, maxHeight: number): Layout {
  const cardW = Math.max(24, Math.floor((width - GAP * 7) / 8));
  const cardH = Math.round(cardW * 1.39);
  const colX = (i: number) => i * (cardW + GAP);
  const tableauTop = cardH + 12;
  const cards: CardPos[] = [];
  const piles: PileRect[] = [];

  state.cells.forEach((card, i) => {
    if (card) cards.push({ card, x: colX(i), y: 0, z: 100 + i, pile: { kind: "cell", index: i }, movable: true });
    piles.push({ pile: { kind: "cell", index: i }, x: colX(i), y: 0, w: cardW, h: cardH });
  });

  state.foundations.forEach((pile, f) => {
    pile.forEach((card, i) => {
      cards.push({ card, x: colX(4 + f), y: 0, z: 200 + i, pile: { kind: "foundation", index: f }, movable: false });
    });
    piles.push({ pile: { kind: "foundation", index: f }, x: colX(4 + f), y: 0, w: cardW, h: cardH });
  });

  // Columns: the default offset shows each card's rank and suit; long columns
  // squeeze their offsets so the whole column stays on screen.
  const room = Math.max(cardH * 2, maxHeight - tableauTop - cardH);
  let height = tableauTop + cardH;
  state.tableau.forEach((col, c) => {
    let step = Math.round(cardH * 0.4);
    if (col.length > 1 && (col.length - 1) * step > room) step = Math.max(MIN_STEP, Math.floor(room / (col.length - 1)));
    const run = runLength(col);
    col.forEach((card, i) => {
      cards.push({
        card,
        x: colX(c),
        y: tableauTop + i * step,
        z: 300 + i,
        pile: { kind: "tableau", index: c },
        depth: i,
        movable: i >= col.length - run,
      });
    });
    const bottom = tableauTop + Math.max(0, col.length - 1) * step + cardH;
    height = Math.max(height, bottom);
    piles.push({ pile: { kind: "tableau", index: c }, x: colX(c), y: tableauTop, w: cardW, h: Math.max(cardH, bottom - tableauTop) });
  });

  return { cardW, cardH, tableauTop, height: Math.max(height, tableauTop + cardH * 2.6), cards, piles };
}

export function samePile(a: PileId, b: PileId): boolean {
  return a.kind === b.kind && a.index === b.index;
}
