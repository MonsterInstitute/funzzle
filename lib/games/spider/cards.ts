/**
 * Card model shared by the Spider engine, solver and coach. Spider plays with
 * 104 cards (two decks). With fewer suits the same 104 slots are filled with
 * repeats: 1 suit is eight sets of spades, 2 suits four sets each of spades
 * and hearts, 4 suits two full decks. A card's id is its slot (0..103), so
 * every physical card stays distinct even when two look the same.
 */

export type Suit = "S" | "H" | "D" | "C";

/** How many different suits are in play. */
export type SuitCount = 1 | 2 | 4;

export interface Card {
  suit: Suit;
  /** 1 (Ace) .. 13 (King). */
  rank: number;
  /** 0..103, stable for a suit count: set * 13 + rank - 1. */
  id: number;
}

export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];

const SYMBOLS: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const NAMES: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** Sets of 13 cards in play; a complete game removes all eight as K-to-A runs. */
export const SETS = 8;
export const DECK_SIZE = SETS * 13;

function buildDeck(suits: SuitCount): readonly Card[] {
  return Object.freeze(
    Array.from({ length: DECK_SIZE }, (_, id) =>
      Object.freeze({ suit: SUITS[((id / 13) | 0) % suits], rank: (id % 13) + 1, id }),
    ),
  );
}

/** One frozen object per card and suit count, so every state shares the same instances. */
export const DECKS: Readonly<Record<SuitCount, readonly Card[]>> = Object.freeze({
  1: buildDeck(1),
  2: buildDeck(2),
  4: buildDeck(4),
});

/** "7♣", "10♥", "K♠". */
export function cardLabel(card: Card): string {
  return RANK_LABELS[card.rank] + SYMBOLS[card.suit];
}

/** "spades", "hearts". */
export function suitName(suit: Suit): string {
  return NAMES[suit];
}

/** Any card may go on a card one rank higher, whatever the suit. */
export function canStack(card: Card, onto: Card): boolean {
  return onto.rank === card.rank + 1;
}

/** Same suit and one rank lower: the pair moves together and counts towards a run. */
export function follows(card: Card, onto: Card): boolean {
  return onto.rank === card.rank + 1 && onto.suit === card.suit;
}
