/**
 * The coach's hint ladder for nonograms: which line to look at, which rule
 * cracks it, then exactly which cells. Driven by the logical solver on the
 * player's own marks, never by peeking at the picture, except to catch a
 * wrong mark first (hints built on a wrong mark would be nonsense).
 */
import { EMPTY, FILLED, UNKNOWN } from "./line";
import { lineCells, nextStep, type Clues, type LineRef, type Step, type Technique } from "./solver";

export interface HintLadder {
  technique: Technique;
  title: string;
  /** Rung 1: which line. */
  direction: string;
  /** Rung 2: which rule, and why it applies. */
  specific: string;
  /** Rung 3: which cells. */
  answer: string;
  line?: LineRef;
  /** Cells the answer fills and crosses off. */
  fill: number[];
  empty: number[];
  /** Set when the ladder is about wrong marks. */
  mistakeCells?: number[];
}

export const TITLES: Record<Technique, string> = {
  "simple-boxes": "Simple boxes",
  "simple-spaces": "Simple spaces",
  "edge-logic": "Edge logic",
  forcing: "Forcing",
  contradiction: "Contradiction",
};

export const lineName = (ref: LineRef) => `${ref.kind === "row" ? "row" : "column"} ${ref.index + 1}`;
export const clueText = (clue: readonly number[]) => (clue.length ? clue.join(" ") : "0");

/** "3", "3 and 6", "3, 6 and 7". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** 1-based positions grouped into ranges: "2 to 4 and 7". */
function ranges(positions: number[]): string {
  const sorted = [...positions].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    const a = sorted[i] + 1;
    const b = sorted[j] + 1;
    parts.push(j === i ? `${a}` : j === i + 1 ? `${a} and ${b}` : `${a} to ${b}`);
    i = j + 1;
  }
  return list(parts);
}

const posInLine = (ref: LineRef, size: number, cell: number) => (ref.kind === "row" ? cell % size : Math.floor(cell / size));

function ruleText(step: Step, clue: readonly number[], line: number[], size: number): string {
  const n = size;
  const total = clue.reduce((a, b) => a + b, 0) + Math.max(0, clue.length - 1);
  const slack = n - total;
  switch (step.technique) {
    case "simple-boxes": {
      if (slack === 0 && clue.length === 1) return `Simple boxes: a block of ${n} fills the whole line.`;
      if (slack === 0) {
        return `Simple boxes: the blocks ${clueText(clue)} plus one gap between each add up to exactly ${n}, so there's only one way to place them.`;
      }
      if (clue.length === 1) {
        return `Simple boxes: a block of ${clue[0]} in a line of ${n} can only slide ${slack} cell${slack === 1 ? "" : "s"}. Push it all the way left, then all the way right: the cells it covers both times are filled wherever it ends up.`;
      }
      return `Simple boxes: the blocks ${clueText(clue)} with one gap between each take ${total} of the ${n} cells, leaving ${slack} spare. Push them all left, then all right: where a block covers the same cells both times, those cells are filled.`;
    }
    case "simple-spaces": {
      if (!clue.length) return "Simple spaces: the clue is 0, so nothing in this line is filled.";
      const filled = line.filter((v) => v === FILLED).length;
      if (filled === clue.reduce((a, b) => a + b, 0)) {
        return `Simple spaces: you've already filled all ${filled} cells the clue ${clueText(clue)} needs, so every other cell in this line is empty.`;
      }
      return `Simple spaces: work out how far each block of ${clueText(clue)} can reach with the cells you've already marked. No block can reach some cells, so those are empty.`;
    }
    case "edge-logic":
      return `Edge logic: a filled cell near the edge, or next to a crossed-out cell, pins its block down. Push each block of ${clueText(clue)} as far left and as far right as your marks allow: the cells it covers both ways must be filled.`;
    case "forcing":
      return `Forcing: only a few ways to place ${clueText(clue)} still fit your marks. Try each one in your head: some cells come out the same every time.`;
    case "contradiction":
      return "Contradiction: no single line settles this, so try a cell. If you assume the outlined cell the wrong way, following the clues breaks another line. So it must be the other way.";
  }
}

/** The coach's three-step hint for the player's marks (0 unknown, 1 filled, 2 crossed), or null if solved. */
export function hintLadder(cells: number[], solution: number[], clues: Clues, size: number): HintLadder | null {
  const wrong = cells.map((v, i) => ((v === FILLED && !solution[i]) || (v === EMPTY && solution[i]) ? i : -1)).filter((i) => i >= 0);
  if (wrong.length) {
    const first = wrong[0];
    const r = Math.floor(first / size) + 1;
    const c = (first % size) + 1;
    const should = solution[first] ? "filled" : "empty";
    return {
      technique: "simple-boxes",
      title: "Mistake",
      direction: `${wrong.length === 1 ? "One of your marks doesn't" : `${wrong.length} of your marks don't`} fit the picture. Check row ${r}.`,
      specific: `The cell in row ${r}, column ${c} should be ${should}.`,
      answer: `Fixed: row ${r}, column ${c} is ${should}.`,
      fill: solution[first] ? [first] : [],
      empty: solution[first] ? [] : [first],
      mistakeCells: wrong,
    };
  }
  if (cells.every((v, i) => (v === FILLED) === (solution[i] === 1))) return null;

  // Line logic on the player's marks (with any wrong-free crosses kept).
  const grid = cells.map((v) => (v === FILLED || v === EMPTY ? v : UNKNOWN));
  const step = nextStep(grid, clues, size);
  if (!step) {
    // Only reachable if every filled cell is already in place: the rest is crossing off.
    const empty = cells.map((v, i) => (v === UNKNOWN && !solution[i] ? i : -1)).filter((i) => i >= 0);
    return {
      technique: "simple-spaces",
      title: "Simple spaces",
      direction: "Every filled cell is already in place.",
      specific: "The cells you haven't marked are all empty.",
      answer: "Cross them off.",
      fill: [],
      empty,
    };
  }
  const clue = step.line.kind === "row" ? clues.rows[step.line.index] : clues.cols[step.line.index];
  const line = lineCells(step.line, size).map((i) => grid[i]);
  const name = lineName(step.line);
  const fillPos = step.fill.map((i) => posInLine(step.line, size, i));
  const emptyPos = step.empty.map((i) => posInLine(step.line, size, i));
  const parts: string[] = [];
  if (fillPos.length) parts.push(`fill cell${fillPos.length === 1 ? "" : "s"} ${ranges(fillPos)}`);
  if (emptyPos.length) parts.push(`cross off cell${emptyPos.length === 1 ? "" : "s"} ${ranges(emptyPos)}`);
  const from = step.line.kind === "row" ? "counting from the left" : "counting from the top";
  const answer =
    step.technique === "contradiction"
      ? `Row ${Math.floor((step.fill[0] ?? step.empty[0]) / size) + 1}, column ${((step.fill[0] ?? step.empty[0]) % size) + 1} is ${step.fill.length ? "filled" : "empty"}.`
      : `In ${name}, ${list(parts)} (${from}).`;
  return {
    technique: step.technique,
    title: TITLES[step.technique],
    direction:
      step.technique === "contradiction"
        ? "No single line gives anything away right now. Look at the outlined cell."
        : `Look at ${name}, with the clue ${clueText(clue)}.`,
    specific: ruleText(step, clue, line, size),
    answer: answer.charAt(0).toUpperCase() + answer.slice(1),
    line: step.line,
    fill: step.fill,
    empty: step.empty,
  };
}
