/**
 * Spider solver: greedy best-first search over a compact numeric copy of the
 * game, with a transposition table and pruning of moves that cannot help.
 * Its winning lines are replayed through applyMove, so a "win" is always
 * verified by the real rules.
 *
 * Cards are plain numbers here (suit * 13 + rank - 1), so two cards that look
 * the same are the same to the search: with one suit, the eight spade sets
 * collapse into one and far fewer positions need visiting.
 *
 * Why best-first rather than Klondike's depth-first: a deal from the stock is
 * irreversible and every deal opens a fresh tree of rearrangements. Plain DFS
 * spends its whole budget under the first bad choice it made before a deal;
 * scoring every position and always expanding the most promising one lets
 * the search back out of a hopeless deal cheaply.
 */

import { applyMove, deal, isWon, positionKey, type Move, type State } from "./engine";
import { SUITS, type Card, type SuitCount } from "./cards";

const COLS = 10;

interface SState {
  /** Columns bottom first; the first down[i] cards are face down. */
  cols: number[][];
  down: number[];
  /** Cards already dealt from the stock; the deal order itself is shared by all positions. */
  dealt: number;
  /** Runs completed. */
  found: number;
}

const suitOf = (c: number) => (c / 13) | 0;
const rankOf = (c: number) => (c % 13) + 1;
/** c sits on `onto` as part of a same-suit run. */
const follows = (c: number, onto: number) => onto === c + 1 && c % 13 !== 12;
const stacks = (c: number, onto: number) => rankOf(onto) === rankOf(c) + 1;

function fromState(state: State): { s: SState; stock: number[] } {
  const value = (c: Card) => SUITS.indexOf(c.suit) * 13 + c.rank - 1;
  return {
    s: {
      cols: state.tableau.map((c) => [...c.down, ...c.up].map(value)),
      down: state.tableau.map((c) => c.down.length),
      dealt: 0,
      found: state.foundations.length,
    },
    // Deal order: the engine pops the stock, so the last element goes first.
    stock: state.stock.slice().reverse().map(value),
  };
}

/** Frontier positions are kept packed (one byte per card) to keep memory down. */
function pack(s: SState): Uint8Array {
  const total = s.cols.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(2 + 2 * COLS + total);
  out[0] = s.dealt;
  out[1] = s.found;
  let p = 2 + 2 * COLS;
  for (let i = 0; i < COLS; i++) {
    out[2 + i] = s.down[i];
    out[2 + COLS + i] = s.cols[i].length;
    out.set(s.cols[i], p);
    p += s.cols[i].length;
  }
  return out;
}

function unpack(b: Uint8Array): SState {
  const cols: number[][] = [];
  const down: number[] = [];
  let p = 2 + 2 * COLS;
  for (let i = 0; i < COLS; i++) {
    down.push(b[2 + i]);
    const len = b[2 + COLS + i];
    const col = new Array<number>(len);
    for (let k = 0; k < len; k++) col[k] = b[p++];
    cols.push(col);
  }
  return { cols, down, dealt: b[0], found: b[1] };
}

function copy(s: SState): SState {
  return { cols: s.cols.map((c) => c.slice()), down: s.down.slice(), dealt: s.dealt, found: s.found };
}

/** Length of the same-suit run on top of a column (face-up cards only). */
function runLength(s: SState, i: number): number {
  const col = s.cols[i];
  const n = col.length;
  if (n <= s.down[i]) return 0;
  let k = 1;
  while (n - k - 1 >= s.down[i] && follows(col[n - k], col[n - k - 1])) k++;
  return k;
}

/** Mirrors the engine's automatic turn-over of an exposed face-down card. */
function fixDown(s: SState, i: number): void {
  if (s.down[i] > 0 && s.down[i] >= s.cols[i].length) s.down[i] = s.cols[i].length - 1;
}

/** Mirrors the engine's automatic removal of complete K-to-A runs. */
function collect(s: SState, i: number): void {
  const col = s.cols[i];
  while (col.length >= 13 && rankOf(col[col.length - 1]) === 1 && runLength(s, i) >= 13) {
    col.length -= 13;
    s.found++;
    fixDown(s, i);
  }
}

/** Internal move: -1 is a deal, otherwise from | to << 4 | count << 8. */
type SMove = number;
const DEAL = -1;
const enc = (from: number, to: number, count: number): SMove => from | (to << 4) | (count << 8);

/** Mutates s; the move must be legal. */
function play(s: SState, m: SMove, stock: number[]): void {
  if (m === DEAL) {
    for (let i = 0; i < COLS && s.dealt < stock.length; i++) s.cols[i].push(stock[s.dealt++]);
    for (let i = 0; i < COLS; i++) collect(s, i);
    return;
  }
  const from = m & 15;
  const to = (m >> 4) & 15;
  const count = m >> 8;
  const src = s.cols[from];
  s.cols[to].push(...src.splice(src.length - count));
  fixDown(s, from);
  collect(s, to);
}

/**
 * Search settings per suit count, tuned on a few hundred random deals.
 * `dealt` is what each dealt card is worth: with one or two suits a small
 * pull towards the next deal wins more often, while with four suits the
 * search must tidy up as much as it can before every deal, so dealing costs.
 * `lateral` allows moving a run off one off-suit card onto another, which
 * helps with fewer suits but with four only widens the search.
 */
interface Profile {
  dealt: number;
  lateral: boolean;
}

const PROFILES: Record<SuitCount, Profile> = {
  1: { dealt: 3, lateral: true },
  2: { dealt: 3, lateral: true },
  4: { dealt: -5, lateral: false },
};

/**
 * Candidate moves. Left out, because they never help: splitting a same-suit
 * run onto a card of another suit, splitting a run into an empty column,
 * moving a whole column into an empty column, and all but the first empty
 * column as a destination (empty columns are interchangeable).
 */
function candidates(s: SState, stock: number[], profile: Profile): SMove[] {
  const out: SMove[] = [];
  const firstEmpty = s.cols.findIndex((c) => c.length === 0);
  for (let i = 0; i < COLS; i++) {
    const col = s.cols[i];
    const n = col.length;
    if (n === 0) continue;
    const run = runLength(s, i);
    if (run === 0) continue;
    const topRank = rankOf(col[n - 1]);
    for (let j = 0; j < COLS; j++) {
      if (j === i) continue;
      const target = s.cols[j];
      if (target.length === 0) {
        if (j === firstEmpty && run < n) out.push(enc(i, j, run));
        continue;
      }
      if (target.length <= s.down[j]) continue; // only face-down cards (hand-made positions)
      const onto = target[target.length - 1];
      const k = rankOf(onto) - topRank;
      if (k < 1 || k > run) continue;
      const base = col[n - k];
      if (suitOf(onto) !== suitOf(base)) {
        if (k < run) continue;
        const under = n - k - 1;
        if (!profile.lateral && under >= s.down[i] && stacks(base, col[under])) continue;
      }
      out.push(enc(i, j, k));
    }
  }
  if (firstEmpty < 0 && s.dealt < stock.length) out.push(DEAL);
  return out;
}

/**
 * How promising a position looks. Completed runs dominate; then turning
 * cards face up, keeping suits together and holding empty columns.
 */
function score(s: SState, profile: Profile): number {
  let h = s.found * 400 + s.dealt * profile.dealt;
  for (let i = 0; i < COLS; i++) {
    const col = s.cols[i];
    const d = s.down[i];
    if (col.length === 0) {
      h += 25;
      continue;
    }
    h -= d * 12;
    if (d === 0) h += 6;
    for (let k = d + 1; k < col.length; k++) {
      if (follows(col[k], col[k - 1])) h += 12;
      else if (stacks(col[k], col[k - 1])) h += 1;
      else h -= 4;
    }
  }
  return h;
}

/** 53-bit position hash; column order matters because deals go column by column. */
function hashOf(s: SState): number {
  let a = 0x811c9dc5 ^ s.dealt;
  let b = 0x2545f491 ^ (s.dealt * 131);
  const mix = (v: number) => {
    a = Math.imul(a ^ v, 0x01000193);
    b = Math.imul(b ^ v, 0x5bd1e995);
    b ^= b >>> 15;
  };
  for (let i = 0; i < COLS; i++) {
    mix(200 + s.down[i]);
    for (const c of s.cols[i]) mix(c + 1);
  }
  return (a >>> 0) * 2097152 + (b >>> 11);
}

/** Binary max-heap of node indices ordered by priority; ties go to the newest node. */
class Heap {
  private items: number[] = [];
  constructor(private prio: Float64Array | number[]) {}
  get size() {
    return this.items.length;
  }
  private better(x: number, y: number) {
    const px = this.prio[x];
    const py = this.prio[y];
    return px > py || (px === py && x > y);
  }
  push(node: number) {
    const a = this.items;
    a.push(node);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.better(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const best = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.better(a[l], a[m])) m = l;
        if (r < a.length && this.better(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return best;
  }
}

export interface SolveResult {
  /** "lose" means the search ran out of moves (under its pruning rules) within budget. */
  result: "win" | "unknown" | "lose";
  /** Engine moves from the given state to a won state. */
  moves: Move[];
  /** Positions expanded. */
  nodes: number;
}

export function solve(state: State, opts: { maxNodes?: number } = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 100_000;
  if (isWon(state)) return { result: "win", moves: [], nodes: 0 };
  const { s: root, stock } = fromState(state);
  const profile = PROFILES[state.suits] ?? PROFILES[4];
  const target = root.found + (root.cols.reduce((n, c) => n + c.length, 0) + stock.length) / 13;

  // Node tables: parent and move for path rebuilding, priority for the heap,
  // and the position itself only while the node waits in the frontier.
  const parent: number[] = [-1];
  const via: SMove[] = [0];
  const prio: number[] = [score(root, profile)];
  const waiting = new Map<number, Uint8Array>([[0, pack(root)]]);
  const seen = new Set<number>([hashOf(root)]);
  const heap = new Heap(prio);
  heap.push(0);
  let nodes = 0;

  while (heap.size > 0) {
    if (nodes >= maxNodes) return { result: "unknown", moves: [], nodes };
    const id = heap.pop();
    const s = unpack(waiting.get(id)!);
    waiting.delete(id);
    nodes++;
    for (const m of candidates(s, stock, profile)) {
      const child = copy(s);
      play(child, m, stock);
      const key = hashOf(child);
      if (seen.has(key)) continue;
      seen.add(key);
      const cid = parent.length;
      parent.push(id);
      via.push(m);
      if (child.found >= target) return { result: "win", moves: toEngineMoves(state, parent, via, cid), nodes };
      prio.push(score(child, profile));
      waiting.set(cid, pack(child));
      heap.push(cid);
    }
  }
  return { result: "lose", moves: [], nodes };
}

/** Rebuilds the line ending at `leaf` and checks every step with applyMove. */
function toEngineMoves(start: State, parent: number[], via: SMove[], leaf: number): Move[] {
  const path: SMove[] = [];
  for (let n = leaf; n > 0; n = parent[n]) path.push(via[n]);
  path.reverse();
  const moves: Move[] = path.map((m) =>
    m === DEAL ? { kind: "deal" } : { kind: "move", from: m & 15, to: (m >> 4) & 15, count: m >> 8 },
  );
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
 * Search budget per candidate deal, by suit count. Measured in Node on an
 * M-series laptop over 30 consecutive dates (12 for four suits):
 *
 * - 1 suit: about 3 in 4 deals solve within 20k positions; a daily deal
 *   takes ~60 ms on average, ~250 ms at worst.
 * - 2 suits: about 2 in 3 deals solve within 60k positions; ~0.4 s on
 *   average, ~2 s at worst.
 * - 4 suits: only about 1 in 3 deals solve within 300k positions, each
 *   failed try costs ~1.5 s, and a search holds a few hundred MB. A daily
 *   deal takes ~5 s on average and up to ~15-25 s. That is fine for a build
 *   step or a cron job that ships the solution (see rememberWinningLine),
 *   but too slow and too memory-hungry to run in the browser.
 *
 * Deals the solver gives up on are not necessarily unwinnable; they are
 * just skipped, so every daily deal still comes with a verified solution.
 */
export const DAILY_BUDGET: Record<SuitCount, number> = { 1: 20_000, 2: 60_000, 4: 300_000 };

/**
 * The daily deal: the first seed `spider:${date}:${suits}:${n}` the solver
 * can win, so "every daily deal is winnable" is backed by an actual solution.
 */
/** Longest winning line a daily deal may have (it is sent to the browser). */
export const MAX_DAILY_LINE = 3000;

export function dailyDeal(
  date: string,
  suits: SuitCount = 1,
  opts: { maxNodes?: number; maxTries?: number; maxLine?: number } = {},
): { seed: string; state: State; solution: Move[] } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`dailyDeal: bad date ${date}`);
  const maxNodes = opts.maxNodes ?? DAILY_BUDGET[suits];
  const maxTries = opts.maxTries ?? 200;
  // The winning line ships with the page for the coach: skip the rare deal
  // whose line the greedy search makes absurdly long (one 4-suit deal: 30k moves).
  const maxLine = opts.maxLine ?? MAX_DAILY_LINE;
  for (let n = 0; n < maxTries; n++) {
    const seed = `spider:${date}:${suits}:${n}`;
    const state = deal(seed, suits);
    const { result, moves } = solve(state, { maxNodes });
    if (result === "win" && moves.length <= maxLine) return { seed, state, solution: moves };
  }
  throw new Error(`dailyDeal: no winnable ${suits}-suit deal found for ${date}`);
}
