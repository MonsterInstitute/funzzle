/**
 * The AI Coach's hint ladder: direction (where to look), specific (why), then
 * the answer. It is driven by the logical solver, never by peeking at the
 * solution, except to catch the player's mistakes first: hints built on a wrong
 * digit would be nonsense.
 */

import { UNITS, boxOf, colOf, rowOf, type Grid } from "./grid";
import { applyStep, findStep, nextStep, startingCandidates, type Step, type Technique } from "./techniques";

export interface HintLadder {
  technique: Technique;
  title: string;
  direction: string;
  specific: string;
  answer: string;
  answerPlacement?: { cell: number; digit: number };
  /** Set when the ladder is about a wrong digit the player entered. */
  mistakeCell?: number;
  /** The solver step behind the ladder, so the UI can outline its cells and units. */
  step?: Step;
}

const TITLES: Record<Technique, string> = {
  "naked-single": "Naked single",
  "hidden-single": "Hidden single",
  pointing: "Pointing",
  claiming: "Claiming",
  "naked-pair": "Naked pair",
  "hidden-pair": "Hidden pair",
  "naked-triple": "Naked triple",
  "hidden-triple": "Hidden triple",
  "x-wing": "X-Wing",
  swordfish: "Swordfish",
  "xy-wing": "XY-Wing",
};

const UNIT_WORD = { row: "row", col: "column", box: "box" } as const;

const cellName = (i: number) => `R${rowOf(i) + 1}C${colOf(i) + 1}`;
const unitName = (u: Step["units"][number]) => `${UNIT_WORD[u.kind]} ${u.index + 1}`;

/** "3", "3 and 6", "3, 6 and 7". */
function list(items: (string | number)[]): string {
  const s = items.map(String);
  if (s.length <= 1) return s.join("");
  return `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
}

const missingFrom = (grid: Grid, u: number) => {
  const have = new Set(UNITS[u].map((i) => grid[i]));
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !have.has(d));
};

function nakedSingleWhy(grid: Grid, cell: number, digit: number): string {
  const units = [
    { word: "row", u: rowOf(cell) },
    { word: "column", u: 9 + colOf(cell) },
    { word: "box", u: 18 + boxOf(cell) },
  ].map((x) => ({ ...x, missing: missingFrom(grid, x.u) }));
  // Two units are easier to compare than three; use a pair if it already pins the digit.
  for (const [a, b] of [[0, 2], [0, 1], [1, 2]]) {
    const both = units[a].missing.filter((d) => units[b].missing.includes(d));
    if (both.length === 1 && both[0] === digit) {
      return `Look at the outlined cell. Its ${units[a].word} is missing ${list(units[a].missing)}. Its ${units[b].word} is missing ${list(units[b].missing)}. Only one number fits both.`;
    }
  }
  return "Look at the outlined cell. Check which numbers its row, column and box already use: only one number is left over.";
}

/** "Cross off 4 from R1C2 and R1C5; 7 from R1C2". */
function describeEliminations(elims: Step["eliminations"]): string {
  const byDigit = new Map<number, number[]>();
  for (const { cell, digit } of elims) byDigit.set(digit, [...(byDigit.get(digit) ?? []), cell]);
  const parts = [...byDigit.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, cells]) => {
      const names = cells.map(cellName);
      const shown = names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more cells`] : names;
      return `${d} from ${list(shown)}`;
    });
  return `Cross off ${parts.join("; ")}.`;
}

/** Applies the step, then keeps solving until a digit gets placed; `direct` if it's the very next move. */
function followUpPlacement(grid: Grid, step: Step): { cell: number; digit: number; direct: boolean } | null {
  const work = grid.slice();
  const cand = startingCandidates(work);
  applyStep(work, cand, step);
  for (let n = 0; n < 200; n++) {
    const next = findStep(work, cand);
    if (!next) return null;
    if (next.placement) return { ...next.placement, direct: n === 0 };
    applyStep(work, cand, next);
  }
  return null;
}

function texts(grid: Grid, step: Step): { direction: string; specific: string } {
  const [d] = step.digits;
  const u0 = step.units[0];
  switch (step.technique) {
    case "naked-single": {
      const cell = step.placement!.cell;
      return {
        direction: `Look at row ${rowOf(cell) + 1}. One cell there can only take one number.`,
        specific: nakedSingleWhy(grid, cell, d),
      };
    }
    case "hidden-single": {
      const others = u0.kind === "box" ? "row or column" : u0.kind === "row" ? "column or box" : "row or box";
      return {
        direction: `Look at ${unitName(u0)}. One of its missing numbers has only one place to go.`,
        specific: `Find where ${d} can go in ${unitName(u0)}. Every other empty cell there already sees a ${d} in its ${others}.`,
      };
    }
    case "pointing": {
      const line = step.units[1];
      return {
        direction: `Look at ${unitName(u0)}. One number can only sit in a single ${UNIT_WORD[line.kind]} inside it.`,
        specific: `In ${unitName(u0)}, ${d} only fits in the outlined cells, all in ${unitName(line)}. So ${d} can't go anywhere else in ${unitName(line)}.`,
      };
    }
    case "claiming": {
      const box = step.units[1];
      return {
        direction: `Look at ${unitName(u0)}. One number can only go inside a single box there.`,
        specific: `In ${unitName(u0)}, ${d} only fits in the outlined cells, all in ${unitName(box)}. So ${d} can't go in the rest of ${unitName(box)}.`,
      };
    }
    case "naked-pair":
    case "naked-triple": {
      const n = step.technique === "naked-pair" ? "Two" : "Three";
      return {
        direction: `Look at ${unitName(u0)}. ${n} cells there share the same ${n.toLowerCase()} possible numbers.`,
        specific: `The outlined cells can only be ${list(step.digits)}, so those numbers are taken. Remove them from the other cells in ${unitName(u0)}.`,
      };
    }
    case "hidden-pair":
    case "hidden-triple": {
      const n = step.technique === "hidden-pair" ? "Two" : "Three";
      return {
        direction: `Look at ${unitName(u0)}. ${n} numbers can only go in the same ${n.toLowerCase()} cells.`,
        specific: `In ${unitName(u0)}, ${list(step.digits)} only fit in the outlined cells. So those cells can't hold any other number.`,
      };
    }
    case "x-wing":
    case "swordfish": {
      const k = step.technique === "x-wing" ? 2 : 3;
      const base = step.units.slice(0, k);
      const cover = step.units.slice(k);
      const bw = `${UNIT_WORD[base[0].kind]}s`;
      const cw = `${UNIT_WORD[cover[0].kind]}s`;
      return {
        direction: `Look at where ${d} can go in ${bw} ${list(base.map((u) => u.index + 1))}.`,
        specific: `In those ${bw}, ${d} only fits in ${cw} ${list(cover.map((u) => u.index + 1))}, so those ${cw} get their ${d} from the outlined cells. Remove ${d} from the rest of those ${cw}.`,
      };
    }
    case "xy-wing": {
      const [p, a, c] = step.focusCells;
      const [x, y, z] = step.digits;
      return {
        direction: `Look at ${cellName(p)}. It can only be ${x} or ${y}.`,
        specific: `If it's ${x}, ${cellName(a)} must be ${z}; if it's ${y}, ${cellName(c)} must be ${z}. So no cell that sees both ${cellName(a)} and ${cellName(c)} can be ${z}.`,
      };
    }
  }
}

/** The coach's three-step hint for the player's current grid, or null if it's already solved. */
export function hintLadder(grid: Grid, solution: Grid): HintLadder | null {
  const mistake = grid.findIndex((d, i) => d !== 0 && d !== solution[i]);
  if (mistake >= 0) {
    const r = rowOf(mistake) + 1;
    const c = colOf(mistake) + 1;
    return {
      technique: "naked-single",
      title: "Mistake",
      direction: `One of your numbers doesn't fit the solution. Check row ${r}.`,
      specific: `The number in row ${r}, column ${c} is wrong.`,
      answer: `Clear it: R${r}C${c} should be ${solution[mistake]}.`,
      answerPlacement: { cell: mistake, digit: solution[mistake] },
      mistakeCell: mistake,
    };
  }
  if (grid.every((d) => d !== 0)) return null;

  const step = nextStep(grid);
  if (!step) {
    // Only reachable if the position needs a technique the solver lacks; still give the player a way forward.
    const cell = grid.findIndex((d) => d === 0);
    return {
      technique: "naked-single",
      title: "Tough spot",
      direction: "This position needs a trick beyond the coach's toolkit.",
      specific: `Try working on ${cellName(cell)} using your notes.`,
      answer: `${cellName(cell)} is ${solution[cell]}.`,
      answerPlacement: { cell, digit: solution[cell] },
    };
  }

  const { direction, specific } = texts(grid, step);
  const base = { technique: step.technique, title: TITLES[step.technique], direction, specific, step };
  if (step.placement) {
    const { cell, digit } = step.placement;
    const answer = step.technique === "naked-single" ? `It's a ${digit}.` : `The ${digit} goes in ${cellName(cell)}.`;
    return { ...base, answer, answerPlacement: { cell, digit } };
  }

  const crossOff = describeEliminations(step.eliminations);
  const follow = followUpPlacement(grid, step);
  // The solver is sound, so this always holds; the check keeps a bug from ever placing a wrong digit.
  if (!follow || solution[follow.cell] !== follow.digit) return { ...base, answer: crossOff };
  const then = follow.direct
    ? `Now ${cellName(follow.cell)} has to be ${follow.digit}.`
    : `Keep going from there and ${cellName(follow.cell)} works out to ${follow.digit}.`;
  return { ...base, answer: `${crossOff} ${then}`, answerPlacement: { cell: follow.cell, digit: follow.digit } };
}

