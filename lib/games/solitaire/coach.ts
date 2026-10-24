/**
 * "AI Coach": suggests the next move with a plain-language reason. It follows
 * the solver's winning line when one is known or can be found quickly, and
 * otherwise falls back to the usual human priorities.
 */

import { cardLabel, type Card } from "./cards";
import { applyMove, legalMoves, type Move, type State } from "./engine";
import { knownLine, solve } from "./solver";

export type Reason =
  | "foundation"
  | "reveal"
  | "empty-column"
  | "king-to-empty"
  | "build"
  | "draw"
  | "recycle"
  | "unblock";

export interface Hint {
  move: Move;
  reason: Reason;
  /** Two sentences: what to do, then why. */
  text: string;
  /** True when the move is on a line the solver has verified wins. */
  winning: boolean;
}

const top = <T,>(items: T[]): T | undefined => items[items.length - 1];

/** The card a move picks up (the base card for a run). */
function movingCard(state: State, move: Move): Card | undefined {
  switch (move.kind) {
    case "waste-to-tableau":
    case "waste-to-foundation":
      return top(state.waste);
    case "tableau-to-foundation":
      return top(state.tableau[move.from].up);
    case "tableau-to-tableau": {
      const up = state.tableau[move.from].up;
      return up[up.length - move.count];
    }
    case "foundation-to-tableau":
      return top(state.foundations["SHDC".indexOf(move.suit)]);
    default:
      return undefined;
  }
}

function destination(state: State, to: number): string {
  const onto = top(state.tableau[to].up);
  return onto ? `onto the ${cardLabel(onto)}` : `to empty column ${to + 1}`;
}

/** "Move the 7♣ onto the 8♥", "Draw a card", "Move the A♥ to its foundation". */
export function describeMove(state: State, move: Move): string {
  switch (move.kind) {
    case "draw": {
      const n = Math.min(state.draw, state.stock.length);
      return n === 1 ? "Draw a card" : `Draw ${n} cards`;
    }
    case "recycle":
      return "Turn the waste pile over to restart the stock";
    case "waste-to-foundation":
    case "tableau-to-foundation":
      return `Move the ${cardLabel(movingCard(state, move)!)} to its foundation`;
    case "waste-to-tableau":
      return `Move the ${cardLabel(movingCard(state, move)!)} from the waste ${destination(state, move.to)}`;
    case "tableau-to-tableau": {
      const up = state.tableau[move.from].up;
      const base = cardLabel(up[up.length - move.count]);
      const what = move.count === 1 ? `the ${base}` : `the ${base} to ${cardLabel(top(up)!)} run`;
      return `Move ${what} ${destination(state, move.to)}`;
    }
    case "foundation-to-tableau":
      return `Move the ${cardLabel(movingCard(state, move)!)} from its foundation ${destination(state, move.to)}`;
  }
}

/** Whether the move turns over a face-down card. */
function reveals(state: State, move: Move): boolean {
  if (move.kind !== "tableau-to-foundation" && move.kind !== "tableau-to-tableau") return false;
  const col = state.tableau[move.from];
  const count = move.kind === "tableau-to-tableau" ? move.count : 1;
  return count === col.up.length && col.down.length > 0;
}

function empties(state: State, move: Move): boolean {
  if (move.kind !== "tableau-to-foundation" && move.kind !== "tableau-to-tableau") return false;
  const col = state.tableau[move.from];
  const count = move.kind === "tableau-to-tableau" ? move.count : 1;
  return count === col.up.length && col.down.length === 0;
}

/** For a partial run move: the card it uncovers. */
function uncovered(state: State, move: Move): Card | undefined {
  if (move.kind !== "tableau-to-tableau") return undefined;
  const up = state.tableau[move.from].up;
  return move.count < up.length ? up[up.length - move.count - 1] : undefined;
}

function canFound(state: State, card: Card): boolean {
  return state.foundations["SHDC".indexOf(card.suit)].length === card.rank - 1;
}

function reasonFor(state: State, move: Move): Reason {
  switch (move.kind) {
    case "draw":
      return "draw";
    case "recycle":
      return "recycle";
    case "foundation-to-tableau":
      return "unblock";
    default:
      break;
  }
  if (reveals(state, move)) return "reveal";
  if (move.kind === "waste-to-foundation" || move.kind === "tableau-to-foundation") return "foundation";
  if (empties(state, move)) return "empty-column";
  if ((move.kind === "waste-to-tableau" || move.kind === "tableau-to-tableau") && !top(state.tableau[move.to].up)) {
    return "king-to-empty";
  }
  if (uncovered(state, move)) return "unblock";
  return "build";
}

/** Second sentence of the hint. `next` is the following non-draw move on a winning line, if known. */
function why(state: State, move: Move, reason: Reason, next?: { state: State; move: Move }): string {
  const card = movingCard(state, move);
  const from = "from" in move ? move.from + 1 : 0;
  switch (reason) {
    case "reveal":
      return `It turns over a hidden card in column ${from}, which can open up new moves.`;
    case "foundation":
      return card && card.rank <= 2
        ? `Aces and twos are never needed in the tableau, so send them home right away.`
        : `Every card on a foundation is one step closer to winning, and this one isn't holding anything up.`;
    case "empty-column":
      return `It empties column ${from}, so a King and the cards under it can move there.`;
    case "king-to-empty":
      return move.kind === "waste-to-tableau"
        ? `Only Kings can start an empty column, and this one frees up the waste pile.`
        : `Only Kings can start an empty column, and moving it frees the cards around it.`;
    case "unblock": {
      if (move.kind === "foundation-to-tableau") {
        return `It gives a lower card a place to land so you can keep building.`;
      }
      const exposed = uncovered(state, move)!;
      return canFound(state, exposed)
        ? `It uncovers the ${cardLabel(exposed)}, which can then go to its foundation.`
        : `It uncovers the ${cardLabel(exposed)}, so another card can be placed on it.`;
    }
    case "build":
      return move.kind === "waste-to-tableau"
        ? `It gets a card out of the waste pile and builds down the column.`
        : `It builds a longer run in column ${(move as { to: number }).to + 1}.`;
    case "draw": {
      const wanted = next && movingCard(next.state, next.move);
      return wanted
        ? `The ${cardLabel(wanted)} you need next is in the stock.`
        : `Nothing on the table helps right now, so look at a new card.`;
    }
    case "recycle":
      return `You've gone through the stock, so turn the waste over to go through it again.`;
  }
}

function hint(state: State, move: Move, winning: boolean, line?: Move[]): Hint {
  const reason = reasonFor(state, move);
  let next: { state: State; move: Move } | undefined;
  if (line && (move.kind === "draw" || move.kind === "recycle")) {
    let s = state;
    for (const m of line) {
      if (m.kind !== "draw" && m.kind !== "recycle") {
        next = { state: s, move: m };
        break;
      }
      s = applyMove(s, m);
    }
  }
  return { move, reason, text: `${describeMove(state, move)}. ${why(state, move, reason, next)}`, winning };
}

/** Heuristic rank when no winning line is known; null means the move is pointless. */
function heuristicScore(state: State, move: Move): number | null {
  switch (move.kind) {
    case "draw":
      return 10;
    case "recycle":
      return 5;
    case "foundation-to-tableau":
      return null;
    case "waste-to-foundation":
    case "tableau-to-foundation":
      return reveals(state, move) ? 110 : 100;
    case "waste-to-tableau":
      return top(state.tableau[move.to].up) ? 60 : 50;
    case "tableau-to-tableau": {
      const col = state.tableau[move.from];
      if (reveals(state, move)) return 90 + col.down.length;
      if (empties(state, move)) {
        // Moving a King between empty columns achieves nothing.
        return col.up[0].rank === 13 ? null : 70;
      }
      const exposed = uncovered(state, move)!;
      return canFound(state, exposed) ? 80 : null;
    }
  }
}

/**
 * The coach's suggestion for this position, or null when no move is left.
 * Follows a remembered or freshly solved winning line when possible.
 */
export function bestMove(state: State, opts: { maxNodes?: number } = {}): Hint | null {
  let line = knownLine(state);
  if (!line) {
    const solved = solve(state, { maxNodes: opts.maxNodes ?? 50_000 });
    if (solved.result === "win" && solved.moves.length > 0) line = solved.moves;
  }
  if (line) return hint(state, line[0], true, line);

  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of legalMoves(state)) {
    const score = heuristicScore(state, move);
    if (score !== null && score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best ? hint(state, best, false) : null;
}
