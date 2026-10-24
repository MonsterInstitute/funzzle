/**
 * "AI Coach": suggests the next move with a one-sentence reason. It follows
 * the solver's winning line when one is known or can be found quickly, and
 * otherwise falls back to the usual Spider priorities: finish runs, turn
 * over hidden cards, empty columns, keep suits together, and save empty
 * columns for when they free something.
 */

import { cardLabel, suitName, type Card } from "./cards";
import { applyMove, legalMoves, type Move, type State } from "./engine";
import { knownLine, solve } from "./solver";

export type Reason =
  | "complete-run"
  | "reveal"
  | "empty-column"
  | "same-suit"
  | "to-empty"
  | "unblock"
  | "build"
  | "deal";

export interface Hint {
  move: Move;
  reason: Reason;
  /** One sentence: what to do and why. */
  text: string;
  /** True when the move is on a line the solver has verified wins. */
  winning: boolean;
}

const top = <T,>(items: T[]): T | undefined => items[items.length - 1];

type CardMove = Extract<Move, { kind: "move" }>;

/** What a card move does, read off the position before it. */
function inspect(state: State, move: CardMove) {
  const col = state.tableau[move.from];
  const base = col.up[col.up.length - move.count];
  const onto = top(state.tableau[move.to].up);
  const whole = move.count === col.up.length;
  return {
    base,
    last: top(col.up)!,
    onto,
    completes: applyMove(state, move).foundations.length > state.foundations.length,
    reveals: whole && col.down.length > 0,
    empties: whole && col.down.length === 0,
    /** The face-up card left on top of the source column, if any. */
    uncovered: whole ? undefined : col.up[col.up.length - move.count - 1],
  };
}

function what(state: State, move: CardMove): string {
  const up = state.tableau[move.from].up;
  const base = cardLabel(up[up.length - move.count]);
  return move.count === 1 ? `the ${base}` : `the ${base} to ${cardLabel(top(up)!)} run`;
}

function where(state: State, to: number): string {
  const onto = top(state.tableau[to].up);
  return onto ? `onto the ${cardLabel(onto)}` : `to empty column ${to + 1}`;
}

/** "Move the 7♠ onto the 8♥", "Move the 9♣ to 7♣ run to empty column 4", "Deal a new row from the stock". */
export function describeMove(state: State, move: Move): string {
  if (move.kind === "deal") return "Deal a new row from the stock";
  return `Move ${what(state, move)} ${where(state, move.to)}`;
}

function reasonFor(state: State, move: Move): Reason {
  if (move.kind === "deal") return "deal";
  const m = inspect(state, move);
  if (m.completes) return "complete-run";
  if (m.reveals) return "reveal";
  if (m.empties) return "empty-column";
  if (m.onto && m.onto.suit === m.base.suit) return "same-suit";
  if (!m.onto) return "to-empty";
  // Off a card of the next rank up (another suit): the point is what it uncovers.
  if (m.uncovered && m.uncovered.rank === m.base.rank + 1) return "unblock";
  return "build";
}

/** Whether some other column could take `card` once it is on top. */
function hasHome(state: State, card: Card, except: number): boolean {
  return state.tableau.some((c, i) => i !== except && top(c.up)?.rank === card.rank + 1);
}

/** The single-sentence hint text for a move and its reason. */
function sentence(state: State, move: Move, reason: Reason, winning: boolean): string {
  if (move.kind === "deal") {
    return winning
      ? "Dealing a new row from the stock is the next step on the winning line, because nothing on the table helps more right now."
      : "Dealing a new row from the stock gives every column a fresh card, since no move on the table helps right now.";
  }
  const m = inspect(state, move);
  const doing = `Moving ${what(state, move)} ${where(state, move.to)}`;
  const from = move.from + 1;
  switch (reason) {
    case "complete-run":
      return `${doing} completes a King-to-Ace run of ${suitName(m.base.suit)}, which clears it off the table for 100 points.`;
    case "reveal":
      return `${doing} turns over a hidden card in column ${from}, which can open up new moves.`;
    case "empty-column":
      return `${doing} empties column ${from}, giving you a free space where any card or run can go.`;
    case "same-suit":
      // Reveals and emptied columns were caught above, so a card is always left behind here.
      return m.uncovered!.rank === m.base.rank + 1
        ? `${doing} keeps the ${suitName(m.base.suit)} together, and only a same-suit run can move as one and be cleared.`
        : `${doing} joins it to more ${suitName(m.base.suit)} and uncovers the ${cardLabel(m.uncovered!)} so another card can go on it.`;
    case "to-empty": {
      const under = m.uncovered!;
      return hasHome(state, under, move.from)
        ? `${doing} uncovers the ${cardLabel(under)}, which can then move onto another column.`
        : `${doing} uncovers the ${cardLabel(under)} so another card can go on it.`;
    }
    case "unblock":
      return `${doing} uncovers the ${cardLabel(m.uncovered!)} in column ${from} so another card can be placed on it.`;
    case "build":
      return m.uncovered
        ? `${doing} puts it in rank order and uncovers the ${cardLabel(m.uncovered)} so another card can go on it.`
        : `${doing} puts it in rank order, which keeps the column tidy for later moves.`;
    case "deal":
      return "";
  }
}

function hint(state: State, move: Move, winning: boolean): Hint {
  const reason = reasonFor(state, move);
  return { move, reason, text: sentence(state, move, reason, winning), winning };
}

/** Heuristic rank when no winning line is known; null means the move is pointless. */
function heuristicScore(state: State, move: Move): number | null {
  if (move.kind === "deal") return 10;
  const m = inspect(state, move);
  const sameSuit = m.onto !== undefined && m.onto.suit === m.base.suit;
  if (m.completes) return 1000;
  // Reveal from the shortest pile first; landing on a card beats spending an empty column.
  if (m.reveals) return 500 + (sameSuit ? 50 : m.onto ? 20 : 0) - state.tableau[move.from].down.length;
  if (m.empties) return m.onto ? 400 + (sameSuit ? 50 : 0) : null;
  const under = m.uncovered;
  // Moving a run off one card onto another of the same rank only helps if the suit improves.
  const lateral = under !== undefined && under.rank === m.base.rank + 1;
  if (sameSuit) {
    if (lateral && under.suit === m.base.suit) return null;
    return 300 + move.count;
  }
  if (!m.onto) {
    // Save empty columns: only use one when it frees a card that has somewhere to go.
    return under && !lateral && hasHome(state, under, move.from) ? 60 : null;
  }
  if (lateral) return null;
  return 150;
}

/**
 * The coach's suggestion for this position, or null when no useful move is
 * left. Follows a remembered or freshly solved winning line when possible.
 */
export function bestMove(state: State, opts: { maxNodes?: number } = {}): Hint | null {
  let line = knownLine(state);
  if (!line) {
    const solved = solve(state, { maxNodes: opts.maxNodes ?? 20_000 });
    if (solved.result === "win" && solved.moves.length > 0) line = solved.moves;
  }
  if (line) return hint(state, line[0], true);

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
