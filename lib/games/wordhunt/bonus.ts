/**
 * Bonus words: every accepted word (valid tier, 4+ letters) that can be traced
 * through a grid. GENERATOR-SIDE ONLY (imports the full lexicon); the list
 * ships inside the puzzle so the browser can check guesses on its own.
 *
 * Scanning the lexicon beats walking the grid with a prefix tree here: a word
 * survives only if every pair of consecutive letters sits on neighboring
 * cells somewhere, which rules out almost everything before any path search.
 */
import { MAX_WORD_LENGTH, wordsOfLength } from "@/lib/games/words/lexicon";
import { CELLS, NEIGHBORS, tracePaths } from "./grid";

export const MIN_BONUS_LENGTH = 4;

export function findBonusWords(grid: string, exclude: Iterable<string> = []): string[] {
  const g = grid.toLowerCase();
  const skip = new Set([...exclude].map((w) => w.toLowerCase()));
  const pair = new Uint8Array(26 * 26);
  const count = new Array<number>(26).fill(0);
  for (let i = 0; i < CELLS; i++) {
    const a = g.charCodeAt(i) - 97;
    count[a]++;
    for (const n of NEIGHBORS[i]) pair[a * 26 + g.charCodeAt(n) - 97] = 1;
  }
  const out: string[] = [];
  const used = new Array<number>(26);
  for (let len = MIN_BONUS_LENGTH; len <= Math.min(MAX_WORD_LENGTH, CELLS); len++) {
    const list = wordsOfLength(len, "valid");
    for (let i = 0; i < list.size; i++) {
      const w = list.at(i);
      let ok = true;
      for (let k = 1; k < len && ok; k++) ok = pair[(w.charCodeAt(k - 1) - 97) * 26 + w.charCodeAt(k) - 97] === 1;
      if (!ok) continue;
      used.fill(0);
      for (let k = 0; k < len && ok; k++) {
        const c = w.charCodeAt(k) - 97;
        ok = ++used[c] <= count[c];
      }
      if (!ok || skip.has(w)) continue;
      if (tracePaths(g, w, 1).length) out.push(w);
    }
  }
  return out.sort();
}
