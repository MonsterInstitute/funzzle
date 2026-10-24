/**
 * Word Search coach: a three-rung ladder for one word the player hasn't
 * found. Rung 1 lights up the square the word starts on, rung 2 says which
 * way it runs, rung 3 circles it. The coach picks the word that is hardest to
 * spot (backward and diagonal words, then shorter ones), since that's the one
 * people are usually stuck on.
 */
import { DIR_DIFFICULTY, DIR_PHRASE, wordCells, type WordSearchPuzzle } from "./generate";

export interface WordSearchHint {
  /** Index into puzzle.words. */
  word: number;
  /** Square the word starts on. */
  start: number;
  /** Second letter: shown with the direction on rung 2. */
  next: number;
  cells: number[];
  nudge: string;
  direction: string;
  answer: string;
}

const upper = (w: string) => w.toUpperCase();

export function hardness(p: WordSearchPuzzle, i: number): number {
  const w = p.words[i];
  return DIR_DIFFICULTY[w.dir] * 10 - w.word.length;
}

export function wordSearchHint(p: WordSearchPuzzle, found: readonly boolean[]): WordSearchHint | null {
  let best = -1;
  for (let i = 0; i < p.words.length; i++) {
    if (found[i]) continue;
    if (best < 0 || hardness(p, i) > hardness(p, best)) best = i;
  }
  if (best < 0) return null;
  const w = p.words[best];
  const cells = wordCells(p.size, w);
  const row = Math.floor(cells[0] / p.size) + 1;
  const col = (cells[0] % p.size) + 1;
  return {
    word: best,
    start: cells[0],
    next: cells[1],
    cells,
    nudge: `Look for ${upper(w.word)}. It starts on the highlighted ${upper(w.word[0])} (row ${row}, column ${col}).`,
    direction: `From that ${upper(w.word[0])}, ${upper(w.word)} runs ${DIR_PHRASE[w.dir]}: the next letter is ${upper(w.word[1])}.`,
    answer: `There it is: ${upper(w.word)}, ${w.word.length} letters running ${DIR_PHRASE[w.dir]}.`,
  };
}
