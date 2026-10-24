/**
 * The coach's hint ladder for kakuro: where to look (and which technique),
 * why it works, then the digit. Driven by the logical solver on the player's
 * own digits, never by peeking at the solution, except to catch a wrong digit
 * first (hints built on a wrong digit would be nonsense).
 */
import { combosFor, digitsOf, runState, startingCandidates, type Board, type Run } from "./grid";
import { applyStep, findStep, techniqueLevel, type Step, type Technique } from "./techniques";

export interface HintLadder {
  technique: Technique;
  title: string;
  direction: string;
  specific: string;
  answer: string;
  answerPlacement?: { cell: number; digit: number };
  /** Set when the ladder is about a wrong digit the player entered. */
  mistakeCell?: number;
  /** Runs to outline on the first rung, cells on the second. */
  runs: number[];
  focusCells: number[];
}

export const TITLES: Record<Technique, string> = {
  "last-cell": "Last cell",
  intersection: "Intersection",
  "unique-sum": "Unique sum",
  "sum-combos": "Sum combinations",
  "crossing-elimination": "Crossing elimination",
};

/** "3", "3 and 6", "3, 6 and 7" (or "or"). */
function list(items: (string | number)[], last = "and"): string {
  const s = items.map(String);
  if (s.length <= 1) return s.join("");
  return `${s.slice(0, -1).join(", ")} ${last} ${s[s.length - 1]}`;
}

export const comboText = (m: number) => digitsOf(m).join(" + ");

export function cellName(board: Board, i: number): string {
  return `row ${Math.floor(i / board.width)}, column ${i % board.width}`;
}

export function runName(board: Board, run: Run): string {
  const first = run.cells[0];
  return run.dir === "across"
    ? `the across run in row ${Math.floor(first / board.width)} (clue ${run.sum})`
    : `the down run in column ${first % board.width} (clue ${run.sum})`;
}

/** "a 4 in two cells" or, with digits already placed, "the 7 still needed from two cells". */
function need(board: Board, run: Run, values: number[]): { text: string; placed: number[] } {
  const { remaining, empty } = runState(run, values);
  const placed = run.cells.filter((i) => values[i]).map((i) => values[i]);
  const k = empty.length;
  const cells = k === 1 ? "one cell" : `${["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][k]} cells`;
  return placed.length
    ? { text: `the ${remaining} still needed from ${cells} (the run already has ${list(placed)})`, placed }
    : { text: `${remaining === 8 || remaining === 11 || remaining === 18 ? "an" : "a"} ${remaining} in ${cells}`, placed };
}

function stepText(board: Board, values: number[], step: Step, cell: number): string {
  const run = board.runs[step.runs[0]];
  const where = cellName(board, cell);
  const out = step.eliminations.filter((e) => e.cell === cell).map((e) => e.digit);
  const n = need(board, run, values);
  switch (step.technique) {
    case "last-cell": {
      const d = step.placement!.digit;
      return `In ${runName(board, run)}, only one cell is still empty. The other cells add up to ${run.sum - d}, so the last one is ${run.sum} − ${run.sum - d} = ${d}.`;
    }
    case "intersection": {
      const d = step.placement!.digit;
      return `That leaves only ${d} for ${where}: it's the one digit both of its runs still allow.`;
    }
    case "unique-sum": {
      const m = step.combos[0];
      const t = n.text.charAt(0).toUpperCase() + n.text.slice(1);
      return `${t} can only be ${comboText(m)}. So ${where} is ${list(digitsOf(m), "or")}${out.length && out.length <= 2 ? `, not ${list(out, "or")}` : ""}.`;
    }
    case "sum-combos": {
      const shown = step.combos.slice(0, 4).map(comboText);
      const extra = step.combos.length - shown.length;
      if (extra) shown.push(extra === 1 ? "one more way" : `${extra} more ways`);
      const t = n.text.charAt(0).toUpperCase() + n.text.slice(1);
      return `${t} can be ${list(shown, "or")}. None of those uses ${list(out, "or")}, so ${where} can't be ${list(out, "or")}.`;
    }
    case "crossing-elimination": {
      const shown = step.combos.slice(0, 3).map(comboText);
      return `Check each way to make ${n.text} against what the crossing runs allow. Only ${list(shown, "or")}${step.combos.length > 3 ? " and a few more" : ""} still fit${step.combos.length === 1 ? "s" : ""}, and none of the ways that fit put ${list(out, "or")} in ${where}.`;
    }
  }
}

/** The coach's three-step hint for the player's digits, or null if the board is already solved. */
export function hintLadder(board: Board, values: number[], solution: number[]): HintLadder | null {
  const mistake = values.findIndex((v, i) => board.white[i] && v !== 0 && v !== solution[i]);
  if (mistake >= 0) {
    const name = cellName(board, mistake);
    return {
      technique: "last-cell",
      title: "Mistake",
      direction: `One of your digits doesn't fit the solution. Check row ${Math.floor(mistake / board.width)}.`,
      specific: `The digit in ${name} is wrong.`,
      answer: `Clear it: ${name} should be ${solution[mistake]}.`,
      answerPlacement: { cell: mistake, digit: solution[mistake] },
      mistakeCell: mistake,
      runs: [...board.runOf[mistake]],
      focusCells: [mistake],
    };
  }
  if (values.every((v, i) => !board.white[i] || v)) return null;

  // Follow the solver to its next placement, remembering the steps that narrowed that cell.
  const work = values.slice();
  const cand = startingCandidates(board, work);
  const steps: Step[] = [];
  let placement: Step | null = null;
  for (let n = 0; n < 500; n++) {
    const step = findStep(board, work, cand);
    if (!step) break;
    if (step.placement) {
      placement = step;
      break;
    }
    steps.push(step);
    applyStep(board, work, cand, step);
  }
  if (!placement || solution[placement.placement!.cell] !== placement.placement!.digit) {
    // Only reachable if the position needs more than the coach's toolkit; still give a way forward.
    const cell = values.findIndex((v, i) => board.white[i] && !v);
    return {
      technique: "crossing-elimination",
      title: "Tough spot",
      direction: "This position needs a trick beyond the coach's toolkit.",
      specific: `Try ${cellName(board, cell)}: write down what its two runs allow.`,
      answer: `${cellName(board, cell)} is ${solution[cell]}.`,
      answerPlacement: { cell, digit: solution[cell] },
      runs: [...board.runOf[cell]],
      focusCells: [cell],
    };
  }

  const { cell, digit } = placement.placement!;
  const relevant = steps.filter((s) => s.eliminations.some((e) => e.cell === cell));
  // Keep the explanation short: at most one step per run, the hardest last.
  const byRun = new Map<number, Step>();
  for (const s of relevant) byRun.set(s.runs[0], s);
  const why = [...byRun.values()].slice(-3);
  let key = [...why, placement].reduce((a, b) => (techniqueLevel(b.technique) > techniqueLevel(a.technique) ? b : a));
  // Two unique sums crossing on the cell pin it down: that's the classic intersection.
  const fromBoth = board.runOf[cell].every((r) => why.some((s) => s.runs[0] === r));
  if (fromBoth && key.technique === "unique-sum" && placement.technique === "intersection") key = placement;
  const technique = key.technique;
  const name = cellName(board, cell);
  const keyRun = board.runs[key.runs[0]];

  let direction: string;
  if (technique === "last-cell") direction = `Look at ${runName(board, keyRun)}. Only one of its cells is still empty.`;
  else if (technique === "intersection") direction = `Look at ${name}, where an across run and a down run cross. Compare what each one allows.`;
  else if (technique === "unique-sum") direction = `Look at ${runName(board, keyRun)}. There's only one way to make that sum.`;
  else if (technique === "sum-combos") direction = `Look at ${runName(board, keyRun)}. List the ways to make that sum.`;
  else direction = `Look at ${runName(board, keyRun)}, and at what its crossing runs allow.`;

  // Explain each narrowing step on the cell from the position it was found in.
  const replay = values.slice();
  const replayCand = startingCandidates(board, replay);
  const sentences: string[] = [];
  for (const s of steps) {
    if (why.includes(s)) sentences.push(stepText(board, replay, s, cell));
    applyStep(board, replay, replayCand, s);
  }
  if (placement.technique === "last-cell") sentences.push(stepText(board, replay, placement, cell));
  else if (sentences.length || placement.technique === "intersection") {
    const [a, d] = board.runOf[cell];
    if (!sentences.length) {
      const usedA = digitsOf(runState(board.runs[a], values).used);
      const usedD = digitsOf(runState(board.runs[d], values).used);
      sentences.push(`Its across run already has ${list(usedA) || "nothing"} and its down run has ${list(usedD) || "nothing"}.`);
    }
    sentences.push(`That leaves only ${digit} for ${name}.`);
  }

  return {
    technique,
    title: TITLES[technique],
    direction,
    specific: sentences.join(" "),
    answer: `${name.charAt(0).toUpperCase() + name.slice(1)} is ${digit}.`,
    answerPlacement: { cell, digit },
    runs: key === placement ? [...board.runOf[cell]] : [key.runs[0]],
    focusCells: [cell],
  };
}

/** Combinations for a sum, for the "Teach me" panel: "4 in two cells: 1 + 3". */
export function combosLine(sum: number, cells: number): string {
  const combos = combosFor(cells, sum);
  return combos.length ? combos.map(comboText).join(", ") : "none";
}
