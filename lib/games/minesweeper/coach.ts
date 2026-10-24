/**
 * The AI Coach's hint ladder: direction (where to look), specific (why), then
 * the answer. It is driven by the logical solver, never by peeking at the
 * mines, except to catch a wrong flag first: hints built on a wrong flag
 * would be nonsense (and the solver trusts flags).
 */

import { minesLeft, neighbors, numberAt, type GameState } from "./board";
import { nextDeduction, type Deduction, type Technique } from "./solver";

export type HintTechnique = Technique | "mistake" | "tough-spot";

export interface Hint {
  technique: HintTechnique;
  title: string;
  direction: string;
  specific: string;
  answer: { cell: number; kind: "safe" | "mine" };
  /** The answer in words, e.g. "Row 4, column 7 is safe: open it." */
  answerText: string;
  /** Cells to outline: the numbers used, then the cells they settle. */
  cells: number[];
  /** Set when the hint is about a flag on a safe cell. */
  mistakeCell?: number;
  /** The solver step behind the hint. */
  deduction?: Deduction;
}

const TITLES: Record<HintTechnique, string> = {
  "single-flag": "Single flag",
  "single-safe": "Single safe",
  "1-1 pattern": "1-1 pattern",
  "1-2 pattern": "1-2 pattern",
  subset: "Subset",
  "frontier enumeration": "Frontier enumeration",
  "mine count": "Mine count",
  mistake: "Mistake",
  "tough-spot": "Tough spot",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const mineWord = (n: number) => plural(n, "mine");

/** "3", "3 and 6", "3, 6 and 7". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A wrongly flagged cell (a flag on a safe cell), or null. */
export function findMistake(state: GameState): number | null {
  const i = state.flagged.findIndex((f, k) => f && !state.mines[k] && !state.revealed[k]);
  return i >= 0 ? i : null;
}

function describe(state: GameState) {
  const { width, height } = state;
  const pos = (i: number) => `row ${Math.floor(i / width) + 1}, column ${(i % width) + 1}`;
  const Pos = (i: number) => {
    const p = pos(i);
    return p[0].toUpperCase() + p.slice(1);
  };
  const around = (i: number) => neighbors(width, height, i);
  const flagsAt = (i: number) => around(i).filter((j) => state.flagged[j]).length;
  const hiddenAt = (i: number) => around(i).filter((j) => !state.revealed[j] && !state.flagged[j]);
  const clue = (i: number) => `the ${numberAt(state, i)} at ${pos(i)}`;
  const need = (i: number) => numberAt(state, i) - flagsAt(i);
  /** "the 3 at row 2, column 5 (which already touches 1 flag) needs 2 more mines" */
  const needs = (i: number) => {
    const f = flagsAt(i);
    const n = need(i);
    return f ? `${clue(i)} already touches ${plural(f, "flag")}, so it needs ${n} more ${n === 1 ? "mine" : "mines"}` : `${clue(i)} needs ${mineWord(n)}`;
  };
  return { pos, Pos, flagsAt, hiddenAt, clue, need, needs };
}

function texts(state: GameState, d: Deduction): { direction: string; specific: string } {
  const t = describe(state);
  const [x, y] = d.clues;
  const target = d.cell;
  const verdict = d.kind === "safe" ? "safe" : "a mine";
  switch (d.technique) {
    case "single-safe": {
      const f = t.flagsAt(x);
      const why = f ? `already touches ${f === 1 ? "a flag" : `${f} flags`}, so every other` : "has no mines around it, so every";
      return {
        direction: `Look at ${t.clue(x)}.`,
        specific: `The ${numberAt(state, x)} at ${t.pos(x)} ${why} hidden cell around it is safe.`,
      };
    }
    case "single-flag": {
      const f = t.flagsAt(x);
      const h = t.hiddenAt(x).length;
      const n = numberAt(state, x);
      const why = f
        ? `already touches ${plural(f, "flag")} and has exactly ${plural(h, "other hidden cell")}, which makes ${n}`
        : `has exactly ${plural(h, "hidden cell")} around it`;
      return {
        direction: `Look at ${t.clue(x)}.`,
        specific: `The ${n} at ${t.pos(x)} ${why}, so ${h === 1 ? "that cell is a mine" : `all ${h} are mines`}.`,
      };
    }
    case "1-1 pattern":
    case "subset": {
      // tryPair: either X's hidden cells all touch Y (Y's other cells get the leftover mines),
      // or Y's hidden cells all touch X (Y covers X, so X's other cells are safe).
      if (d.mines.length && !d.safe.length) {
        const extra = t.need(y) - t.need(x);
        return {
          direction: `Compare ${t.clue(x)} with ${t.clue(y)}.`,
          specific: `Every hidden cell around ${t.clue(x)} also touches ${t.clue(y)}. ${cap(t.needs(x))} there, and ${t.needs(y)}, so the ${otherCells(d.mines.length)} around ${t.clue(y)} must hold ${mineWord(extra)}: ${d.mines.length === 1 ? "it is a mine" : "all of them are mines"}.`,
        };
      }
      return {
        direction: `Compare ${t.clue(x)} with ${t.clue(y)}.`,
        specific: `Every hidden cell around ${t.clue(y)} also touches ${t.clue(x)}. ${cap(t.needs(y))} among them, which is all ${t.clue(x)} needs too. So every other hidden cell around ${t.clue(x)} is safe.`,
      };
    }
    case "1-2 pattern": {
      const shared = t.hiddenAt(y).filter((c) => t.hiddenAt(x).includes(c)).length;
      const most = Math.min(t.need(x), shared);
      const safePart = d.safe.length
        ? ` That puts all the mines ${t.clue(x)} needs in the shared cells, so every other hidden cell around it is safe.`
        : "";
      return {
        direction: `Compare ${t.clue(x)} with ${t.clue(y)}.`,
        specific: `${cap(t.needs(y))}. They share ${plural(shared, "hidden cell")}, and ${t.clue(x)} allows at most ${mineWord(most)} there, so the ${otherCells(d.mines.length)} around ${t.clue(y)} ${d.mines.length === 1 ? "must be a mine" : "must all be mines"}.${safePart}`,
      };
    }
    case "frontier enumeration": {
      // Name the numbers closest to the answer; the rest of the edge is summarised.
      const dist = (i: number) =>
        Math.max(Math.abs(Math.floor(i / state.width) - Math.floor(target / state.width)), Math.abs((i % state.width) - (target % state.width)));
      const near = [...d.clues].sort((a, b) => dist(a) - dist(b) || a - b);
      const named = near.slice(0, d.clues.length > 3 ? 2 : 3).map(t.clue);
      if (d.clues.length > 3) named.push(`${d.clues.length - 2} other numbers along that edge`);
      return {
        direction: `Look at the edge of the opened area near ${t.pos(target)}.`,
        specific: `No single pair of numbers settles it here. Try every way of placing mines that fits ${list(named)}: in every one of them, ${t.pos(target)} is ${verdict}.`,
      };
    }
    case "mine count": {
      const left = minesLeft(state);
      const hidden = state.revealed.filter((r, i) => !r && !state.flagged[i]).length;
      if (left === 0) {
        return {
          direction: "Check the mine counter.",
          specific: "Every mine is already flagged, so all the remaining hidden cells are safe.",
        };
      }
      if (left === hidden) {
        return {
          direction: "Check the mine counter.",
          specific: `There are ${mineWord(left)} left and exactly ${plural(hidden, "hidden cell")}, so every hidden cell is a mine.`,
        };
      }
      return {
        direction: `Check the mine counter: ${mineWord(left)} left to find.`,
        specific: `The numbers alone allow several layouts, but only some of them use exactly ${mineWord(left)}. In every layout that does, ${t.pos(target)} is ${verdict}.`,
      };
    }
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** "other hidden cell" / "2 other hidden cells". */
const otherCells = (n: number) => (n === 1 ? "other hidden cell" : `${n} other hidden cells`);

function answerText(state: GameState, cell: number, kind: "safe" | "mine"): string {
  const where = describe(state).Pos(cell);
  return kind === "safe" ? `${where} is safe: open it.` : `${where} is a mine: flag it.`;
}

/** The coach's three-step hint for the current game, or null once it is won or lost. */
export function hint(state: GameState): Hint | null {
  if (state.status !== "playing") return null;
  const t = describe(state);

  const mistake = findMistake(state);
  if (mistake !== null) {
    return {
      technique: "mistake",
      title: TITLES.mistake,
      direction: `One of your flags isn't on a mine. Check row ${Math.floor(mistake / state.width) + 1}.`,
      specific: `The flag at ${t.pos(mistake)} is wrong.`,
      answer: { cell: mistake, kind: "safe" },
      answerText: `Remove the flag: ${t.pos(mistake)} is safe.`,
      cells: [mistake],
      mistakeCell: mistake,
    };
  }

  const d = nextDeduction(state);
  if (!d) {
    // Unreachable on a generated board; still give the player a way forward.
    const cell = state.mines.findIndex((m, i) => !m && !state.revealed[i]);
    if (cell < 0) return null;
    return {
      technique: "tough-spot",
      title: TITLES["tough-spot"],
      direction: "This position needs a step beyond the coach's toolkit.",
      specific: `Try working on the cells around ${t.pos(cell)}.`,
      answer: { cell, kind: "safe" },
      answerText: answerText(state, cell, "safe"),
      cells: [cell],
    };
  }

  const { direction, specific } = texts(state, d);
  return {
    technique: d.technique,
    title: TITLES[d.technique],
    direction,
    specific,
    answer: { cell: d.cell, kind: d.kind },
    answerText: answerText(state, d.cell, d.kind),
    cells: [...d.clues, ...d.safe, ...d.mines],
    deduction: d,
  };
}
