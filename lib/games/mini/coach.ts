/**
 * Mini Crossword coach: a three-rung hint ladder (point at the easiest open
 * clue → reveal one of its letters → reveal the word), and the recap's key
 * move. Browser-safe.
 */
import type { Layout } from "./grid";

export interface MiniLadder {
  /** Index into layout.entries. */
  entry: number;
  /** The cell rung 2 reveals. */
  cell: number;
  /** Rung 1: which clue to try, and why it's the easiest. */
  direction: string;
  /** Rung 2 text (after the letter is in). */
  specific: string;
  /** Rung 3 text (after the word is in). */
  answer: string;
}

export const dirName = (d: "A" | "D") => (d === "A" ? "Across" : "Down");
export const entryLabel = (e: { number: number; dir: "A" | "D" }) => `${e.number}-${dirName(e.dir)}`;

/**
 * The easiest clue still open: the most of its letters already right (the
 * crossings do the work), then the shortest, then the lowest number. Wrong
 * letters are flagged first: no clue is "easy" while a crossing is wrong.
 */
export function hintLadder(L: Layout, values: string[], clues: Record<string, string>): MiniLadder | null {
  let best = -1;
  let bestScore = -Infinity;
  L.entries.forEach((e, idx) => {
    const right = e.cells.filter((i) => values[i] === L.solution[i]).length;
    if (right === e.cells.length) return;
    const wrong = e.cells.filter((i) => values[i] && values[i] !== L.solution[i]).length;
    const score = (right / e.cells.length) * 100 - e.cells.length * 2 - wrong * 5 - idx * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  });
  if (best < 0) return null;
  const e = L.entries[best];
  const right = e.cells.filter((i) => values[i] === L.solution[i]).length;
  const wrongCells = e.cells.filter((i) => values[i] && values[i] !== L.solution[i]);
  // Rung 2 fixes a wrong letter first, then fills the first blank.
  const cell = wrongCells[0] ?? e.cells.find((i) => values[i] !== L.solution[i])!;
  const pos = e.cells.indexOf(cell) + 1;
  const label = entryLabel(e);
  const clue = clues[e.id] ?? "";
  const why = wrongCells.length
    ? `One of its letters doesn’t fit yet, so a crossing answer needs another look.`
    : right
      ? `${right} of its ${e.cells.length} letters are already in, so it’s the closest to done.`
      : `It’s ${e.cells.length < 5 ? "one of the shortest answers" : "a good place to start"}: read the clue, then count the squares.`;
  return {
    entry: best,
    cell,
    direction: `Try ${label}: “${clue}”. ${why}`,
    specific: `Letter ${pos} of ${label} is ${L.solution[cell]}. Does the rest of the word come now?`,
    answer: `${label} is ${e.answer}.`,
  };
}

/**
 * The recap's key move: the first full-width answer solved without help, or
 * failing that the first answer solved unaided at all.
 */
export function keyMove(L: Layout, placedAt: number[], revealed: boolean[]): { entry: number; at: number } | null {
  const solved = L.entries
    .map((e, idx) => ({
      idx,
      len: e.cells.length,
      unaided: e.cells.every((i) => !revealed[i]),
      at: Math.max(...e.cells.map((i) => placedAt[i] || Infinity)),
    }))
    .filter((s) => s.unaided && Number.isFinite(s.at));
  if (!solved.length) return null;
  const long = solved.filter((s) => s.len === L.size).sort((a, b) => a.at - b.at)[0];
  const pick = long ?? solved.sort((a, b) => a.at - b.at)[0];
  return { entry: pick.idx, at: pick.at };
}
