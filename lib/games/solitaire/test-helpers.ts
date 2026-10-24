/** Builders for hand-made positions in the solitaire tests. */

import { CARDS, SUITS, type Card, type Suit } from "./cards";
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
  /** Up to 7 entries "down codes | up codes", e.g. "3S 9H | 7C". */
  tableau?: string[];
  /** Listed bottom first; the last one is on top. */
  stock?: string;
  waste?: string;
  /** Foundation heights in S,H,D,C order. */
  foundations?: [number, number, number, number];
  draw?: 1 | 3;
  score?: number;
}

/** A position from a layout; cards not listed anywhere are not in play. */
export function build(layout: Layout): State {
  const tableau = Array.from({ length: 7 }, (_, i) => {
    const [down = "", up = ""] = (layout.tableau?.[i] ?? "|").split("|");
    return { down: cards(down), up: cards(up) };
  });
  const heights = layout.foundations ?? [0, 0, 0, 0];
  return {
    stock: cards(layout.stock ?? ""),
    waste: cards(layout.waste ?? ""),
    foundations: heights.map((h, s) => CARDS.slice(s * 13, s * 13 + h)),
    tableau,
    draw: layout.draw ?? 1,
    recycles: 0,
    score: layout.score ?? 0,
    moves: 0,
  };
}

export function replay(state: State, moves: Move[]): State {
  return moves.reduce(applyMove, state);
}

export function wins(state: State, moves: Move[]): boolean {
  return isWon(replay(state, moves));
}

/** Every card exactly once across the whole position. */
export function allCards(state: State): number[] {
  return [
    ...state.stock,
    ...state.waste,
    ...state.foundations.flat(),
    ...state.tableau.flatMap((col) => [...col.down, ...col.up]),
  ]
    .map((x) => x.id)
    .sort((a, b) => a - b);
}
