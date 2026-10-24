/**
 * Turning taps and drags into engine moves. Pure: unit-tested in
 * tests/unit/solitaire-moves.test.ts.
 */
import { isLegal, SUITS, type Move, type State } from "@/lib/games/solitaire";
import type { PileId } from "./layout";

export interface Pick {
  pile: PileId;
  /** For tableau picks: how many cards from the top of the run. */
  count: number;
}

/** The move that puts a picked card (or run) onto `to`, if legal. */
export function moveFor(state: State, pick: Pick, to: PileId): Move | null {
  let move: Move | null = null;
  const from = pick.pile;
  if (from.kind === "waste") {
    if (to.kind === "foundation") move = { kind: "waste-to-foundation" };
    else if (to.kind === "tableau") move = { kind: "waste-to-tableau", to: to.index };
  } else if (from.kind === "tableau") {
    if (to.kind === "foundation" && pick.count === 1) move = { kind: "tableau-to-foundation", from: from.index };
    else if (to.kind === "tableau" && to.index !== from.index) move = { kind: "tableau-to-tableau", from: from.index, to: to.index, count: pick.count };
  } else if (from.kind === "foundation") {
    if (to.kind === "tableau") move = { kind: "foundation-to-tableau", suit: SUITS[from.index], to: to.index };
  }
  if (!move) return null;
  // Any foundation target means "its own foundation": the engine picks the pile by suit.
  return isLegal(state, move) ? move : null;
}

/**
 * Best destination for a tap (one-hand play): home if it can go home, else a
 * column, preferring one that already has cards (keeps empty columns for kings).
 */
export function autoMove(state: State, pick: Pick): Move | null {
  if (pick.pile.kind !== "foundation" && pick.count === 1) {
    const home = moveFor(state, pick, { kind: "foundation", index: 0 });
    if (home) return home;
  }
  const targets = state.tableau
    .map((col, i) => ({ i, empty: col.down.length + col.up.length === 0 }))
    .sort((a, b) => Number(a.empty) - Number(b.empty));
  for (const t of targets) {
    const m = moveFor(state, pick, { kind: "tableau", index: t.i });
    if (m) return m;
  }
  return null;
}

export function cardsHome(state: State): number {
  return state.foundations.reduce((n, f) => n + f.length, 0);
}

export function hiddenCount(state: State): number {
  return state.tableau.reduce((n, c) => n + c.down.length, 0);
}
