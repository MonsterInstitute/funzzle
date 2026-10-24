/** Builders for hand-made positions in the FreeCell tests. */

import { CARDS, SUITS, type Card, type Suit } from "@/lib/games/solitaire/cards";
import { applyMove, isWon, type Move, type State } from "./engine";

/** "7C", "10H", "KS", "AD" → the card. */
export function c(code: string): Card {
  const suit = code.slice(-1) as Suit;
  const r = code.slice(0, -1);
  const rank = r === "A" ? 1 : r === "J" ? 11 : r === "Q" ? 12 : r === "K" ? 13 : Number(r);
  return CARDS[SUITS.indexOf(suit) * 13 + rank - 1];
}

const cards = (codes: string) => (codes.trim() ? codes.trim().split(/\s+/).map(c) : []);

export interface Layout {
  /** Up to 8 columns, bottom first, e.g. "9H 8C 7H". */
  tableau?: string[];
  /** Up to 4 free cells; "" or "-" is an empty cell. */
  cells?: string[];
  /** Foundation heights in S,H,D,C order. */
  foundations?: [number, number, number, number];
}

/** A position from a layout; cards not listed anywhere are not in play. */
export function build(layout: Layout): State {
  const tableau = Array.from({ length: 8 }, (_, i) => cards(layout.tableau?.[i] ?? ""));
  const cells = Array.from({ length: 4 }, (_, i) => {
    const code = (layout.cells?.[i] ?? "").trim();
    return code && code !== "-" ? c(code) : null;
  });
  const heights = layout.foundations ?? [0, 0, 0, 0];
  return { tableau, cells, foundations: heights.map((h, s) => CARDS.slice(s * 13, s * 13 + h)), moves: 0 };
}

export function replay(state: State, moves: Move[]): State {
  return moves.reduce(applyMove, state);
}

export function wins(state: State, moves: Move[]): boolean {
  return isWon(replay(state, moves));
}

/** Every card exactly once across the whole position. */
export function allCards(state: State): number[] {
  return [...state.cells.filter((x): x is Card => x !== null), ...state.foundations.flat(), ...state.tableau.flat()]
    .map((x) => x.id)
    .sort((a, b) => a - b);
}
