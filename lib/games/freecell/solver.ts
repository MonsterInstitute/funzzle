/**
 * FreeCell solver: best-first search over a compact numeric copy of the game,
 * guided by a heuristic that counts the cards still to go home and the cards
 * buried above lower ones, with a transposition table and safe auto-moves.
 * Its winning lines are converted back into ordinary engine moves (single
 * cards and supermoves) and replayed through applyMove, so a "win" is always
 * verified.
 */

import {
  CELLS,
  COLUMNS,
  applyMove,
  deal,
  isWon,
  positionKey,
  type Move,
  type State,
} from "./engine";

/** Internal move; card ids, cells and column indices are plain numbers. */
type SMove =
  | { t: "tc"; from: number; cell: number }
  | { t: "tf"; from: number }
  | { t: "tt"; from: number; to: number; count: number }
  | { t: "cf"; cell: number }
  | { t: "ct"; cell: number; to: number };

interface SState {
  /** Columns bottom first, as card ids. */
  cols: number[][];
  /** Card id per free cell, -1 when empty. */
  cells: number[];
  /** Top rank on each foundation (0 = empty). */
  found: number[];
}

const suitOf = (c: number) => (c / 13) | 0;
const rankOf = (c: number) => (c % 13) + 1;
const redOf = (c: number) => {
  const s = suitOf(c);
  return s === 1 || s === 2;
};
const stacks = (c: number, onto: number) => rankOf(onto) === rankOf(c) + 1 && redOf(onto) !== redOf(c);
const canHome = (s: SState, c: number) => s.found[suitOf(c)] === rankOf(c) - 1;

function fromState(state: State): SState {
  return {
    cols: state.tableau.map((col) => col.map((x) => x.id)),
    cells: state.cells.map((x) => (x ? x.id : -1)),
    found: state.foundations.map((f) => f.length),
  };
}

function copy(s: SState): SState {
  return { cols: s.cols.map((c) => c.slice()), cells: s.cells.slice(), found: s.found.slice() };
}

/** Same rule as the engine's isSafeHome. */
function isSafe(s: SState, c: number): boolean {
  if (!canHome(s, c)) return false;
  const r = rankOf(c);
  if (r <= 2) return true;
  const [a, b] = redOf(c) ? [0, 3] : [1, 2];
  return s.found[a] >= r - 1 && s.found[b] >= r - 1;
}

function runLen(col: number[]): number {
  if (col.length === 0) return 0;
  let n = 1;
  while (n < col.length && stacks(col[col.length - n], col[col.length - n - 1])) n++;
  return n;
}

function capacity(s: SState, toEmpty: boolean): number {
  let free = 0;
  for (const c of s.cells) if (c < 0) free++;
  let empty = 0;
  for (const col of s.cols) if (col.length === 0) empty++;
  if (toEmpty) empty--;
  return (free + 1) * 2 ** Math.max(0, empty);
}

/** Mutates s; the move must be legal. */
function play(s: SState, m: SMove): void {
  switch (m.t) {
    case "tc":
      s.cells[m.cell] = s.cols[m.from].pop()!;
      break;
    case "tf":
      s.found[suitOf(s.cols[m.from].pop()!)]++;
      break;
    case "cf":
      s.found[suitOf(s.cells[m.cell])]++;
      s.cells[m.cell] = -1;
      break;
    case "ct":
      s.cols[m.to].push(s.cells[m.cell]);
      s.cells[m.cell] = -1;
      break;
    case "tt": {
      const col = s.cols[m.from];
      s.cols[m.to].push(...col.splice(col.length - m.count));
      break;
    }
  }
}

/** Plays safe foundation moves until none remain, in the engine's autoMoves order. */
function autoPlay(s: SState, out: SMove[]): void {
  for (let changed = true; changed; ) {
    changed = false;
    for (let cell = 0; cell < CELLS; cell++) {
      const c = s.cells[cell];
      if (c >= 0 && isSafe(s, c)) {
        const m: SMove = { t: "cf", cell };
        play(s, m);
        out.push(m);
        changed = true;
      }
    }
    for (let from = 0; from < COLUMNS; from++) {
      const col = s.cols[from];
      if (col.length > 0 && isSafe(s, col[col.length - 1])) {
        const m: SMove = { t: "tf", from };
        play(s, m);
        out.push(m);
        changed = true;
      }
    }
  }
}

const won = (s: SState) => s.found[0] + s.found[1] + s.found[2] + s.found[3] === 52;

/**
 * Every move worth searching. Moves into empty cells or columns only use the
 * first one (the others give the same position), and a whole column is never
 * moved into an empty one.
 */
function candidates(s: SState): SMove[] {
  const out: SMove[] = [];
  const firstCell = s.cells.indexOf(-1);
  const firstEmpty = s.cols.findIndex((c) => c.length === 0);
  const capFull = capacity(s, false);
  const capEmpty = capacity(s, true);

  for (let cell = 0; cell < CELLS; cell++) {
    const c = s.cells[cell];
    if (c < 0) continue;
    if (canHome(s, c)) out.push({ t: "cf", cell });
    for (let to = 0; to < COLUMNS; to++) {
      const target = s.cols[to];
      if (target.length === 0 ? to === firstEmpty : stacks(c, target[target.length - 1])) {
        out.push({ t: "ct", cell, to });
      }
    }
  }

  for (let from = 0; from < COLUMNS; from++) {
    const col = s.cols[from];
    const n = col.length;
    if (n === 0) continue;
    const topCard = col[n - 1];
    if (canHome(s, topCard)) out.push({ t: "tf", from });
    const run = runLen(col);
    for (let to = 0; to < COLUMNS; to++) {
      if (to === from) continue;
      const target = s.cols[to];
      if (target.length > 0) {
        const count = rankOf(target[target.length - 1]) - rankOf(topCard);
        if (count >= 1 && count <= run && count <= capFull && stacks(col[n - count], target[target.length - 1])) {
          out.push({ t: "tt", from, to, count });
        }
      } else if (to === firstEmpty) {
        for (let count = Math.min(run, capEmpty, n - 1); count >= 1; count--) {
          out.push({ t: "tt", from, to, count });
        }
      }
    }
    if (firstCell >= 0) out.push({ t: "tc", from, cell: firstCell });
  }
  return out;
}

/**
 * Estimated distance to a win; lower is better. Cards still out count once,
 * cards sitting above a lower card of their column count extra (each must
 * move before that lower card can go home), and occupied cells and missing
 * empty columns count as lost mobility.
 */
function heuristic(s: SState): number {
  let out = 52 - (s.found[0] + s.found[1] + s.found[2] + s.found[3]);
  let blocked = 0;
  let empty = 0;
  for (const col of s.cols) {
    if (col.length === 0) {
      empty++;
      continue;
    }
    let low = 99;
    for (let i = 0; i < col.length; i++) {
      const r = rankOf(col[i]);
      if (r > low) blocked++;
      // Cards resting in order on the card below are cheap to move as a run.
      else if (i > 0 && stacks(col[i], col[i - 1])) out -= 0.5;
      if (r < low) low = r;
    }
  }
  let used = 0;
  for (const c of s.cells) if (c >= 0) used++;
  return out + 1.5 * blocked + used - 1.5 * empty;
}

/** 53-bit position hash; columns and cells are sorted so their order does not matter. */
function hashOf(s: SState): number {
  const cols: [number, number][] = [];
  for (const col of s.cols) {
    let a = 0x811c9dc5;
    let b = 0x9747b28c;
    for (const c of col) {
      a = Math.imul(a ^ (c + 1), 0x01000193);
      b = Math.imul(b ^ (c + 7), 0x5bd1e995);
      b ^= b >>> 13;
    }
    cols.push([a >>> 0, b >>> 0]);
  }
  cols.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let a = 0x811c9dc5;
  let b = 0x2545f491;
  const mix = (v: number) => {
    a = Math.imul(a ^ v, 0x01000193);
    b = Math.imul(b ^ v, 0x5bd1e995);
    b ^= b >>> 15;
  };
  for (const [x, y] of cols) {
    mix(x);
    mix(y);
  }
  // Foundations follow from where every other card is, so they are left out.
  const cells = s.cells.slice().sort((x, y) => x - y);
  for (const c of cells) mix(c + 101);
  return (a >>> 0) * 2097152 + (b >>> 11);
}

/** Binary min-heap of node indices keyed by score; ties go to the newest node. */
class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, key: number): void {
    const { items, keys } = this;
    let i = items.length;
    items.push(item);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const { items, keys } = this;
    const head = items[0];
    const lastItem = items.pop()!;
    const lastKey = keys.pop()!;
    if (items.length > 0) {
      items[0] = lastItem;
      keys[0] = lastKey;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && this.less(l, m)) m = l;
        if (r < items.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return head;
  }
  private less(i: number, j: number): boolean {
    return this.keys[i] < this.keys[j] || (this.keys[i] === this.keys[j] && this.items[i] > this.items[j]);
  }
  private swap(i: number, j: number): void {
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    [this.keys[i], this.keys[j]] = [this.keys[j], this.keys[i]];
  }
}

export interface SolveResult {
  /** "lose" means every reachable position was searched without a win. */
  result: "win" | "unknown" | "lose";
  /** Engine moves from the given state to a won state, including auto-moves. */
  moves: Move[];
  /** Positions expanded. */
  nodes: number;
}

/**
 * Weight of moves already made against the estimate. Tuned on random deals:
 * lower is greedier and wanders into long detours, higher spends the budget
 * hunting for short lines.
 */
const G_WEIGHT = 1;

export function solve(state: State, opts: { maxNodes?: number } = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 100_000;
  if (isWon(state)) return { result: "win", moves: [], nodes: 0 };

  // Search tree: each node keeps its parent, the moves that led to it and,
  // until it is expanded, its position.
  const parent: number[] = [];
  const steps: SMove[][] = [];
  const states: (SState | null)[] = [];
  const depth: number[] = [];
  const visited = new Set<number>();
  const open = new Heap();

  const add = (s: SState, from: number, path: SMove[]): number => {
    const id = states.length;
    parent.push(from);
    steps.push(path);
    states.push(s);
    depth.push(from < 0 ? 0 : depth[from] + 1);
    return id;
  };

  const root = fromState(state);
  const rootPath: SMove[] = [];
  autoPlay(root, rootPath);
  visited.add(hashOf(root));
  let goal = won(root) ? add(root, -1, rootPath) : -1;
  if (goal < 0) open.push(add(root, -1, rootPath), 0);

  let nodes = 0;
  while (goal < 0 && open.size > 0) {
    if (nodes >= maxNodes) return { result: "unknown", moves: [], nodes };
    const id = open.pop();
    const s = states[id]!;
    states[id] = null;
    nodes++;
    for (const m of candidates(s)) {
      const child = copy(s);
      play(child, m);
      const path = [m];
      autoPlay(child, path);
      const key = hashOf(child);
      if (visited.has(key)) continue;
      visited.add(key);
      const cid = add(child, id, path);
      if (won(child)) {
        goal = cid;
        break;
      }
      open.push(cid, heuristic(child) + G_WEIGHT * depth[cid]);
    }
  }
  if (goal < 0) return { result: "lose", moves: [], nodes };

  const chain: SMove[][] = [];
  for (let id = goal; id >= 0; id = parent[id]) chain.push(steps[id]);
  return { result: "win", moves: toEngineMoves(state, chain.reverse().flat()), nodes };
}

/** Converts solver moves to engine moves and checks every step with applyMove. */
function toEngineMoves(start: State, path: SMove[]): Move[] {
  const moves: Move[] = path.map((m): Move => {
    switch (m.t) {
      case "tc":
        return { kind: "tableau-to-cell", from: m.from, cell: m.cell };
      case "tf":
        return { kind: "tableau-to-foundation", from: m.from };
      case "cf":
        return { kind: "cell-to-foundation", cell: m.cell };
      case "ct":
        return { kind: "cell-to-tableau", cell: m.cell, to: m.to };
      case "tt":
        return { kind: "tableau-to-tableau", from: m.from, to: m.to, count: m.count };
    }
  });
  let state = start;
  for (const m of moves) state = applyMove(state, m);
  if (!isWon(state)) throw new Error("solver: winning line did not win");
  rememberLine(start, moves);
  return moves;
}

/**
 * Winning lines found recently, keyed by position, so the coach can follow a
 * line move by move without searching again. Bounded to keep memory flat.
 */
const lines = new Map<string, Move[]>();
const MAX_LINES = 5000;

function rememberLine(start: State, moves: Move[]): void {
  let state = start;
  for (let i = 0; i < moves.length; i++) {
    const key = positionKey(state);
    lines.delete(key);
    lines.set(key, moves.slice(i));
    state = applyMove(state, moves[i]);
  }
  while (lines.size > MAX_LINES) lines.delete(lines.keys().next().value!);
}

/**
 * Teach the coach a winning line found elsewhere, e.g. the daily deal's
 * solution computed on the server, so the browser's first hints need no
 * search. The line is replayed (applyMove throws on an illegal move), so a
 * stale or wrong line is rejected rather than coached.
 */
export function rememberWinningLine(start: State, moves: Move[]): boolean {
  try {
    let state = start;
    for (const m of moves) state = applyMove(state, m);
    if (!isWon(state)) return false;
  } catch {
    return false;
  }
  rememberLine(start, moves);
  return true;
}

/** A known winning line from exactly this position, if one was found earlier. */
export function knownLine(state: State): Move[] | undefined {
  return lines.get(positionKey(state));
}

/** Clears the remembered winning lines (for tests). */
export function clearKnownLines(): void {
  lines.clear();
}

/**
 * The daily deal: the first seed `freecell:${date}:${n}` the solver can win,
 * so "every daily deal is winnable" is backed by an actual solution.
 */
export function dailyDeal(
  date: string,
  opts: { maxNodes?: number } = {},
): { seed: string; state: State; solution: Move[] } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`dailyDeal: bad date ${date}`);
  for (let n = 0; n < 500; n++) {
    const seed = `freecell:${date}:${n}`;
    const state = deal(seed);
    const { result, moves } = solve(state, opts);
    if (result === "win") return { seed, state, solution: moves };
  }
  throw new Error(`dailyDeal: no winnable deal found for ${date}`);
}
