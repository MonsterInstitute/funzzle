/** Builders for hand-made positions in the Spider tests. */

import { DECKS, type Card, type Suit, type SuitCount } from "./cards";
import { applyMove, isWon, SCORE, type Move, type State } from "./engine";

const RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

/**
 * Hands out distinct physical cards for codes like "7S", "10H", "KS": each
 * code takes the next unused copy, so a layout can repeat a card the way a
 * real two-deck game does.
 */
export function cardMaker(suits: SuitCount) {
  const used = new Set<number>();
  return (code: string): Card => {
    const suit = code.slice(-1) as Suit;
    const r = code.slice(0, -1);
    const rank = RANKS[r] ?? Number(r);
    const card = DECKS[suits].find((x) => x.suit === suit && x.rank === rank && !used.has(x.id));
    if (!card) throw new Error(`no ${code} left in a ${suits}-suit shoe`);
    used.add(card.id);
    return card;
  };
}

export interface Layout {
  suits?: SuitCount;
  /** Up to 10 entries "down codes | up codes", e.g. "3S 9H | 7C". */
  tableau?: string[];
  /** Listed bottom first; the last one is on top and goes to column 1 on a deal. */
  stock?: string;
  /** Completed runs already made, as suits, e.g. "S S H". */
  foundations?: string;
  score?: number;
}

/** A position from a layout; cards not listed anywhere are not in play. */
export function build(layout: Layout): State {
  const suits = layout.suits ?? 4;
  const card = cardMaker(suits);
  const cards = (codes: string) => (codes.trim() ? codes.trim().split(/\s+/).map(card) : []);
  const tableau = Array.from({ length: 10 }, (_, i) => {
    const [down = "", up = ""] = (layout.tableau?.[i] ?? "|").split("|");
    return { down: cards(down), up: cards(up) };
  });
  const runs = (layout.foundations ?? "").trim();
  const ranks = ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2", "A"];
  return {
    suits,
    stock: cards(layout.stock ?? ""),
    tableau,
    foundations: runs ? runs.split(/\s+/).map((s) => cards(ranks.map((r) => r + s).join(" "))) : [],
    score: layout.score ?? SCORE.start,
    moves: 0,
  };
}

/** "KS QS ... AS" for one suit, optionally only from rank `high` down to `low`. */
export function run(suit: Suit, high = 13, low = 1): string {
  const label = (r: number) => (r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r));
  const out: string[] = [];
  for (let r = high; r >= low; r--) out.push(label(r) + suit);
  return out.join(" ");
}

export function replay(state: State, moves: Move[]): State {
  return moves.reduce(applyMove, state);
}

export function wins(state: State, moves: Move[]): boolean {
  return isWon(replay(state, moves));
}

/** Every card id in the position, sorted. */
export function allCards(state: State): number[] {
  return [...state.stock, ...state.foundations.flat(), ...state.tableau.flatMap((col) => [...col.down, ...col.up])]
    .map((x) => x.id)
    .sort((a, b) => a - b);
}
