/**
 * Human-style Minesweeper solver. It only looks at what a player can see:
 * opened numbers, known mines (the player's flags, or mines it has proved
 * itself) and the total mine count. Each finder returns a Deduction that names
 * its technique and the numbers it used, so the coach can explain it and the
 * generator can check a board never needs a guess.
 *
 * Techniques, easiest first:
 *  - single-flag / single-safe: one number on its own.
 *  - 1-1 pattern, 1-2 pattern, subset: two numbers whose hidden cells overlap.
 *  - frontier enumeration: every mine placement along one connected stretch
 *    of the edge that fits its numbers (bounded in size and effort).
 *  - mine count: the same placements, filtered by the total mines left.
 *
 * Every technique is sound, so a forced cell really is safe (or a mine) on the
 * actual layout as long as the known mines are right.
 */

import { adjacentCounts, floodReveal, neighbors, type GameState, type Layout } from "./board";

/** Ordered from easiest to hardest; the solver always tries them in this order. */
export const TECHNIQUES = [
  "single-flag",
  "single-safe",
  "1-1 pattern",
  "1-2 pattern",
  "subset",
  "frontier enumeration",
  "mine count",
] as const;

export type Technique = (typeof TECHNIQUES)[number];

export const techniqueLevel = (t: Technique) => TECHNIQUES.indexOf(t);

export interface Deduction {
  technique: Technique;
  /** The headline cell: the first safe cell if there is one, otherwise the first mine. */
  cell: number;
  kind: "safe" | "mine";
  /** Every cell this reasoning proves safe, and every cell it proves a mine. */
  safe: number[];
  mines: number[];
  /**
   * The opened numbers the reasoning uses. For pair techniques this is
   * [X, Y]: Y is the number doing the forcing (see findPair).
   */
  clues: number[];
}

/** What the solver knows: the player's view of the board. */
export interface View {
  width: number;
  height: number;
  mineCount: number;
  revealed: boolean[];
  /** Cells known to be mines (flags, or proved). */
  known: boolean[];
  /** Numbers of the whole layout; only read for revealed cells. */
  numbers: number[];
}

/** One opened number: `need` more mines among its hidden, unknown neighbors. */
interface Constraint {
  clue: number;
  cells: number[];
  need: number;
}

/** Bigger frontier components are left to the global step (or count as stuck). */
export const MAX_COMPONENT_CELLS = 48;
/** Search nodes per component before the enumeration gives up on it. */
export const NODE_BUDGET = 60_000;

function constraintsOf(v: View): Constraint[] {
  const out: Constraint[] = [];
  for (let i = 0; i < v.revealed.length; i++) {
    if (!v.revealed[i] || v.numbers[i] < 0) continue;
    const cells: number[] = [];
    let flags = 0;
    for (const j of neighbors(v.width, v.height, i)) {
      if (v.known[j]) flags++;
      else if (!v.revealed[j]) cells.push(j);
    }
    if (cells.length) out.push({ clue: i, cells, need: v.numbers[i] - flags });
  }
  return out;
}

function deduction(technique: Technique, safe: number[], mines: number[], clues: number[]): Deduction {
  const s = [...new Set(safe)].sort((a, b) => a - b);
  const m = [...new Set(mines)].sort((a, b) => a - b);
  return { technique, cell: s.length ? s[0] : m[0], kind: s.length ? "safe" : "mine", safe: s, mines: m, clues };
}

/**
 * One number on its own. With `batch`, every such deduction on the board is
 * merged into one (the generator's fast path); otherwise the first one wins.
 */
function findSingle(cons: Constraint[], batch: boolean): Deduction | null {
  const safe: number[] = [];
  const mines: number[] = [];
  const clues: number[] = [];
  let technique: Technique | null = null;
  for (const c of cons) {
    if (c.need < 0 || c.need > c.cells.length) continue; // contradicts a wrong flag; the coach reports those
    const t: Technique | null = c.need === c.cells.length ? "single-flag" : c.need === 0 ? "single-safe" : null;
    if (!t) continue;
    (t === "single-flag" ? mines : safe).push(...c.cells);
    clues.push(c.clue);
    technique ??= t;
    if (!batch) break;
  }
  return technique ? deduction(technique, safe, mines, clues) : null;
}

/**
 * Two overlapping numbers X and Y. Y needs `Y.need` mines; at most
 * min(X.need, |shared|) of them can be in the cells it shares with X. If that
 * leaves exactly as many mines as Y has other cells, those cells are mines,
 * and when the shared cells then hold all of X's mines, X's other cells are
 * safe. Both orientations of every pair are tried, which also covers the
 * subset cases (one number's hidden cells all touching the other).
 */
function tryPair(x: Constraint, y: Constraint, inX: Uint8Array): Deduction | null {
  const onlyY: number[] = [];
  let shared = 0;
  for (const c of y.cells) {
    if (inX[c]) shared++;
    else onlyY.push(c);
  }
  if (!shared) return null;
  const maxShared = Math.min(x.need, shared);
  if (y.need - maxShared !== onlyY.length) return null;
  const onlyX = maxShared === x.need ? x.cells.filter((c) => !y.cells.includes(c)) : [];
  if (!onlyY.length && !onlyX.length) return null;
  const xSubset = shared === x.cells.length;
  const ySubset = !onlyY.length;
  let technique: Technique;
  if (xSubset || ySubset) technique = ySubset && x.need === 1 && y.need === 1 ? "1-1 pattern" : "subset";
  else technique = "1-2 pattern";
  return deduction(technique, onlyX, onlyY, [x.clue, y.clue]);
}

function findPair(cons: Constraint[], size: number): Deduction | null {
  const byCell = new Map<number, number[]>();
  cons.forEach((c, k) => {
    for (const cell of c.cells) {
      const list = byCell.get(cell);
      if (list) list.push(k);
      else byCell.set(cell, [k]);
    }
  });
  const ok = (c: Constraint) => c.need >= 0 && c.need <= c.cells.length;
  const inA = new Uint8Array(size);
  const inB = new Uint8Array(size);
  for (let a = 0; a < cons.length; a++) {
    const A = cons[a];
    if (!ok(A)) continue;
    const partners = new Set<number>();
    for (const cell of A.cells) for (const b of byCell.get(cell)!) if (b > a) partners.add(b);
    if (!partners.size) continue;
    for (const c of A.cells) inA[c] = 1;
    let found: Deduction | null = null;
    for (const b of [...partners].sort((p, q) => p - q)) {
      const B = cons[b];
      if (!ok(B)) continue;
      for (const c of B.cells) inB[c] = 1;
      found = tryPair(A, B, inA) ?? tryPair(B, A, inB);
      for (const c of B.cells) inB[c] = 0;
      if (found) break;
    }
    for (const c of A.cells) inA[c] = 0;
    if (found) return found;
  }
  return null;
}

/** One connected stretch of the frontier and what enumeration learned about it. */
interface Component {
  cells: number[];
  clues: number[];
  /** False when the component was too big or ran out of budget: nothing is known about it. */
  complete: boolean;
  /** Mine total of a valid placement -> which cells were ever a mine / ever safe in such placements. */
  byCount: Map<number, { mine: Uint8Array; safe: Uint8Array }>;
}

function components(cons: Constraint[], size: number): { comps: Constraint[][]; cells: number[][] } {
  const parent = cons.map((_, k) => k);
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k])));
  const owner = new Int32Array(size).fill(-1);
  cons.forEach((c, k) => {
    for (const cell of c.cells) {
      if (owner[cell] < 0) owner[cell] = k;
      else parent[find(k)] = find(owner[cell]);
    }
  });
  const groups = new Map<number, number[]>();
  cons.forEach((_, k) => {
    const r = find(k);
    const g = groups.get(r);
    if (g) g.push(k);
    else groups.set(r, [k]);
  });
  const comps: Constraint[][] = [];
  const cells: number[][] = [];
  for (const g of groups.values()) {
    const cs = g.map((k) => cons[k]);
    comps.push(cs);
    cells.push([...new Set(cs.flatMap((c) => c.cells))].sort((a, b) => a - b));
  }
  return { comps, cells };
}

/** Exhaustive backtracking over one component's cells, with per-number pruning. */
function enumerate(cons: Constraint[], cells: number[]): Component {
  const comp: Component = { cells, clues: cons.map((c) => c.clue), complete: false, byCount: new Map() };
  const n = cells.length;
  if (n > MAX_COMPONENT_CELLS || cons.some((c) => c.need < 0 || c.need > c.cells.length)) return comp;

  // Visit cells in breadth-first order through shared numbers so constraints close early.
  const local = new Map(cells.map((c, k) => [c, k]));
  const consOf: number[][] = cells.map(() => []);
  cons.forEach((c, k) => c.cells.forEach((cell) => consOf[local.get(cell)!].push(k)));
  const order: number[] = [];
  const seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    seen[s] = 1;
    const queue = [s];
    while (queue.length) {
      const v = queue.shift()!;
      order.push(v);
      for (const k of consOf[v]) {
        for (const cell of cons[k].cells) {
          const u = local.get(cell)!;
          if (!seen[u]) {
            seen[u] = 1;
            queue.push(u);
          }
        }
      }
    }
  }

  const mines = new Int32Array(cons.length);
  const open = new Int32Array(cons.map((c) => c.cells.length));
  const need = cons.map((c) => c.need);
  const assign = new Uint8Array(n);
  let nodes = 0;
  let aborted = false;

  const place = (v: number, mine: number): boolean => {
    let ok = true;
    for (const k of consOf[v]) {
      open[k]--;
      mines[k] += mine;
      if (mines[k] > need[k] || mines[k] + open[k] < need[k]) ok = false;
    }
    return ok;
  };
  const unplace = (v: number, mine: number) => {
    for (const k of consOf[v]) {
      open[k]++;
      mines[k] -= mine;
    }
  };
  const record = (total: number) => {
    let entry = comp.byCount.get(total);
    if (!entry) comp.byCount.set(total, (entry = { mine: new Uint8Array(n), safe: new Uint8Array(n) }));
    for (let k = 0; k < n; k++) {
      if (assign[k]) entry.mine[k] = 1;
      else entry.safe[k] = 1;
    }
  };
  const rec = (depth: number, total: number) => {
    if (aborted) return;
    if (++nodes > NODE_BUDGET) {
      aborted = true;
      return;
    }
    if (depth === n) {
      record(total);
      return;
    }
    const v = order[depth];
    for (const mine of [0, 1]) {
      assign[v] = mine;
      if (place(v, mine)) rec(depth + 1, total + mine);
      unplace(v, mine);
    }
    assign[v] = 0;
  };
  rec(0, 0);
  comp.complete = !aborted;
  if (aborted) comp.byCount.clear();
  return comp;
}

/** Cells of a complete component forced over the allowed mine totals. */
function forcedIn(comp: Component, allowed: (m: number) => boolean): { safe: number[]; mines: number[] } {
  const n = comp.cells.length;
  const everMine = new Uint8Array(n);
  const everSafe = new Uint8Array(n);
  let any = false;
  for (const [m, e] of comp.byCount) {
    if (!allowed(m)) continue;
    any = true;
    for (let k = 0; k < n; k++) {
      everMine[k] |= e.mine[k];
      everSafe[k] |= e.safe[k];
    }
  }
  const safe: number[] = [];
  const mines: number[] = [];
  if (!any) return { safe, mines };
  for (let k = 0; k < n; k++) {
    if (!everMine[k]) safe.push(comp.cells[k]);
    else if (!everSafe[k]) mines.push(comp.cells[k]);
  }
  return { safe, mines };
}

/** Sums reachable by picking one value from each list, capped at `cap`. */
function reachable(lists: number[][], cap: number): Uint8Array {
  let cur = new Uint8Array(cap + 1);
  cur[0] = 1;
  for (const list of lists) {
    const next = new Uint8Array(cap + 1);
    for (let s = 0; s <= cap; s++) {
      if (!cur[s]) continue;
      for (const m of list) if (s + m <= cap) next[s + m] = 1;
    }
    cur = next;
  }
  return cur;
}

function findEnumeration(v: View, cons: Constraint[]): { found: Deduction | null; comps: Component[] } {
  const size = v.revealed.length;
  const { comps: groups, cells } = components(cons, size);
  // Deterministic order: by each component's first cell.
  const idx = groups.map((_, k) => k).sort((a, b) => cells[a][0] - cells[b][0]);
  const comps: Component[] = [];
  for (const k of idx) {
    const comp = enumerate(groups[k], cells[k]);
    comps.push(comp);
    if (!comp.complete) continue;
    const { safe, mines } = forcedIn(comp, () => true);
    if (safe.length || mines.length) return { found: deduction("frontier enumeration", safe, mines, comp.clues), comps };
  }
  return { found: null, comps };
}

function findMineCount(v: View, comps: Component[]): Deduction | null {
  const unknown: number[] = [];
  let known = 0;
  for (let i = 0; i < v.revealed.length; i++) {
    if (v.known[i]) known++;
    else if (!v.revealed[i]) unknown.push(i);
  }
  if (!unknown.length) return null;
  const left = v.mineCount - known;
  if (left === 0) return deduction("mine count", unknown, [], []);
  if (left === unknown.length) return deduction("mine count", [], unknown, []);
  if (left < 0 || left > unknown.length) return null;

  const inFrontier = new Uint8Array(v.revealed.length);
  for (const c of comps) for (const cell of c.cells) inFrontier[cell] = 1;
  const interior = unknown.filter((i) => !inFrontier[i]);
  const I = interior.length;
  const lo = Math.max(0, left - I);
  const counts = comps.map((c) =>
    c.complete ? [...c.byCount.keys()] : Array.from({ length: c.cells.length + 1 }, (_, m) => m),
  );

  const safe: number[] = [];
  const mines: number[] = [];
  const clues: number[] = [];
  comps.forEach((comp, k) => {
    if (!comp.complete) return;
    const others = reachable(counts.filter((_, j) => j !== k), left);
    const ok = (m: number) => {
      for (let s = 0; s + m <= left; s++) if (others[s] && s + m >= lo) return true;
      return false;
    };
    const f = forcedIn(comp, ok);
    if (f.safe.length || f.mines.length) clues.push(...comp.clues);
    safe.push(...f.safe);
    mines.push(...f.mines);
  });
  if (I > 0) {
    const all = reachable(counts, left);
    let any = false;
    let allZero = true;
    let allFull = true;
    for (let s = lo; s <= left; s++) {
      if (!all[s]) continue;
      any = true;
      if (left - s !== 0) allZero = false;
      if (left - s !== I) allFull = false;
    }
    if (any && allZero) safe.push(...interior);
    else if (any && allFull) mines.push(...interior);
  }
  return safe.length || mines.length ? deduction("mine count", safe, mines, [...new Set(clues)]) : null;
}

/** The easiest deduction available in this view, or null if every hidden cell needs a guess. */
export function findDeduction(v: View, batch = false): Deduction | null {
  const cons = constraintsOf(v);
  const single = findSingle(cons, batch);
  if (single) return single;
  const pair = findPair(cons, v.revealed.length);
  if (pair) return pair;
  const { found, comps } = findEnumeration(v, cons);
  return found ?? findMineCount(v, comps);
}

/** The player's view, trusting their flags as mines (the coach checks for wrong flags first). */
export function viewOf(state: GameState): View {
  return {
    width: state.width,
    height: state.height,
    mineCount: state.mineCount,
    revealed: state.revealed,
    known: state.flagged,
    numbers: adjacentCounts(state),
  };
}

/** The next forced safe cell or mine for this game, or null if none (or the game is over). */
export function nextDeduction(state: GameState): Deduction | null {
  if (state.status !== "playing") return null;
  return findDeduction(viewOf(state));
}

export interface SolveResult {
  solved: boolean;
  /** How many deduction steps used each technique. */
  techniques: Partial<Record<Technique, number>>;
  hardest: Technique | null;
  /** Revealed cells when the solver stopped. */
  revealed: boolean[];
}

/** Plays the board from `firstClick` using deductions only, never a guess. */
export function solveLayout(layout: Layout, firstClick: number): SolveResult {
  const size = layout.mines.length;
  const revealed = new Array<boolean>(size).fill(false);
  const known = new Array<boolean>(size).fill(false);
  const result: SolveResult = { solved: false, techniques: {}, hardest: null, revealed };
  if (layout.mines[firstClick]) return result;
  floodReveal(layout, revealed, known, firstClick);
  const view: View = { ...layout, revealed, known, numbers: adjacentCounts(layout) };
  let hidden = 0;
  for (let i = 0; i < size; i++) if (!revealed[i] && !layout.mines[i]) hidden++;
  while (hidden > 0) {
    const d = findDeduction(view, true);
    if (!d) return result;
    result.techniques[d.technique] = (result.techniques[d.technique] ?? 0) + 1;
    if (!result.hardest || techniqueLevel(d.technique) > techniqueLevel(result.hardest)) result.hardest = d.technique;
    for (const m of d.mines) {
      if (!layout.mines[m]) throw new Error(`solver bug: cell ${m} deduced a mine but is safe`);
      known[m] = true;
    }
    for (const s of d.safe) {
      if (layout.mines[s]) throw new Error(`solver bug: cell ${s} deduced safe but is a mine`);
      floodReveal(layout, revealed, known, s);
    }
    hidden = 0;
    for (let i = 0; i < size; i++) if (!revealed[i] && !layout.mines[i]) hidden++;
  }
  result.solved = true;
  return result;
}

/** True if the whole board can be cleared from `firstClick` without ever guessing. */
export function solvableWithoutGuessing(layout: Layout, firstClick: number): boolean {
  return solveLayout(layout, firstClick).solved;
}
