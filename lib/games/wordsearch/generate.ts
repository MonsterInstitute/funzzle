/**
 * Word Search generation: theme words placed in all 8 directions (overlaps
 * allowed where letters agree), the rest filled with letters so that no
 * blocked word appears in any line, in either direction, and every theme word
 * appears exactly once. Pure and seeded (lib/games/kit/rng.ts), browser-safe:
 * it uses only the small blocklist, never the lexicon.
 */
import { containsBlockedSubstring, isBlocked } from "../words/blocklist";
import { createRng, type Rng } from "../kit/rng";

/** [row step, col step] for each direction. */
export const DIRS: readonly (readonly [number, number])[] = [
  [0, 1], // 0 across
  [1, 0], // 1 down
  [1, 1], // 2 diagonal down
  [-1, 1], // 3 diagonal up
  [0, -1], // 4 backward
  [-1, 0], // 5 up
  [-1, -1], // 6 diagonal up, backward
  [1, -1], // 7 diagonal down, backward
];

/** Plain-English direction, for the coach ("It runs …"). */
export const DIR_PHRASE = [
  "left to right",
  "straight down",
  "diagonally down to the right",
  "diagonally up to the right",
  "right to left, backward",
  "straight up",
  "diagonally up to the left",
  "diagonally down to the left",
] as const;

/** How hard each direction is to spot (the coach and the recap use it). */
export const DIR_DIFFICULTY = [0, 1, 2, 2, 3, 3, 4, 4] as const;

/** Skill id per direction (lib/games/kit/achievements.ts SKILL_TREES). */
export const DIR_SKILL = ["across", "down", "diagonal", "diagonal", "backward", "backward", "reverse-diagonal", "reverse-diagonal"] as const;

export const SIZES = [10, 12, 15] as const;
export type WordSearchSize = (typeof SIZES)[number];

/** Theme words per grid size. */
export const WORD_COUNT: Record<number, { target: number; min: number }> = {
  10: { target: 10, min: 10 },
  12: { target: 13, min: 10 },
  15: { target: 16, min: 12 },
};

export const MIN_LETTERS = 3;
export const MAX_LETTERS = 12;

export interface Theme {
  title: string;
  /** Lowercase single words, 3–12 letters. */
  words: string[];
}

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  /** Index into DIRS. */
  dir: number;
}

export interface WordSearchPuzzle {
  title: string;
  size: number;
  /** size × size lowercase letters, row by row. */
  grid: string;
  /** In the order the word list shows them (alphabetical). */
  words: PlacedWord[];
}

/** Cell indexes a placed word covers, first letter first. */
export function wordCells(size: number, w: PlacedWord): number[] {
  const [dr, dc] = DIRS[w.dir];
  return Array.from({ length: w.word.length }, (_, k) => (w.row + dr * k) * size + (w.col + dc * k));
}

const reverse = (s: string) => [...s].reverse().join("");

/** Every line of the grid read forward: rows, columns and both diagonals (length >= 2). */
export function gridLines(grid: string, size: number): string[] {
  const at = (r: number, c: number) => grid[r * size + c];
  const out: string[] = [];
  for (let r = 0; r < size; r++) out.push(grid.slice(r * size, r * size + size));
  for (let c = 0; c < size; c++) out.push(Array.from({ length: size }, (_, r) => at(r, c)).join(""));
  for (let k = -(size - 2); k <= size - 2; k++) {
    // down-right diagonals (c - r = k) and up-right diagonals (r + c = size - 1 + k)
    let a = "";
    let b = "";
    for (let r = 0; r < size; r++) {
      const c = r + k;
      if (c >= 0 && c < size) a += at(r, c);
      const c2 = size - 1 + k - r;
      if (c2 >= 0 && c2 < size) b += at(r, c2);
    }
    out.push(a, b);
  }
  return out;
}

function occurrences(line: string, word: string): number {
  let n = 0;
  for (let i = line.indexOf(word); i !== -1; i = line.indexOf(word, i + 1)) n++;
  return n;
}

/** How many times `word` can be found in the grid, any direction. */
export function countInGrid(lines: string[], word: string): number {
  const rev = reverse(word);
  let n = 0;
  for (const line of lines) n += occurrences(line, word) + (rev === word ? 0 : occurrences(line, rev));
  return n;
}

/** Problems with a puzzle (empty = valid). Used by tests and the cron before storing. */
export function puzzleProblems(p: WordSearchPuzzle): string[] {
  const out: string[] = [];
  const { size, grid, words } = p;
  if (!p.title || p.title.length > 40) out.push("bad title");
  if (size < 8 || size > 16 || grid.length !== size * size || !/^[a-z]+$/.test(grid)) return [...out, "bad grid"];
  if (words.length < 8 || words.length > 16) out.push(`${words.length} words`);
  const lines = gridLines(grid, size);
  for (const line of lines) {
    if (containsBlockedSubstring(line) || containsBlockedSubstring(reverse(line))) out.push(`blocked letters in line ${line}`);
  }
  const seen = new Set<string>();
  for (const w of words) {
    if (seen.has(w.word)) out.push(`${w.word} twice in the list`);
    seen.add(w.word);
    if (!/^[a-z]+$/.test(w.word) || w.word.length < MIN_LETTERS || w.word.length > Math.min(MAX_LETTERS, size)) out.push(`${w.word}: bad length`);
    if (isBlocked(w.word)) out.push(`${w.word}: blocked`);
    if (w.word === reverse(w.word)) out.push(`${w.word}: palindrome`);
    const [dr, dc] = DIRS[w.dir] ?? [9, 9];
    const endR = w.row + dr * (w.word.length - 1);
    const endC = w.col + dc * (w.word.length - 1);
    if (w.row < 0 || w.col < 0 || w.row >= size || w.col >= size || endR < 0 || endC < 0 || endR >= size || endC >= size) {
      out.push(`${w.word}: off the grid`);
      continue;
    }
    if (wordCells(size, w).map((i) => grid[i]).join("") !== w.word) out.push(`${w.word}: letters don't match`);
    const n = countInGrid(lines, w.word);
    if (n !== 1) out.push(`${w.word}: found ${n} times`);
  }
  return out;
}

/** English letter weights for filler (a..z), so the grid reads like text. */
const FREQ = [82, 15, 28, 43, 127, 22, 20, 61, 70, 2, 8, 40, 24, 67, 75, 19, 1, 60, 63, 91, 28, 10, 24, 2, 20, 1];

function pickLetter(rng: Rng, pool: string): string {
  // Half the filler comes from the theme's own letters: decoys that look like the words.
  if (pool && rng.next() < 0.5) return pool[rng.int(pool.length)];
  let x = rng.int(FREQ.reduce((a, b) => a + b, 0));
  for (let i = 0; i < 26; i++) {
    x -= FREQ[i];
    if (x < 0) return String.fromCharCode(97 + i);
  }
  return "e";
}

/** Direction weights by grid size: small grids lean on the easy directions. */
function dirWeights(size: number): number[] {
  if (size <= 10) return [5, 5, 3, 2, 2, 2, 1, 1];
  if (size <= 12) return [4, 4, 3, 3, 3, 3, 2, 2];
  return [3, 3, 3, 3, 3, 3, 3, 3];
}

function weighted(rng: Rng, weights: number[]): number {
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}

/** Theme words that can share one grid: right length, no palindromes, none inside another (either way round). */
export function usableWords(words: string[], size: number): string[] {
  const clean = [...new Set(words.map((w) => w.toLowerCase()))].filter(
    (w) => /^[a-z]+$/.test(w) && w.length >= MIN_LETTERS && w.length <= Math.min(MAX_LETTERS, size) && w !== reverse(w) && !isBlocked(w)
  );
  return clean;
}

function conflicts(a: string, b: string): boolean {
  return a.includes(b) || b.includes(a) || a.includes(reverse(b)) || b.includes(reverse(a));
}

export class WordSearchError extends Error {}

/**
 * A grid for `theme` at `size`, a pure function of the seed. Throws
 * WordSearchError when the theme can't fill the grid (too few usable words).
 */
export function generateWordSearch(seed: string, theme: Theme, size: number): WordSearchPuzzle {
  const counts = WORD_COUNT[size] ?? { target: Math.round(size * 1.05), min: 8 };
  const pool = usableWords(theme.words, size);
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = createRng(`${seed}#${attempt}`);
    // Pick the words: shuffled, skipping any that contains (or hides inside) another.
    const chosen: string[] = [];
    for (const w of rng.shuffle(pool.slice())) {
      if (chosen.length >= counts.target) break;
      if (!chosen.some((c) => conflicts(c, w))) chosen.push(w);
    }
    if (chosen.length < counts.min) throw new WordSearchError(`theme "${theme.title}" has only ${chosen.length} usable words for ${size}×${size}`);

    const cells: (string | null)[] = new Array(size * size).fill(null);
    const placed: PlacedWord[] = [];
    const weights = dirWeights(size);
    const byLength = chosen.slice().sort((a, b) => b.length - a.length);
    for (const word of byLength) {
      let done = false;
      for (let t = 0; t < 300 && !done; t++) {
        const dir = weighted(rng, weights);
        const [dr, dc] = DIRS[dir];
        const L = word.length;
        // Start positions that keep the whole word on the grid.
        const rMin = dr < 0 ? L - 1 : 0;
        const rMax = dr > 0 ? size - L : size - 1;
        const cMin = dc < 0 ? L - 1 : 0;
        const cMax = dc > 0 ? size - L : size - 1;
        if (rMax < rMin || cMax < cMin) continue;
        const row = rMin + rng.int(rMax - rMin + 1);
        const col = cMin + rng.int(cMax - cMin + 1);
        let overlaps = 0;
        let fits = true;
        for (let k = 0; k < L && fits; k++) {
          const ch = cells[(row + dr * k) * size + col + dc * k];
          if (ch === null) continue;
          if (ch !== word[k]) fits = false;
          else overlaps++;
        }
        // A word may cross others but not ride along one (that would hide it).
        if (!fits || overlaps > 2 || (overlaps > 0 && overlaps === L)) continue;
        for (let k = 0; k < L; k++) cells[(row + dr * k) * size + col + dc * k] = word[k];
        placed.push({ word, row, col, dir });
        done = true;
      }
    }
    if (placed.length < counts.min) continue;

    // Fill the gaps; refill a few times before giving up on this layout.
    const letters = placed.map((p) => p.word).join("");
    for (let fill = 0; fill < 12; fill++) {
      const grid = cells.map((ch) => ch ?? pickLetter(rng, letters)).join("");
      const puzzle: WordSearchPuzzle = {
        title: theme.title,
        size,
        grid,
        words: placed.slice().sort((a, b) => (a.word < b.word ? -1 : 1)),
      };
      if (!puzzleProblems(puzzle).length) return puzzle;
    }
  }
  throw new WordSearchError(`no valid ${size}×${size} grid for "${theme.title}" (seed ${seed})`);
}

/**
 * The word a drag selected: the cells from `a` to `b` in a straight line
 * (one of the 8 directions), read either way. Returns the index into
 * `p.words`, or -1.
 */
export function matchSelection(p: WordSearchPuzzle, cells: number[]): number {
  if (cells.length < 2) return -1;
  const key = cells.join(",");
  const rev = cells.slice().reverse().join(",");
  return p.words.findIndex((w) => {
    if (w.word.length !== cells.length) return false;
    const k = wordCells(p.size, w).join(",");
    return k === key || k === rev;
  });
}

/**
 * Cells on the straight line from `from` toward `to`, snapped to the nearest
 * of the 8 directions and clipped to the grid. Dragging works at any angle:
 * the selection follows the closest compass direction.
 */
export function lineCells(size: number, from: number, to: number): number[] {
  const r0 = Math.floor(from / size);
  const c0 = from % size;
  const dr = Math.floor(to / size) - r0;
  const dc = (to % size) - c0;
  if (!dr && !dc) return [from];
  const angle = Math.atan2(dr, dc);
  const oct = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  const step: [number, number] = [
    [0, 1],
    [1, 1],
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
  ][oct] as [number, number];
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  const out: number[] = [];
  for (let k = 0; k <= len; k++) {
    const r = r0 + step[0] * k;
    const c = c0 + step[1] * k;
    if (r < 0 || c < 0 || r >= size || c >= size) break;
    out.push(r * size + c);
  }
  return out;
}
