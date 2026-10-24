/**
 * "AI Coach": suggests the next pair with a one-sentence reason. It follows
 * a winning line when one is known (the daily solution, a repaired version
 * of it after the player strayed, or a quick search) and otherwise falls
 * back to the usual human priorities: safe pairs first, then the pair that
 * opens up the most of the board.
 */

import { applyMatch, freeTiles, matchingPairs, type Pair, type State } from "./engine";
import { geometry } from "./layouts";
import { knownLine, solve } from "./solver";
import { groupName, groupNameOne, matchKey } from "./tiles";

export type Reason =
  /** The last two of their kind: they can only pair with each other. */
  | "last-two"
  /** All four remaining of the kind are free, so no pairing can go wrong. */
  | "all-four"
  /** Three of the kind are free; this pair leaves the right one behind. */
  | "keep-third"
  /** Removing the pair frees tiles under or beside it. */
  | "frees"
  /** Nothing opens up yet, but the pair is on a winning line / the best available. */
  | "step";

export interface Hint {
  pair: Pair;
  reason: Reason;
  /** One plain sentence: which pair, and why. */
  text: string;
  /** True when the pair is on a line the solver has verified clears the board. */
  winning: boolean;
}

/** What removing a pair does to the board. */
interface Effect {
  /** Tiles that were not free and are afterwards. */
  freedBelow: number;
  freedBeside: number;
  /** Remaining tiles of the pair's kind, and how many of them are free now. */
  left: number;
  free: number;
  /** One of the two is resting on other tiles. */
  onStack: boolean;
}

function effect(state: State, pair: Pair): Effect {
  const g = geometry(state.layout);
  const key = matchKey(state.tiles[pair[0]]);
  const before = new Set(freeTiles(state));
  const after = freeTiles(applyMatch(state, pair));
  const under = new Set([...g.below[pair[0]], ...g.below[pair[1]]]);
  let freedBelow = 0;
  let freedBeside = 0;
  for (const p of after) {
    if (before.has(p)) continue;
    if (under.has(p)) freedBelow++;
    else freedBeside++;
  }
  let left = 0;
  let free = 0;
  state.tiles.forEach((t, p) => {
    if (state.removed[p] || matchKey(t) !== key) return;
    left++;
    if (before.has(p)) free++;
  });
  const onStack = pair.some((p) => g.below[p].some((q) => !state.removed[q]));
  return { freedBelow, freedBeside, left, free, onStack };
}

const tiles = (n: number) => (n === 1 ? "1 tile" : `${n} tiles`);

function reasonFor(e: Effect): Reason {
  if (e.left === 2) return "last-two";
  if (e.free === 4) return "all-four";
  if (e.free === 3) return "keep-third";
  if (e.freedBelow + e.freedBeside > 0) return "frees";
  return "step";
}

/** "that frees 3 tiles below", "that opens 2 tiles beside them", or "". */
function freedPhrase(e: Effect): string {
  const total = e.freedBelow + e.freedBeside;
  if (total === 0) return "";
  if (e.freedBeside === 0) return `that frees ${tiles(total)} below`;
  if (e.freedBelow === 0) return `that opens ${tiles(total)} beside them`;
  return `that frees ${tiles(total)}`;
}

/** The hint sentence for a pair. */
export function explain(state: State, pair: Pair, winning: boolean): { reason: Reason; text: string } {
  const e = effect(state, pair);
  const name = groupName(state.tiles[pair[0]]);
  const one = groupNameOne(state.tiles[pair[0]]);
  const where = e.onStack ? " on top of the stack" : "";
  const freed = freedPhrase(e);
  const reason = reasonFor(e);
  let text: string;
  switch (reason) {
    case "last-two":
      text = `Match the last two ${name}${where}: they can only go with each other${freed ? `, and ${freed}` : ""}.`;
      break;
    case "all-four":
      text = `Match two of the four ${name}: all four are free, so any pairing is safe${freed ? ` and ${freed}` : ""}.`;
      break;
    case "keep-third":
      text = freed
        ? `Take the pair of ${name}${where} that ${freed.slice(5)} and keeps the third ${one} free for the last one.`
        : `Take the pair of ${name} that keeps the third ${one} free for the last one, leaving the one that blocks the least.`;
      break;
    case "frees":
      text = `Match the two ${name}${where}: ${freed}.`;
      break;
    case "step":
      text = winning
        ? `Match the two ${name}: it keeps you on a line that clears the whole board.`
        : `Match the two ${name}: no pair opens anything yet, and these hold up the most tiles.`;
      break;
  }
  return { reason, text };
}

/** Remaining tiles a tile holds up: those under it and its row on the longer side. */
function heldUp(state: State, p: number): number {
  const g = geometry(state.layout);
  const run = (side: number[][]) => {
    const seen = new Set<number>();
    const stack = [p];
    while (stack.length) {
      for (const q of side[stack.pop()!]) {
        if (state.removed[q] || seen.has(q)) continue;
        seen.add(q);
        stack.push(q);
      }
    }
    return seen.size;
  };
  const under = g.below[p].filter((q) => !state.removed[q]).length;
  return under * 2 + Math.max(run(g.left), run(g.right));
}

function heuristicScore(state: State, pair: Pair): number {
  const e = effect(state, pair);
  if (e.left === 2 || e.free === 4) return 1000 + e.freedBelow + e.freedBeside;
  return (e.freedBelow + e.freedBeside) * 4 + heldUp(state, pair[0]) + heldUp(state, pair[1]);
}

/**
 * The coach's suggestion for this position, or null when no pair is left.
 * Follows a remembered, repaired or freshly solved winning line when possible.
 */
export function bestMove(state: State, opts: { maxNodes?: number } = {}): Hint | null {
  let line = knownLine(state);
  if (!line) {
    const solved = solve(state, { maxNodes: opts.maxNodes ?? 20_000 });
    if (solved.result === "win" && solved.moves.length > 0) line = solved.moves;
  }
  if (line && line.length > 0) {
    const pair = line[0];
    return { pair, ...explain(state, pair, true), winning: true };
  }
  let best: Pair | null = null;
  let bestScore = -Infinity;
  for (const pair of matchingPairs(state)) {
    const score = heuristicScore(state, pair);
    if (score > bestScore) {
      best = pair;
      bestScore = score;
    }
  }
  return best ? { pair: best, ...explain(state, best, false), winning: false } : null;
}
