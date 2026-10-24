/**
 * Human-style logical solver. Each finder looks for one technique on the
 * current candidate masks and returns a Step that explains itself (cells,
 * units, digits), so the coach can turn it into plain-language hints and the
 * generator can grade puzzles by the hardest technique they need.
 *
 * Every technique here is sound without assuming uniqueness, so if the solver
 * fills the grid, that fill is the puzzle's only solution.
 */

import {
  ALL_DIGITS,
  IS_PEER,
  PEERS,
  UNITS,
  bit,
  boxOf,
  candidates,
  colOf,
  digitsOf,
  firstDigit,
  popcount,
  rowOf,
  unitRef,
  type Grid,
  type UnitKind,
} from "./grid";

/** Ordered from easiest to hardest; the solver always tries them in this order. */
export const TECHNIQUES = [
  "naked-single",
  "hidden-single",
  "pointing",
  "claiming",
  "naked-pair",
  "hidden-pair",
  "naked-triple",
  "hidden-triple",
  "x-wing",
  "swordfish",
  "xy-wing",
] as const;

export type Technique = (typeof TECHNIQUES)[number];

export const techniqueLevel = (t: Technique) => TECHNIQUES.indexOf(t);

export interface Step {
  technique: Technique;
  placement?: { cell: number; digit: number };
  eliminations: { cell: number; digit: number }[];
  focusCells: number[];
  units: { kind: UnitKind; index: number }[];
  digits: number[];
}

type Finder = (grid: Grid, cand: number[]) => Step | null;

const BOX_ROW_COL_ORDER = [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** All k-element combinations of `items` (k is 2 or 3 here, so plain recursion is fine). */
function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const rec = (start: number) => {
    if (pick.length === k) {
      out.push(pick.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - pick.length); i++) {
      pick.push(items[i]);
      rec(i + 1);
      pick.pop();
    }
  };
  rec(0);
  return out;
}

const nakedSingle: Finder = (grid, cand) => {
  for (let i = 0; i < 81; i++) {
    if (grid[i] || popcount(cand[i]) !== 1) continue;
    const digit = firstDigit(cand[i]);
    return {
      technique: "naked-single",
      placement: { cell: i, digit },
      eliminations: [],
      focusCells: [i],
      units: [unitRef(rowOf(i)), unitRef(9 + colOf(i)), unitRef(18 + boxOf(i))],
      digits: [digit],
    };
  }
  return null;
};

/** Boxes first: a digit with one home in a box is the easiest thing for people to spot. */
const hiddenSingle: Finder = (grid, cand) => {
  for (const u of BOX_ROW_COL_ORDER) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      let spot = -1;
      let count = 0;
      for (const i of UNITS[u]) {
        if (cand[i] & b) {
          spot = i;
          if (++count > 1) break;
        }
      }
      if (count === 1) {
        return {
          technique: "hidden-single",
          placement: { cell: spot, digit: d },
          eliminations: [],
          focusCells: [spot],
          units: [unitRef(u)],
          digits: [d],
        };
      }
    }
  }
  return null;
};

/** Cells of a unit that still have digit `b` as a candidate. */
const cellsWith = (unit: number[], cand: number[], b: number) => unit.filter((i) => cand[i] & b);

/** Pointing: a digit confined to one row/column inside a box leaves the rest of that line. */
const pointing: Finder = (_grid, cand) => {
  for (let box = 0; box < 9; box++) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      const cells = cellsWith(UNITS[18 + box], cand, b);
      if (cells.length < 2) continue;
      for (const line of [rowOf(cells[0]), 9 + colOf(cells[0])]) {
        const lineOf = line < 9 ? rowOf : (i: number) => 9 + colOf(i);
        if (!cells.every((i) => lineOf(i) === line)) continue;
        const eliminations = UNITS[line]
          .filter((i) => boxOf(i) !== box && cand[i] & b)
          .map((cell) => ({ cell, digit: d }));
        if (eliminations.length) {
          return {
            technique: "pointing",
            eliminations,
            focusCells: cells,
            units: [unitRef(18 + box), unitRef(line)],
            digits: [d],
          };
        }
      }
    }
  }
  return null;
};

/** Claiming (box/line reduction): a digit confined to one box within a line leaves the rest of that box. */
const claiming: Finder = (_grid, cand) => {
  for (let line = 0; line < 18; line++) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      const cells = cellsWith(UNITS[line], cand, b);
      if (cells.length < 2) continue;
      const box = boxOf(cells[0]);
      if (!cells.every((i) => boxOf(i) === box)) continue;
      const inLine = (i: number) => (line < 9 ? rowOf(i) === line : colOf(i) === line - 9);
      const eliminations = UNITS[18 + box]
        .filter((i) => !inLine(i) && cand[i] & b)
        .map((cell) => ({ cell, digit: d }));
      if (eliminations.length) {
        return {
          technique: "claiming",
          eliminations,
          focusCells: cells,
          units: [unitRef(line), unitRef(18 + box)],
          digits: [d],
        };
      }
    }
  }
  return null;
};

/** Naked subset: k cells in a unit sharing exactly k candidates own those digits. */
function nakedSubset(k: number, technique: Technique): Finder {
  return (_grid, cand) => {
    for (const u of BOX_ROW_COL_ORDER) {
      const unit = UNITS[u];
      const pool = unit.filter((i) => cand[i] && popcount(cand[i]) <= k);
      if (pool.length < k) continue;
      for (const combo of combinations(pool, k)) {
        let union = 0;
        for (const i of combo) union |= cand[i];
        if (popcount(union) !== k) continue;
        const eliminations: Step["eliminations"] = [];
        for (const j of unit) {
          if (combo.includes(j) || !(cand[j] & union)) continue;
          for (const digit of digitsOf(cand[j] & union)) eliminations.push({ cell: j, digit });
        }
        if (eliminations.length) {
          return { technique, eliminations, focusCells: combo, units: [unitRef(u)], digits: digitsOf(union) };
        }
      }
    }
    return null;
  };
}

/** Hidden subset: k digits that fit in only the same k cells of a unit clear every other digit there. */
function hiddenSubset(k: number, technique: Technique): Finder {
  return (_grid, cand) => {
    for (const u of BOX_ROW_COL_ORDER) {
      const unit = UNITS[u];
      const pos: number[] = [0];
      const pool: number[] = [];
      for (let d = 1; d <= 9; d++) {
        const b = bit(d);
        let m = 0;
        for (let k2 = 0; k2 < 9; k2++) if (cand[unit[k2]] & b) m |= 1 << k2;
        pos.push(m);
        const n = popcount(m);
        if (n >= 2 && n <= k) pool.push(d);
      }
      if (pool.length < k) continue;
      for (const combo of combinations(pool, k)) {
        let where = 0;
        let digitMask = 0;
        for (const d of combo) {
          where |= pos[d];
          digitMask |= bit(d);
        }
        if (popcount(where) !== k) continue;
        const cells = unit.filter((_, k2) => where & (1 << k2));
        const eliminations: Step["eliminations"] = [];
        for (const i of cells) for (const digit of digitsOf(cand[i] & ~digitMask)) eliminations.push({ cell: i, digit });
        if (eliminations.length) {
          return { technique, eliminations, focusCells: cells, units: [unitRef(u)], digits: combo };
        }
      }
    }
    return null;
  };
}

/** Basic fish (X-Wing k=2, Swordfish k=3): k base lines whose digit spots fit in k cover lines. */
function fish(k: number, technique: Technique): Finder {
  return (_grid, cand) => {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (const byRow of [true, false]) {
        const cellAt = (line: number, cover: number) => (byRow ? line * 9 + cover : cover * 9 + line);
        const spots: number[] = [];
        const pool: number[] = [];
        for (let line = 0; line < 9; line++) {
          let m = 0;
          for (let c = 0; c < 9; c++) if (cand[cellAt(line, c)] & b) m |= 1 << c;
          spots.push(m);
          const n = popcount(m);
          if (n >= 2 && n <= k) pool.push(line);
        }
        if (pool.length < k) continue;
        for (const base of combinations(pool, k)) {
          let union = 0;
          for (const line of base) union |= spots[line];
          if (popcount(union) !== k) continue;
          const covers = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => union & (1 << c));
          const eliminations: Step["eliminations"] = [];
          for (const cover of covers) {
            for (let line = 0; line < 9; line++) {
              if (base.includes(line)) continue;
              const cell = cellAt(line, cover);
              if (cand[cell] & b) eliminations.push({ cell, digit: d });
            }
          }
          if (!eliminations.length) continue;
          const focusCells: number[] = [];
          for (const line of base) for (const cover of covers) if (cand[cellAt(line, cover)] & b) focusCells.push(cellAt(line, cover));
          const baseUnit = (line: number) => unitRef(byRow ? line : 9 + line);
          const coverUnit = (c: number) => unitRef(byRow ? 9 + c : c);
          return {
            technique,
            eliminations,
            focusCells: focusCells.sort((a, b2) => a - b2),
            units: [...base.map(baseUnit), ...covers.map(coverUnit)],
            digits: [d],
          };
        }
      }
    }
    return null;
  };
}

/**
 * XY-Wing: a pivot {x,y} sees pincers {x,z} and {y,z}. Either way one pincer
 * is z, so any cell seeing both pincers can't be z.
 */
const xyWing: Finder = (_grid, cand) => {
  for (let p = 0; p < 81; p++) {
    const pm = cand[p];
    if (popcount(pm) !== 2) continue;
    const wings = PEERS[p].filter((i) => popcount(cand[i]) === 2 && cand[i] !== pm && popcount(cand[i] & pm) === 1);
    for (const a of wings) {
      const x = cand[a] & pm;
      const z = cand[a] & ~pm;
      const want = (pm & ~x) | z;
      for (const c of wings) {
        if (c === a || cand[c] !== want) continue;
        const eliminations: Step["eliminations"] = [];
        for (let i = 0; i < 81; i++) {
          if (i === a || i === c || i === p || !(cand[i] & z)) continue;
          if (IS_PEER[i * 81 + a] && IS_PEER[i * 81 + c]) eliminations.push({ cell: i, digit: firstDigit(z) });
        }
        if (eliminations.length) {
          return {
            technique: "xy-wing",
            eliminations,
            focusCells: [p, a, c],
            units: [],
            digits: [firstDigit(x), firstDigit(pm & ~x), firstDigit(z)],
          };
        }
      }
    }
  }
  return null;
};

const FINDERS: Finder[] = [
  nakedSingle,
  hiddenSingle,
  pointing,
  claiming,
  nakedSubset(2, "naked-pair"),
  hiddenSubset(2, "hidden-pair"),
  nakedSubset(3, "naked-triple"),
  hiddenSubset(3, "hidden-triple"),
  fish(2, "x-wing"),
  fish(3, "swordfish"),
  xyWing,
];

/** Easiest step at or below `maxLevel`, or null if stuck (or if some empty cell has no candidates). */
export function findStep(grid: Grid, cand: number[], maxLevel = FINDERS.length - 1): Step | null {
  for (let i = 0; i < 81; i++) if (!grid[i] && !cand[i]) return null;
  for (let level = 0; level <= maxLevel; level++) {
    const step = FINDERS[level](grid, cand);
    if (step) return step;
  }
  return null;
}

/** Applies a step to a working grid and its candidate masks, in place. */
export function applyStep(grid: Grid, cand: number[], step: Step): void {
  if (step.placement) {
    const { cell, digit } = step.placement;
    grid[cell] = digit;
    cand[cell] = 0;
    for (const j of PEERS[cell]) cand[j] &= ~bit(digit);
  }
  for (const { cell, digit } of step.eliminations) cand[cell] &= ~bit(digit);
}

/** Candidate masks to start from: the grid's own, narrowed by the caller's notes if given. */
export function startingCandidates(grid: Grid, notes?: number[]): number[] {
  const cand = candidates(grid);
  if (notes) for (let i = 0; i < 81; i++) if (!grid[i]) cand[i] &= notes[i] & ALL_DIGITS;
  return cand;
}

/** Easiest logical step from this position; singles always win when available. */
export function nextStep(grid: Grid, notes?: number[]): Step | null {
  return findStep(grid, startingCandidates(grid, notes));
}

export interface LogicResult {
  steps: Step[];
  solved: boolean;
  hardest: Technique | null;
  grid: Grid;
}

/** Runs the solver with techniques up to `maxLevel` until solved or stuck. */
export function runLogic(puzzle: Grid, maxLevel = FINDERS.length - 1): LogicResult {
  const grid = puzzle.slice();
  const cand = candidates(grid);
  const steps: Step[] = [];
  let hardest = -1;
  for (;;) {
    const step = findStep(grid, cand, maxLevel);
    if (!step) break;
    steps.push(step);
    hardest = Math.max(hardest, techniqueLevel(step.technique));
    applyStep(grid, cand, step);
  }
  return {
    steps,
    solved: grid.every((d) => d !== 0),
    hardest: hardest < 0 ? null : TECHNIQUES[hardest],
    grid,
  };
}

/** Solves as a person would, recording each step; `solved` is false if it needed guessing. */
export function solveLogically(puzzle: Grid): LogicResult {
  return runLogic(puzzle);
}
