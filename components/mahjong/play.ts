/**
 * Mahjong game-screen rules that sit on top of the engine: what a tap does,
 * the hint and shuffle budget, labels, skills and the recap's coach lines.
 * Pure functions, so they're unit-tested without a browser.
 */
import {
  geometry,
  getLayout,
  isFree,
  LAYOUT_IDS,
  matchCount,
  shuffleCount,
  tileName,
  tilesMatch,
  type LayoutId,
  type Pair,
  type State,
} from "@/lib/games/mahjong";
import { formatTime } from "@/lib/games/kit/results";

/** Free "Show a match" hints per game; a rewarded ad adds one more at a time. */
export const FREE_HINTS = 3;

/** Under this on the Turtle earns the "fast" skill. */
export const FAST_MS = 8 * 60_000;

export type Mode = "daily" | "practice";

export type TapResult =
  | { kind: "none" }
  | { kind: "select"; p: number }
  | { kind: "deselect" }
  | { kind: "match"; pair: Pair }
  | { kind: "blocked"; p: number; text: string };

/** Why a remaining tile can't be picked yet. */
export function blockedText(state: State, p: number): string {
  const g = geometry(state.layout);
  const name = tileName(state.tiles[p]);
  if (g.above[p].some((q) => !state.removed[q])) return `The ${name} is covered: a tile on top of it has to go first.`;
  return `The ${name} is blocked on both sides. A tile is free when its left or right side is open.`;
}

/**
 * What tapping position p does, given the selected tile: select it, drop the
 * selection, match the pair, or explain why it's blocked. Tapping a free tile
 * that doesn't match the selection selects it instead.
 */
export function tapTile(state: State, selected: number | null, p: number): TapResult {
  if (p < 0 || p >= state.tiles.length || state.removed[p]) return { kind: "none" };
  if (!isFree(state, p)) return { kind: "blocked", p, text: blockedText(state, p) };
  if (selected === p) return { kind: "deselect" };
  if (selected !== null && !state.removed[selected] && isFree(state, selected) && tilesMatch(state.tiles[selected], state.tiles[p])) {
    return { kind: "match", pair: [selected, p] };
  }
  return { kind: "select", p };
}

export function hintsLeft(used: number, bonus: number): number {
  return Math.max(0, FREE_HINTS + bonus - used);
}

/** Hints a shuffle costs: the first one in practice is free, every other one counts as a hint. */
export function shuffleCost(mode: Mode, freeShuffleUsed: boolean): 0 | 1 {
  return mode === "practice" && !freeShuffleUsed ? 0 : 1;
}

/** Screen-reader label for a tile. */
export function tileLabel(state: State, p: number, opts: { selected?: boolean; hinted?: boolean } = {}): string {
  const parts = [tileName(state.tiles[p]), isFree(state, p) ? "free" : "blocked"];
  if (opts.selected) parts.push("selected");
  if (opts.hinted) parts.push("suggested by the coach");
  return parts.join(", ");
}

/** True once every tile on the layout's top layer is gone. */
export function topCleared(state: State): boolean {
  const cells = getLayout(state.layout).cells;
  const top = Math.max(...cells.map((c) => c.z));
  return cells.every((c, p) => c.z !== top || state.removed[p]);
}

/** Skills a cleared board earns (lib/games/kit/achievements.ts SKILL_TREES.mahjong). */
export function skillsFor(input: { layout: LayoutId; hints: number; shuffles: number; timeMs: number; clearedBefore: Record<string, number> }): string[] {
  const { layout, hints, shuffles, timeMs, clearedBefore } = input;
  const skills: string[] = [`clear-${layout}`];
  if (!hints) skills.push("no-hint");
  if (!shuffles) skills.push("no-shuffle");
  if (layout === "turtle" && timeMs < FAST_MS) skills.push("fast");
  if (layout === "turtle" && !hints && !shuffles) skills.push("turtle-unaided");
  if (LAYOUT_IDS.every((id) => id === layout || (clearedBefore[id] ?? 0) > 0)) skills.push("all-layouts");
  return skills;
}

/** The recap's "Your key move" line. */
export function keyMoveText(state: State, topClearedAt?: number): string {
  const size = state.tiles.length;
  if (topClearedAt !== undefined) {
    return `at ${formatTime(topClearedAt)} you took the top of the stack. Every tile under it was in play from then on, and you cleared all ${size}.`;
  }
  return `you cleared all ${size} tiles in ${matchCount(state)} matches.`;
}

/** The recap's "Next skill" line. */
export function nextSkillText(state: State, hints: number, timeMs: number): string {
  const shuffles = shuffleCount(state);
  if (shuffles > 0) {
    return `A clear without reshuffling. You shuffled ${shuffles === 1 ? "once" : `${shuffles} times`}; next time, when three of a kind are free, stop and pick the pair that frees the most before you match.`;
  }
  if (hints > 0) {
    return "A clear with no hints. Before each match, count how many of that tile are free: with all four free any pairing is safe; with three, think first.";
  }
  if (state.layout !== "turtle") return "The Turtle: 144 tiles on five layers. It’s the daily board, and the one the leaderboard ranks.";
  if (timeMs >= FAST_MS) return "The Turtle in under 8 minutes. Scan the long rows and the tall middle first: that’s where the next free pairs come from.";
  const other = LAYOUT_IDS.find((id) => id !== "turtle" && id !== "quick") ?? "pyramid";
  return `Another shape. Try ${getLayout(other).name} in practice: its stacks block tiles differently.`;
}

export const LEARN = {
  title: "How to read a Mahjong board",
  body: "1. A tile is free when nothing lies on it and its left or right side is open. 2. When all four of a kind are free, match any two. When three are free, take the pair that frees the most and keep the third. 3. Work the tall stacks and the long rows first; tiles on the edges can wait.",
};

/** Layouts offered in practice, smallest first. */
export const PRACTICE_LAYOUTS: LayoutId[] = ["quick", "bridge", "fortress", "pyramid", "turtle"];

export function layoutSummary(id: LayoutId): string {
  const l = getLayout(id);
  return `${l.name} · ${l.cells.length} tiles`;
}
