/**
 * Full puzzle validation for generators and tests (imports the lexicon, so
 * never import this from a client component).
 *
 * On top of shapeErrors (./puzzle.ts), every word must be family-friendly
 * and real: each lowercase token (split on spaces and hyphens) must be an
 * everyday word in the "common" lexicon tier; capitalized tokens are proper
 * nouns ("Mars", "Paris") and only go through the blocklist.
 */
import { containsBlockedSubstring, isBlocked } from "@/lib/games/words/blocklist";
import { isCommon } from "@/lib/games/words/lexicon";
import { shapeErrors, type GroupsPuzzle } from "./puzzle";

const PROPER_RE = /^[A-Z][a-z]+(?:[A-Z][a-z]+)?$/;

/** Problems with one word; empty means OK. */
export function wordErrors(word: string): string[] {
  const errors: string[] = [];
  const joined = word.replace(/[^A-Za-z]/g, "");
  if (containsBlockedSubstring(joined) || containsBlockedSubstring([...joined].reverse().join(""))) errors.push(`${word}: blocked`);
  for (const token of word.split(/[ -]+/)) {
    const bare = token.replace(/'/g, "");
    if (!bare) continue;
    if (isBlocked(bare)) errors.push(`${word}: blocked`);
    else if (PROPER_RE.test(bare)) continue;
    else if (bare !== bare.toLowerCase()) errors.push(`${word}: odd capitals in ${token}`);
    else if (!isCommon(bare)) errors.push(`${word}: ${bare} is not an everyday word`);
  }
  return errors;
}

/** Every problem with a puzzle: shape, words and text. Empty means it can be played. */
export function puzzleErrors(p: unknown): string[] {
  const errors = shapeErrors(p);
  if (errors.length) return errors;
  const puzzle = p as GroupsPuzzle;
  for (const g of puzzle.groups) {
    for (const w of g.words) errors.push(...wordErrors(w));
    for (const text of [g.title, g.hint]) {
      for (const token of text.split(/[^A-Za-z]+/)) if (token && isBlocked(token)) errors.push(`${text}: blocked word ${token}`);
    }
  }
  return errors;
}
