/**
 * Card model shared by the Klondike engine, solver and coach. A card's id is
 * `suitIndex * 13 + rank - 1`, so ids are stable across deals and the solver
 * can work on plain numbers instead of objects.
 */

export type Suit = "S" | "H" | "D" | "C";

export interface Card {
  suit: Suit;
  /** 1 (Ace) .. 13 (King). */
  rank: number;
  /** 0..51, stable: suitIndex * 13 + rank - 1. */
  id: number;
}

/** Foundation order: foundations[i] holds SUITS[i]. */
export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];

const SYMBOLS: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** One frozen object per card, so every state shares the same instances. */
export const CARDS: readonly Card[] = Object.freeze(
  SUITS.flatMap((suit, s) =>
    Array.from({ length: 13 }, (_, r) => Object.freeze({ suit, rank: r + 1, id: s * 13 + r })),
  ),
);

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

export function isRed(suit: Suit): boolean {
  return suit === "H" || suit === "D";
}

/** "7♣", "10♥", "K♠". */
export function cardLabel(card: Card): string {
  return RANK_LABELS[card.rank] + SYMBOLS[card.suit];
}

/** Whether `card` may be placed on `onto` in the tableau. */
export function canStack(card: Card, onto: Card): boolean {
  return onto.rank === card.rank + 1 && isRed(onto.suit) !== isRed(card.suit);
}
