/**
 * Crossword coach: a three-rung ladder. Rung 1 picks the easiest open clue
 * (the one closest to done, short entries first) and selects it; rung 2 shows
 * the letter pattern so far plus the clue of the crossing that unlocks the
 * most useful missing square; rung 3 reveals that one square.
 */
import { entriesOf, entryText, type Entry } from "./grid";
import type { CrosswordPuzzle } from "./puzzle";

export interface CrosswordHint {
  entry: Entry;
  clue: string;
  /** "S _ A _ E" from the player's correct letters. */
  pattern: string;
  /** The square rung 3 reveals. */
  cell: number;
  letter: string;
  /** The crossing entry through `cell`, when it has one with a clue. */
  crossing: { entry: Entry; clue: string } | null;
  nudge: string;
  detail: string;
  answer: string;
}

export const entryLabel = (e: Entry) => `${e.num} ${e.dir === "across" ? "Across" : "Down"}`;

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * The next hint, or null when every square is right. `values` holds the
 * player's letter per cell ("" for empty; black cells ignored).
 */
export function crosswordHint(p: CrosswordPuzzle, values: readonly string[]): CrosswordHint | null {
  const entries = entriesOf(p.grid);
  const right = (i: number) => values[i] === p.grid[i];
  const ratio = (e: Entry) => e.cells.filter(right).length / e.cells.length;
  const open = entries.filter((e) => e.cells.some((i) => !right(i)));
  if (!open.length) return null;
  // Closest to done first, then shorter, then reading order.
  open.sort((a, b) => ratio(b) - ratio(a) || a.cells.length - b.cells.length || a.num - b.num);
  const entry = open[0];
  const crossingOf = (cell: number) => entries.find((x) => x.dir !== entry.dir && x.cells.includes(cell)) ?? null;
  // The missing square whose crossing is itself furthest along (its clue is the best extra lead).
  const missing = entry.cells.filter((i) => !right(i));
  let cell = missing[0];
  let best = -1;
  for (const i of missing) {
    const x = crossingOf(i);
    const score = x ? ratio(x) : -0.5;
    if (score > best) {
      best = score;
      cell = i;
    }
  }
  const x = crossingOf(cell);
  const pos = entry.cells.indexOf(cell) + 1;
  const pattern = entry.cells.map((i) => (right(i) ? p.grid[i].toUpperCase() : "_")).join(" ");
  const clue = p.clues[entry.id] ?? "";
  const crossing = x ? { entry: x, clue: p.clues[x.id] ?? "" } : null;
  const done = entry.cells.length - missing.length;
  return {
    entry,
    clue,
    pattern,
    cell,
    letter: p.grid[cell],
    crossing,
    nudge: `Try ${entryLabel(entry)}: “${clue}”. ${done ? `You already have ${done} of its ${entry.cells.length} letters.` : `It's one of the shortest open answers.`}`,
    detail: `${entryLabel(entry)} is ${entry.cells.length} letters: ${pattern}.${
      crossing ? ` Its ${ordinal(pos)} letter is shared with ${entryLabel(crossing.entry)}: “${crossing.clue}”.` : ""
    }`,
    answer: `The ${ordinal(pos)} letter of ${entryLabel(entry)} is ${p.grid[cell].toUpperCase()}.`,
  };
}

/** Full answer of an entry, uppercase (recap, reveal word). */
export function answerOf(p: CrosswordPuzzle, e: Entry): string {
  return entryText(p.grid, e).toUpperCase();
}
