/**
 * Mahjong Solitaire solver: depth-first search over which tiles are gone,
 * with a table of positions already shown to be lost. Its lines are replayed
 * through applyMatch, so a "win" is always verified.
 *
 * Removing a pair never makes another tile less free, so the only real
 * decisions are which tiles of a kind end up paired together:
 * - when every remaining tile of a kind is free (two, or all four), removing
 *   them is forced and never branched on;
 * - when three of a kind are free, each of the three pairs is tried;
 * - pairs are tried in order of how many tiles they hold up (beneath them
 *   and along their row), so the search digs into big stacks and long rows
 *   first.
 * Positions where the last two tiles of kinds block each other in a cycle
 * are cut off at once, and the search restarts with growing budgets and a
 * little randomness so one bad early choice cannot eat the whole budget.
 */

import { createRng } from "@/lib/games/kit/rng";
import { applyMatch, isWon, positionKey, undo, type Pair, type State } from "./engine";
import { generateDeal } from "./generate";
import { geometry, isLayoutId, type LayoutId } from "./layouts";
import { matchKey, tilesMatch } from "./tiles";

export interface SolveResult {
  result: "win" | "lose" | "unknown";
  /** A winning line (empty unless result is "win"). */
  moves: Pair[];
  nodes: number;
}

export function solve(state: State, opts: { maxNodes?: number } = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 100_000;
  if (isWon(state)) return { result: "win", moves: [], nodes: 0 };
  const g = geometry(state.layout);
  const n = g.size;

  // Match keys as small integers so groups are array slots.
  const keyIds = new Map<string, number>();
  const kind = state.tiles.map((t) => {
    const k = matchKey(t);
    if (!keyIds.has(k)) keyIds.set(k, keyIds.size);
    return keyIds.get(k)!;
  });
  const kinds = keyIds.size;
  const gone = Uint8Array.from(state.removed, (r) => (r ? 1 : 0));
  const left = new Int32Array(kinds);
  for (let p = 0; p < n; p++) if (!gone[p]) left[kind[p]]++;
  let total = left.reduce((s, x) => s + x, 0);

  const free = (p: number) => {
    if (gone[p]) return false;
    for (const q of g.above[p]) if (!gone[q]) return false;
    let open = true;
    for (const q of g.left[p]) if (!gone[q]) open = false;
    if (open) return true;
    for (const q of g.right[p]) if (!gone[q]) return false;
    return true;
  };

  /** Bit-packed set of gone tiles, 16 per character. */
  const key = () => {
    let s = "";
    for (let i = 0; i < n; i += 16) {
      let w = 0;
      for (let j = i; j < Math.min(i + 16, n); j++) w = (w << 1) | gone[j];
      s += String.fromCharCode(w);
    }
    return s;
  };

  /** Remaining tiles p holds up: those beneath it, and its row on the longer side. */
  const weight = (p: number) => {
    let w = 0;
    for (const q of g.below[p]) if (!gone[q]) w += 2;
    const run = (side: number[][]) => {
      const seen = new Set<number>();
      const stack = [p];
      while (stack.length) {
        for (const q of side[stack.pop()!]) {
          if (gone[q] || seen.has(q)) continue;
          seen.add(q);
          stack.push(q);
        }
      }
      return seen.size;
    };
    return w + Math.max(run(g.left), run(g.right));
  };

  /** Tiles that become free once `a` and `b` are gone (a tie-breaker). */
  const gain = (a: number, b: number) => {
    const touched = new Set([...g.below[a], ...g.left[a], ...g.right[a], ...g.below[b], ...g.left[b], ...g.right[b]]);
    touched.delete(a);
    touched.delete(b);
    const before = [...touched].map(free);
    gone[a] = gone[b] = 1;
    let freed = 0;
    [...touched].forEach((q, i) => {
      if (!before[i] && free(q)) freed++;
    });
    gone[a] = gone[b] = 0;
    return freed;
  };

  /**
   * Deadlock test. When only two tiles of a kind remain they must leave
   * together, so they count as one node; a tile must leave before every tile
   * under it. A cycle in that "before" graph (A1 on top of B1 while B2 sits
   * on A2, or the last two of a kind stacked) means no order clears the board.
   */
  const comp = new Int32Array(n);
  const color = new Uint8Array(n);
  const partner = new Int32Array(kinds);
  const members: number[][] = Array.from({ length: n }, () => []);
  const deadlocked = () => {
    partner.fill(-1);
    for (let p = 0; p < n; p++) members[p].length = 0;
    for (let p = 0; p < n; p++) {
      if (gone[p]) continue;
      comp[p] = p;
      const t = kind[p];
      if (left[t] === 2) {
        if (partner[t] < 0) partner[t] = p;
        else comp[p] = partner[t];
      }
      members[comp[p]].push(p);
    }
    color.fill(0);
    const visit = (c: number): boolean => {
      color[c] = 1;
      for (const p of members[c]) {
        for (const q of g.above[p]) {
          if (gone[q]) continue;
          const d = comp[q];
          if (color[d] === 1 || (color[d] === 0 && visit(d))) return true;
        }
      }
      color[c] = 2;
      return false;
    };
    for (let c = 0; c < n; c++) if (members[c].length && color[c] === 0 && visit(c)) return true;
    return false;
  };

  const lost = new Set<string>();
  const path: Pair[] = [];
  let nodes = 0;
  let aborted = false;
  /** Node limit for the current restart, and the noise added to move scores. */
  let limit = 0;
  let noise = 0;
  const rng = createRng(`mahjong-solver:${n}`);

  const remove = (a: number, b: number) => {
    gone[a] = gone[b] = 1;
    left[kind[a]] -= 2;
    total -= 2;
    path.push([a, b]);
  };
  const restore = () => {
    const [a, b] = path.pop()!;
    gone[a] = gone[b] = 0;
    left[kind[a]] += 2;
    total += 2;
  };

  const search = (): boolean => {
    if (total === 0) return true;
    if (nodes >= limit) {
      aborted = true;
      return false;
    }
    nodes++;
    const k = key();
    if (lost.has(k)) return false;
    if (deadlocked()) {
      lost.add(k);
      return false;
    }

    const byKind: number[][] = Array.from({ length: kinds }, () => []);
    for (let p = 0; p < n; p++) if (free(p)) byKind[kind[p]].push(p);

    for (let t = 0; t < kinds; t++) {
      const f = byKind[t];
      if (f.length >= 2 && f.length === left[t]) {
        const depth = path.length;
        for (let i = 0; i < f.length; i += 2) remove(f[i], f[i + 1]);
        if (search()) return true;
        while (path.length > depth) restore();
        if (!aborted) lost.add(k);
        return false;
      }
    }

    const options: { a: number; b: number; score: number }[] = [];
    for (const f of byKind) {
      for (let i = 0; i < f.length; i++) {
        for (let j = i + 1; j < f.length; j++) {
          const a = f[i];
          const b = f[j];
          const score = weight(a) + weight(b) + gain(a, b) / 4 + rng.next() * noise;
          options.push({ a, b, score });
        }
      }
    }
    options.sort((x, y) => y.score - x.score);
    for (const o of options) {
      remove(o.a, o.b);
      const won = search();
      if (won) return true;
      restore();
      if (aborted) return false;
    }
    lost.add(k);
    return false;
  };

  let won = false;
  for (let round = 0; ; round++) {
    limit = nodes + Math.max(1, Math.min(maxNodes - nodes, 2000 << Math.min(round, 20)));
    noise = round === 0 ? 0 : 2 + round;
    aborted = false;
    won = search();
    if (won || !aborted || nodes >= maxNodes) break;
  }
  if (!won) return { result: aborted ? "unknown" : "lose", moves: [], nodes };
  const moves = path.slice();
  let s = state;
  for (const m of moves) s = applyMatch(s, m);
  if (!isWon(s)) throw new Error("solver: winning line did not win");
  rememberLine(state, moves);
  return { result: "win", moves, nodes };
}

/**
 * Winning lines found recently, keyed by position, so the coach can follow a
 * line move by move without searching again. Bounded to keep memory flat.
 */
const lines = new Map<string, Pair[]>();
const MAX_LINES = 3000;

function rememberLine(start: State, moves: Pair[]): void {
  let state = start;
  for (let i = 0; i < moves.length; i++) {
    const k = positionKey(state);
    lines.delete(k);
    lines.set(k, moves.slice(i));
    state = applyMatch(state, moves[i]);
  }
  while (lines.size > MAX_LINES) lines.delete(lines.keys().next().value!);
}

/** Replays a line from `start`; true when it is legal and clears the board. */
function clears(start: State, moves: Pair[]): boolean {
  try {
    let state = start;
    for (const m of moves) state = applyMatch(state, m);
    return isWon(state);
  } catch {
    return false;
  }
}

/**
 * Teach the coach a winning line found elsewhere (the daily deal's solution,
 * or the line returned by shuffleRemaining). The line is replayed, so a stale
 * or wrong line is rejected rather than coached.
 */
export function rememberWinningLine(start: State, moves: Pair[]): boolean {
  if (!clears(start, moves)) return false;
  rememberLine(start, moves);
  return true;
}

const samePair = (x: Pair, y: Pair) => (x[0] === y[0] && x[1] === y[1]) || (x[0] === y[1] && x[1] === y[0]);

/**
 * A winning line from `after`, the position reached when the player matched
 * `pair` instead of following `line`. Matching early never stops another
 * tile from being free, so if the line also takes this pair it is simply
 * dropped. If the line pairs the two tiles with partners b and d instead,
 * those partners match each other: (b, d) takes the place of one of the two
 * moves and the other is dropped. Candidates are replayed, so a repair is
 * only returned when it really clears the board.
 */
function repair(after: State, line: Pair[], pair: Pair): Pair[] | null {
  const i = line.findIndex((m) => samePair(m, pair));
  const candidates: Pair[][] = [];
  if (i >= 0) {
    candidates.push([...line.slice(0, i), ...line.slice(i + 1)]);
  } else {
    const ia = line.findIndex((m) => m.includes(pair[0]));
    const ib = line.findIndex((m) => m.includes(pair[1]));
    if (ia < 0 || ib < 0) return null;
    const pa = line[ia][0] === pair[0] ? line[ia][1] : line[ia][0];
    const pb = line[ib][0] === pair[1] ? line[ib][1] : line[ib][0];
    if (!tilesMatch(after.tiles[pa], after.tiles[pb])) return null;
    for (const [keep, drop] of [
      [Math.max(ia, ib), Math.min(ia, ib)],
      [Math.min(ia, ib), Math.max(ia, ib)],
    ]) {
      const out = line.slice();
      out[keep] = [pa, pb];
      out.splice(drop, 1);
      candidates.push(out);
    }
  }
  return candidates.find((c) => clears(after, c)) ?? null;
}

/**
 * A known winning line from exactly this position, if one was found earlier.
 * When the player has wandered off a known line, it is repaired from the
 * most recent position (up to 30 matches back, no shuffles) that had one.
 */
export function knownLine(state: State): Pair[] | undefined {
  const direct = lines.get(positionKey(state));
  if (direct) return direct;
  const taken: Pair[] = [];
  let s = state;
  for (let back = 0; back < 30; back++) {
    const last = s.history[s.history.length - 1];
    if (!last || last.kind !== "match") return undefined;
    taken.unshift(last.pair);
    s = undo(s);
    const found = lines.get(positionKey(s));
    if (!found) continue;
    let line: Pair[] | null = found;
    for (const pair of taken) {
      s = applyMatch(s, pair);
      line = repair(s, line, pair);
      if (!line) return undefined;
    }
    rememberLine(state, line);
    return line;
  }
  return undefined;
}

/** Clears the remembered winning lines (for tests). */
export function clearKnownLines(): void {
  lines.clear();
}

/**
 * The daily deal for a layout: the first seed `mahjong:${date}:${layout}:${n}`
 * that fills, with its winning line replayed to an empty board.
 */
export function dailyDeal(
  date: string,
  layout: LayoutId = "turtle",
): { seed: string; state: State; solution: Pair[] } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`dailyDeal: bad date ${date}`);
  if (!isLayoutId(layout)) throw new Error(`dailyDeal: unknown layout ${layout}`);
  for (let n = 0; n < 20; n++) {
    const seed = `mahjong:${date}:${layout}:${n}`;
    let deal;
    try {
      deal = generateDeal(layout, seed);
    } catch {
      continue;
    }
    if (rememberWinningLine(deal.state, deal.solution)) return { seed, ...deal };
  }
  throw new Error(`dailyDeal: no deal found for ${date} ${layout}`);
}
