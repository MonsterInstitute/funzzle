/**
 * "AI Coach": suggests the next move with a one-sentence reason. It follows
 * the solver's winning line when one is known or can be found quickly, and
 * otherwise falls back to the usual FreeCell priorities: send cards home, dig
 * out low cards, open empty columns and keep free cells free.
 */

import { canStack, cardLabel, suitIndex, type Card } from "@/lib/games/solitaire/cards";
import { applyMove, isSafeHome, legalMoves, type Move, type State } from "./engine";
import { knownLine, solve } from "./solver";

export type Reason =
  | "foundation"
  | "free-low"
  | "empty-column"
  | "free-cell"
  | "dig"
  | "to-empty"
  | "park"
  | "build";

export interface Hint {
  move: Move;
  reason: Reason;
  /** One short sentence on why this move helps. Use describeMove for what it does. */
  text: string;
  /** True when the move is on a line the solver has verified wins. */
  winning: boolean;
}

const top = <T,>(items: T[]): T | undefined => items[items.length - 1];

/** The card a move picks up (the base card for a run). */
function movingCard(state: State, move: Move): Card {
  switch (move.kind) {
    case "cell-to-foundation":
    case "cell-to-tableau":
      return state.cells[move.cell]!;
    case "tableau-to-tableau": {
      const col = state.tableau[move.from];
      return col[col.length - move.count];
    }
    default:
      return top(state.tableau[move.from])!;
  }
}

/** How many cards leave the source column (0 for moves out of a free cell). */
function taken(move: Move): number {
  if (move.kind === "tableau-to-tableau") return move.count;
  return move.kind === "tableau-to-cell" || move.kind === "tableau-to-foundation" ? 1 : 0;
}

function destination(state: State, to: number): string {
  const onto = top(state.tableau[to]);
  return onto ? `onto the ${cardLabel(onto)}` : `to empty column ${to + 1}`;
}

/** "Move the 7♣ onto the 8♥", "Move the A♥ to its foundation", "Move the 9♣ to a free cell". */
export function describeMove(state: State, move: Move): string {
  const card = cardLabel(movingCard(state, move));
  switch (move.kind) {
    case "tableau-to-foundation":
    case "cell-to-foundation":
      return `Move the ${card} to its foundation`;
    case "tableau-to-cell":
      return `Move the ${card} to a free cell`;
    case "cell-to-tableau":
      return `Move the ${card} from its free cell ${destination(state, move.to)}`;
    case "tableau-to-tableau": {
      const col = state.tableau[move.from];
      const what = move.count === 1 ? `the ${card}` : `the ${card} to ${cardLabel(top(col)!)} run`;
      return `Move ${what} ${destination(state, move.to)}`;
    }
  }
}

const needed = (state: State, card: Card) => card.rank - state.foundations[suitIndex(card.suit)].length;

/** The card left on top of the source column, if the move takes from a column and leaves one. */
function exposed(state: State, move: Move): Card | undefined {
  const n = taken(move);
  if (n === 0 || !("from" in move)) return undefined;
  const col = state.tableau[move.from];
  return col.length > n ? col[col.length - n - 1] : undefined;
}

/**
 * The card most needed on the foundations that is still buried in the source
 * column under the moved cards, when it is due within two plays of its suit.
 */
function buriedLow(state: State, move: Move): Card | undefined {
  const n = taken(move);
  if (n === 0 || !("from" in move)) return undefined;
  const col = state.tableau[move.from];
  let best: Card | undefined;
  for (let i = 0; i < col.length - n; i++) {
    const card = col[i];
    const need = needed(state, card);
    if (need <= 2 && (!best || need < needed(state, best) || (need === needed(state, best) && card.rank < best.rank))) {
      best = card;
    }
  }
  return best;
}

function reasonFor(state: State, move: Move): Reason {
  if (move.kind === "tableau-to-foundation" || move.kind === "cell-to-foundation") return "foundation";
  const n = taken(move);
  if (n > 0 && "from" in move && state.tableau[move.from].length === n) return "empty-column";
  const shown = exposed(state, move);
  if (shown && needed(state, shown) === 1) return "free-low";
  if (move.kind === "cell-to-tableau") return "free-cell";
  if (buriedLow(state, move)) return "dig";
  if (move.kind === "tableau-to-tableau" && !top(state.tableau[move.to])) return "to-empty";
  if (move.kind === "tableau-to-cell") return "park";
  return "build";
}

/** First card the winning line sends home within the next few moves after this one. */
function soonHome(state: State, line: Move[] | undefined): Card | undefined {
  if (!line) return undefined;
  let s = state;
  for (let i = 0; i < Math.min(line.length, 5); i++) {
    const m = line[i];
    if (i > 0 && (m.kind === "tableau-to-foundation" || m.kind === "cell-to-foundation")) return movingCard(s, m);
    s = applyMove(s, m);
  }
  return undefined;
}

function why(state: State, move: Move, reason: Reason, line?: Move[]): string {
  const card = movingCard(state, move);
  const label = cardLabel(card);
  const from = "from" in move ? move.from + 1 : 0;
  const soon = soonHome(state, line);
  switch (reason) {
    case "foundation":
      if (card.rank <= 2) return "Aces and twos are never needed in the tableau, so send them home right away.";
      return isSafeHome(state, card)
        ? `Nothing will ever need to go on the ${label}, so it can safely go home.`
        : `Getting the ${label} home now is a step closer to winning.`;
    case "empty-column":
      return `It empties column ${from}, the most valuable space in FreeCell.`;
    case "free-low":
      return `It uncovers the ${cardLabel(exposed(state, move)!)}, which can go straight to its foundation.`;
    case "free-cell":
      return `It takes the ${label} out of a free cell, leaving room for longer moves.`;
    case "dig": {
      const low = buriedLow(state, move)!;
      return low.rank === 1
        ? `It digs toward the ${cardLabel(low)} in column ${from}, which unlocks the whole ${suitName(low)} suit.`
        : `It digs toward the ${cardLabel(low)} buried in column ${from}, which is needed soon.`;
    }
    case "to-empty":
      if (move.kind === "tableau-to-tableau" && move.count > 1) {
        return "The empty column takes the whole run in one go without filling any free cells.";
      }
      return soon
        ? `Using the empty column keeps your free cells open and sets up the ${cardLabel(soon)} to go home.`
        : "Using the empty column keeps your free cells open.";
    case "park":
      if (soon) return `Parking it briefly clears the way for the ${cardLabel(soon)} to go home.`;
      return `Parking it in a free cell uncovers the ${cardLabel(exposed(state, move)!)} for the next move.`;
    case "build": {
      const onto = move.kind === "tableau-to-tableau" ? top(state.tableau[move.to]) : undefined;
      if (soon) return `It builds down the column and sets up the ${cardLabel(soon)} to go home.`;
      return onto
        ? `It builds down on the ${cardLabel(onto)} without filling a free cell.`
        : "It builds down the column without filling a free cell.";
    }
  }
}

function suitName(card: Card): string {
  return { S: "spade", H: "heart", D: "diamond", C: "club" }[card.suit];
}

function hint(state: State, move: Move, winning: boolean, line?: Move[]): Hint {
  const reason = reasonFor(state, move);
  return { move, reason, text: why(state, move, reason, line), winning };
}

/** Heuristic rank when no winning line is known; null means the move is pointless. */
function heuristicScore(state: State, move: Move): number | null {
  const reason = reasonFor(state, move);
  const onto = "to" in move ? top(state.tableau[move.to]) : undefined;
  switch (reason) {
    case "foundation":
      return isSafeHome(state, movingCard(state, move)) ? 200 : 100;
    case "free-low":
      return move.kind === "tableau-to-cell" ? 75 : 90;
    case "empty-column":
      // Moving a lone card or run between empty columns achieves nothing,
      // and trading a free cell for a column is only a fair swap.
      if (move.kind === "tableau-to-cell") return 45;
      return onto ? 85 : null;
    case "free-cell":
      return onto ? 80 : 30;
    case "dig": {
      const low = buriedLow(state, move)!;
      const base = move.kind === "tableau-to-cell" ? 35 : onto ? 70 : 40;
      return base + (3 - needed(state, low)) * 5;
    }
    case "build": {
      // Sliding a run from one matching card to another only helps if it frees something.
      if (move.kind !== "tableau-to-tableau") return null;
      const below = exposed(state, move);
      return below && canStack(movingCard(state, move), below) ? null : 50;
    }
    case "to-empty":
      return null;
    case "park":
      return 10;
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
