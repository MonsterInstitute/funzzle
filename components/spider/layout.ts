/**
 * Where every card sits on the Spider board for a given state. Cards are
 * absolutely positioned and keyed by id, so a move (or a deal, or a finished
 * run flying home) is just new coordinates and CSS transitions animate it.
 * Pure, so it is easy to test.
 *
 * Ten columns have to fit a 390px phone: cards are narrow (about 33px on a
 * 358px board), and long columns squeeze their overlap so they fit the
 * screen height, never below a step that keeps rank and suit readable.
 */
import { movableRun, type Card, type State } from "@/lib/games/spider";

export type PileId = { kind: "stock" } | { kind: "foundation"; index: number } | { kind: "tableau"; index: number };

export interface CardPos {
  card: Card;
  x: number;
  y: number;
  z: number;
  faceUp: boolean;
  pile: PileId;
  /** Index within the column's face-up cards (tableau only), for picking runs. */
  runIndex?: number;
  /** Whether a tap or drag on it can start a move: face-up and inside the column's same-suit run. */
  movable: boolean;
  /** Stagger for the completed-run animation (foundation cards only). */
  delayMs?: number;
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
  gap: number;
  height: number;
  cards: CardPos[];
  piles: PileRect[];
}

export const COLUMNS = 10;
export const RUNS = 8;
/** Horizontal offset between the remaining deals in the stock pile. */
const STOCK_FAN = 3;

export function computeLayout(state: State, width: number, maxHeight: number): Layout {
  const gap = width < 420 ? 3 : 5;
  const cardW = Math.floor((width - gap * (COLUMNS - 1)) / COLUMNS);
  const cardH = Math.round(cardW * 1.4);
  const colX = (i: number) => i * (cardW + gap);
  const tableauTop = cardH + 12;
  const cards: CardPos[] = [];
  const piles: PileRect[] = [];

  // Stock: one back per remaining deal of ten, fanned slightly so the count shows.
  const deals = Math.ceil(state.stock.length / COLUMNS);
  state.stock.forEach((card, i) => {
    const group = Math.floor(i / COLUMNS);
    cards.push({ card, x: colX(0) + group * STOCK_FAN, y: 0, z: i, faceUp: false, pile: { kind: "stock" }, movable: false });
  });
  piles.push({ pile: { kind: "stock" }, x: colX(0), y: 0, w: cardW + Math.max(0, deals - 1) * STOCK_FAN, h: cardH });

  // Foundations: eight slots on the right; a finished run shows its King on top.
  for (let f = 0; f < RUNS; f++) {
    const x = colX(COLUMNS - RUNS + f);
    piles.push({ pile: { kind: "foundation", index: f }, x, y: 0, w: cardW, h: cardH });
    const run = state.foundations[f];
    if (!run) continue;
    run.forEach((card, i) => {
      cards.push({
        card,
        x,
        y: 0,
        z: 200 + f * 13 + (run.length - 1 - i),
        faceUp: true,
        pile: { kind: "foundation", index: f },
        movable: false,
        // The run leaves the column from its Ace up, so the King lands last, on top.
        delayMs: (run.length - 1 - i) * 22,
      });
    });
  }

  // Tableau: squeeze the offsets of long columns so they fit the screen.
  const minUp = Math.max(12, Math.round(cardW * 0.42));
  const room = Math.max(cardH * 2, maxHeight - tableauTop - cardH);
  let height = tableauTop + cardH;
  state.tableau.forEach((col, c) => {
    let downStep = Math.max(4, Math.round(cardH * 0.13));
    let upStep = Math.max(minUp, Math.round(cardH * 0.36));
    const span = () => col.down.length * downStep + Math.max(0, col.up.length - 1) * upStep;
    if (span() > room) {
      const scale = room / span();
      downStep = Math.max(3, Math.floor(downStep * scale));
      upStep = Math.max(minUp, Math.floor(upStep * scale));
    }
    const run = movableRun(col);
    let y = tableauTop;
    let z = 300;
    col.down.forEach((card) => {
      cards.push({ card, x: colX(c), y, z: z++, faceUp: false, pile: { kind: "tableau", index: c }, movable: false });
      y += downStep;
    });
    col.up.forEach((card, i) => {
      cards.push({ card, x: colX(c), y, z: z++, faceUp: true, pile: { kind: "tableau", index: c }, runIndex: i, movable: i >= col.up.length - run });
      if (i < col.up.length - 1) y += upStep;
    });
    const bottom = (col.down.length || col.up.length ? y : tableauTop) + cardH;
    height = Math.max(height, bottom);
    piles.push({ pile: { kind: "tableau", index: c }, x: colX(c), y: tableauTop, w: cardW, h: Math.max(cardH, bottom - tableauTop) });
  });

  return { cardW, cardH, gap, height: Math.max(height, tableauTop + cardH * 3), cards, piles };
}

export function samePile(a: PileId, b: PileId): boolean {
  return a.kind === b.kind && ("index" in a ? a.index : -1) === ("index" in b ? b.index : -1);
}

/** The tableau column under a board point (drops land on the nearest column within reach). */
export function columnAt(layout: Layout, x: number, y: number): number | null {
  if (y < layout.cardH) return null;
  for (const p of layout.piles) {
    if (p.pile.kind !== "tableau") continue;
    if (x >= p.x - layout.gap / 2 - 2 && x <= p.x + p.w + layout.gap / 2 + 2 && y <= p.y + p.h + layout.cardH) return p.pile.index;
  }
  return null;
}
