/**
 * The coach's hint ladder for Word Hunt: the area of one unfound theme word
 * (its cells, unordered), then its first letter, then the word itself.
 * Browser-safe.
 */
import { COLS, NEIGHBORS, ROWS, colOf, rowOf, spanSides } from "./grid";
import type { WordHuntPuzzle } from "./types";

export interface HintLadder {
  /** Index into puzzle.words. */
  word: number;
  /** Rung 1: the word's cells. */
  area: number[];
  /** Rung 2: the cell of its first letter. */
  first: number;
  direction: string;
  specific: string;
  answer: string;
}

/**
 * Which unfound word to hint: a theme word before the span word (the span is
 * the payoff), and among those the one hemmed in most by found words and the
 * board's edges — once its area lights up, it is the easiest to read.
 */
export function pickHintWord(puzzle: WordHuntPuzzle, found: ReadonlySet<number>): number {
  const claimed = new Set<number>();
  puzzle.words.forEach((w, i) => found.has(i) && w.path.forEach((c) => claimed.add(c)));
  let best = -1;
  let bestScore = -Infinity;
  puzzle.words.forEach((w, i) => {
    if (found.has(i)) return;
    const own = new Set(w.path);
    let walls = 0;
    for (const c of w.path) {
      walls += 8 - NEIGHBORS[c].length;
      for (const n of NEIGHBORS[c]) if (!own.has(n) && claimed.has(n)) walls++;
    }
    const score = (w.span ? -1000 : 0) + walls / w.path.length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

function spanWhere(path: number[]): string {
  const s = spanSides(path);
  return s.leftRight ? "from the left edge of the board to the right edge" : "from the top of the board to the bottom";
}

export function hintLadder(puzzle: WordHuntPuzzle, found: ReadonlySet<number>): HintLadder | null {
  const i = pickHintWord(puzzle, found);
  if (i < 0) return null;
  const w = puzzle.words[i];
  const first = w.path[0];
  const n = w.word.length;
  const row = rowOf(first);
  const col = colOf(first);
  const rowName = row === 0 ? "top row" : row === ROWS - 1 ? "bottom row" : `row ${row + 1}`;
  const colName = col === 0 ? "first column" : col === COLS - 1 ? "last column" : `column ${col + 1}`;
  return {
    word: i,
    area: [...w.path],
    first,
    direction: w.span
      ? `The highlighted letters spell the span word: ${n} letters, running ${spanWhere(w.path)}. It sums up the theme.`
      : `One theme word is hiding in the highlighted letters. It has ${n} letters and fits “${puzzle.title}”.`,
    specific: `It starts with the circled ${w.word[0]} (${rowName}, ${colName}). Read on through touching letters, any direction.`,
    answer: `It’s ${w.word}.${w.span ? " That’s the span word, so the rest of the board splits around it." : ""}`,
  };
}
