/**
 * Klondike solver: depth-first search over a compact numeric copy of the
 * game, with a transposition table, safe auto-moves and pruning of moves that
 * cannot help. Its winning lines are converted back into ordinary engine
 * moves and replayed through applyMove, so a "win" is always verified.
 *
 * The stock and waste are modelled as one "talon" sequence plus a pointer:
 * instead of searching individual draws, a move plays any talon card that
 * draws and recycles could bring to the top. With draw 1 every talon card is
 * reachable, so the pointer is left out of the hash; with draw 3 only every
 * third position is, and the pointer is part of the position.
 */

import { CARDS } from "./cards";
import { applyMove, deal, isWon, positionKey, type Move, type State } from "./engine";

/** Internal move; card ids and column indices are plain numbers. */
type SMove =
  | { t: "tf"; from: number }
  | { t: "wf"; card: number }
  | { t: "wt"; card: number; to: number }
  | { t: "tt"; from: number; to: number; count: number }
  | { t: "ft"; suit: number; to: number };

interface SState {
  /** Columns bottom first; the first down[i] cards are face down. */
  cols: number[][];
  down: number[];
  /** Top rank on each foundation (0 = empty). */
  found: number[];
  /** Waste bottom-first followed by the stock in draw order. */
  talon: number[];
  /** talon[0..p) is the waste, so talon[p - 1] is the playable card. */
  p: number;
  draw: 1 | 3;
}

const suitOf = (c: number) => (c / 13) | 0;
const rankOf = (c: number) => (c % 13) + 1;
const redOf = (c: number) => {
  const s = suitOf(c);
  return s === 1 || s === 2;
};
const stacks = (c: number, onto: number) => rankOf(onto) === rankOf(c) + 1 && redOf(onto) !== redOf(c);

function fromState(state: State): SState {
  return {
    cols: state.tableau.map((c) => [...c.down, ...c.up].map((x) => x.id)),
    down: state.tableau.map((c) => c.down.length),
    found: state.foundations.map((f) => f.length),
    talon: [...state.waste, ...state.stock.slice().reverse()].map((x) => x.id),
    p: state.waste.length,
    draw: state.draw,
  };
}

function copy(s: SState): SState {
  return {
    cols: s.cols.map((c) => c.slice()),
    down: s.down.slice(),
    found: s.found.slice(),
    talon: s.talon.slice(),
    p: s.p,
    draw: s.draw,
  };
}

/** Talon positions (1-based: card talon[pos-1]) that draws and recycles can expose. */
function reachable(s: SState): number[] {
  const len = s.talon.length;
  if (len === 0) return [];
  if (s.draw === 1) return Array.from({ length: len }, (_, i) => i + 1);
  const seen = new Set<number>();
  if (s.p > 0) seen.add(s.p);
  for (let q = s.p; q < len; ) {
    q = Math.min(q + 3, len);
    seen.add(q);
  }
  for (let q = 0; q < len; ) {
    q = Math.min(q + 3, len);
    seen.add(q);
  }
  return [...seen];
}

const canHome = (s: SState, c: number) => s.found[suitOf(c)] === rankOf(c) - 1;

/**
 * A card is safe to send home when nothing could ever need to be stacked on
 * it: aces and twos always, otherwise once both opposite-colour cards one
 * rank lower are home.
 */
function isSafe(s: SState, c: number): boolean {
  if (!canHome(s, c)) return false;
  const r = rankOf(c);
  if (r <= 2) return true;
  const [a, b] = redOf(c) ? [0, 3] : [1, 2];
  return s.found[a] >= r - 1 && s.found[b] >= r - 1;
}

function removeTalon(s: SState, pos: number): number {
  const [card] = s.talon.splice(pos - 1, 1);
  s.p = pos - 1;
  return card;
}

/** Mutates s; the move must be legal. */
function play(s: SState, m: SMove): void {
  switch (m.t) {
    case "tf": {
      const card = s.cols[m.from].pop()!;
      s.found[suitOf(card)]++;
      fixDown(s, m.from);
      break;
    }
    case "wf": {
      const card = removeTalon(s, s.talon.indexOf(m.card) + 1);
      s.found[suitOf(card)]++;
      break;
    }
    case "wt":
      s.cols[m.to].push(removeTalon(s, s.talon.indexOf(m.card) + 1));
      break;
    case "tt": {
      const col = s.cols[m.from];
      s.cols[m.to].push(...col.splice(col.length - m.count));
      fixDown(s, m.from);
      break;
    }
    case "ft":
      s.cols[m.to].push(m.suit * 13 + s.found[m.suit] - 1);
      s.found[m.suit]--;
      break;
  }
}

/** Mirrors the engine's automatic turn-over of an exposed face-down card. */
function fixDown(s: SState, i: number): void {
  if (s.down[i] > 0 && s.down[i] >= s.cols[i].length) s.down[i] = s.cols[i].length - 1;
}

/** Plays safe foundation moves until none remain, recording them. */
function autoPlay(s: SState, out: SMove[]): void {
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < 7; i++) {
      const col = s.cols[i];
      if (col.length > 0 && isSafe(s, col[col.length - 1])) {
        const m: SMove = { t: "tf", from: i };
        play(s, m);
        out.push(m);
        changed = true;
      }
    }
    // Draw 1 can reach any talon card; draw 3 only takes the card already on top,
    // which leaves the next draws unchanged.
    const positions = s.draw === 1 ? reachable(s) : s.p > 0 ? [s.p] : [];
    for (const pos of positions) {
      const card = s.talon[pos - 1];
      if (isSafe(s, card)) {
        const m: SMove = { t: "wf", card };
        play(s, m);
        out.push(m);
        changed = true;
        break;
      }
    }
  }
}

/** With nothing hidden and an empty talon the game is won; send everything home. */
function finishable(s: SState): boolean {
  return s.talon.length === 0 && s.down.every((d) => d === 0);
}

/** False only for hand-made positions that are missing cards. */
function finish(s: SState, out: SMove[]): boolean {
  while (s.found.some((f) => f < 13)) {
    let best = -1;
    for (let i = 0; i < 7; i++) {
      const col = s.cols[i];
      if (col.length && canHome(s, col[col.length - 1])) {
        if (best < 0 || rankOf(col[col.length - 1]) < rankOf(s.cols[best][s.cols[best].length - 1])) best = i;
      }
    }
    if (best < 0) return false;
    const m: SMove = { t: "tf", from: best };
    play(s, m);
    out.push(m);
  }
  return true;
}

interface Scored {
  m: SMove;
  prio: number;
}

/** Candidate moves, best first. Moves that cannot help are left out. */
function candidates(s: SState): Scored[] {
  const out: Scored[] = [];
  const positions = reachable(s);
  const talonCards = positions.map((pos) => s.talon[pos - 1]);
  const firstEmpty = s.cols.findIndex((c) => c.length === 0);

  // Cards that could use a new spot: talon cards and bases of runs whose move would reveal.
  const wanted = (onto: number, except: number) => {
    if (talonCards.some((c) => stacks(c, onto))) return true;
    for (let j = 0; j < 7; j++) {
      if (j === except || s.down[j] === 0 || s.cols[j].length <= s.down[j]) continue;
      if (stacks(s.cols[j][s.down[j]], onto)) return true;
    }
    return false;
  };
  const kingWaiting =
    talonCards.some((c) => rankOf(c) === 13) ||
    s.cols.some((c, j) => s.down[j] > 0 && c.length > s.down[j] && rankOf(c[s.down[j]]) === 13);

  for (let i = 0; i < 7; i++) {
    const col = s.cols[i];
    const n = col.length;
    if (n === 0) continue;
    const d = s.down[i];
    if (canHome(s, col[n - 1])) {
      out.push({ m: { t: "tf", from: i }, prio: n - 1 === d && d > 0 ? 100 + d : 50 });
    }
    for (let k = d; k < n; k++) {
      const base = col[k];
      const whole = k === d;
      const reveals = whole && d > 0;
      if (!reveals) {
        if (whole) {
          // Emptying a column only matters if a King is waiting for it.
          if (rankOf(base) === 13 || !kingWaiting) continue;
        } else {
          const exposed = col[k - 1];
          if (!canHome(s, exposed) && !wanted(exposed, i)) continue;
        }
      }
      for (let j = 0; j < 7; j++) {
        if (j === i) continue;
        const target = s.cols[j];
        if (target.length === 0) {
          if (rankOf(base) !== 13 || !reveals || j !== firstEmpty) continue;
          out.push({ m: { t: "tt", from: i, to: j, count: n - k }, prio: 80 + d });
        } else if (stacks(base, target[target.length - 1])) {
          const prio = reveals ? 90 + d : whole ? 40 : canHome(s, col[k - 1]) ? 55 : 20;
          out.push({ m: { t: "tt", from: i, to: j, count: n - k }, prio });
        }
      }
    }
  }

  for (const card of talonCards) {
    if (canHome(s, card)) out.push({ m: { t: "wf", card }, prio: 45 });
    for (let j = 0; j < 7; j++) {
      const target = s.cols[j];
      if (target.length === 0) {
        if (rankOf(card) === 13 && j === firstEmpty) out.push({ m: { t: "wt", card, to: j }, prio: 30 });
      } else if (stacks(card, target[target.length - 1])) {
        out.push({ m: { t: "wt", card, to: j }, prio: 35 });
      }
    }
  }

  for (let suit = 0; suit < 4; suit++) {
    const r = s.found[suit];
    if (r < 3) continue;
    const card = suit * 13 + r - 1;
    // A safe card would be sent straight back; otherwise only worth it if something can go on it.
    const probe = copy(s);
    probe.found[suit]--;
    if (isSafe(probe, card) || !wanted(card, -1)) continue;
    for (let j = 0; j < 7; j++) {
      const target = s.cols[j];
      if (target.length > 0 && stacks(card, target[target.length - 1])) {
        out.push({ m: { t: "ft", suit, to: j }, prio: 5 });
      }
    }
  }

  return out.sort((a, b) => b.prio - a.prio);
}

/** 53-bit position hash; columns are sorted so their order does not matter. */
function hashOf(s: SState): number {
  const cols: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    let a = 0x811c9dc5 ^ s.down[i];
    let b = 0x9747b28c ^ (s.down[i] * 31);
    for (const c of s.cols[i]) {
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
  for (const c of s.talon) mix(c + 101);
  if (s.draw === 3) mix(1000 + s.p);
  return (a >>> 0) * 2097152 + (b >>> 11);
}

export interface SolveResult {
  /** "lose" means the search ran out of moves (under its pruning rules) within budget. */
  result: "win" | "unknown" | "lose";
  /** Engine moves from the given state to a won state, including draws, recycles and auto-moves. */
  moves: Move[];
  nodes: number;
}

const MAX_DEPTH = 1500;

export function solve(state: State, opts: { maxNodes?: number } = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 200_000;
  if (isWon(state)) return { result: "win", moves: [], nodes: 0 };
  const visited = new Set<number>();
  const path: SMove[] = [];
  let nodes = 0;
  let aborted = false;

  const root = fromState(state);
  autoPlay(root, path);

  const search = (s: SState, depth: number): boolean => {
    if (finishable(s)) {
      const mark = path.length;
      if (finish(copy(s), path)) return true;
      path.length = mark;
      return false;
    }
    if (nodes >= maxNodes || depth > MAX_DEPTH) {
      aborted = true;
      return false;
    }
    const key = hashOf(s);
    if (visited.has(key)) return false;
    visited.add(key);
    nodes++;
    for (const { m } of candidates(s)) {
      const mark = path.length;
      const child = copy(s);
      play(child, m);
      path.push(m);
      autoPlay(child, path);
      if (search(child, depth + 1)) return true;
      path.length = mark;
      if (aborted) return false;
    }
    return false;
  };

  if (!search(root, 0)) return { result: aborted ? "unknown" : "lose", moves: [], nodes };
  return { result: "win", moves: toEngineMoves(state, path), nodes };
}

/** Expands talon plays into draws/recycles and checks every step with applyMove. */
function toEngineMoves(start: State, path: SMove[]): Move[] {
  const moves: Move[] = [];
  let state = start;
  const push = (m: Move) => {
    state = applyMove(state, m);
    moves.push(m);
  };
  const bringToTop = (card: number) => {
    for (let guard = 0; state.waste[state.waste.length - 1]?.id !== card; guard++) {
      if (guard > 200) throw new Error("solver: talon card not reachable");
      push(state.stock.length > 0 ? { kind: "draw" } : { kind: "recycle" });
    }
  };
  for (const m of path) {
    switch (m.t) {
      case "tf":
        push({ kind: "tableau-to-foundation", from: m.from });
        break;
      case "wf":
        bringToTop(m.card);
        push({ kind: "waste-to-foundation" });
        break;
      case "wt":
        bringToTop(m.card);
        push({ kind: "waste-to-tableau", to: m.to });
        break;
      case "tt":
        push({ kind: "tableau-to-tableau", from: m.from, to: m.to, count: m.count });
        break;
      case "ft":
        push({ kind: "foundation-to-tableau", suit: CARDS[m.suit * 13].suit, to: m.to });
        break;
    }
  }
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
 * The daily deal: the first seed `solitaire:${date}:${draw}:${n}` the solver
 * can win, so "every daily deal is winnable" is backed by an actual solution.
 */
export function dailyDeal(
  date: string,
  draw: 1 | 3 = 1,
  opts: { maxNodes?: number } = {},
): { seed: string; state: State; solution: Move[] } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`dailyDeal: bad date ${date}`);
  for (let n = 0; n < 500; n++) {
    const seed = `solitaire:${date}:${draw}:${n}`;
    const state = deal(seed, draw);
    const { result, moves } = solve(state, opts);
    if (result === "win") return { seed, state, solution: moves };
  }
  throw new Error(`dailyDeal: no winnable deal found for ${date}`);
}
