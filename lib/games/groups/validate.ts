/**
 * Full puzzle validation for generators and tests (imports the lexicon, so
 * never import this from a client component).
 *
 * On top of shapeErrors (./puzzle.ts), every word must be family-friendly
 * and real: each lowercase token (split on spaces and hyphens) must be in
 * the lexicon; capitalized tokens are proper nouns ("Mars", "Paris") and
 * only go through the blocklist.
 *
 * Tier: the hand-written bank is held to the "common" tier. Generated
 * puzzles use "valid": the common tier (SCOWL <= 35) leaves out plenty of
 * everyday words a puzzle wants ("cupcake", "sushi", "espresso", "cheddar",
 * "lasagna"), which used to sink whole replies; the ambiguity check still
 * rejects a word that's unclear.
 */
import { containsBlockedSubstring, isBlocked } from "@/lib/games/words/blocklist";
import { isCommon, isWord, type Tier } from "@/lib/games/words/lexicon";
import { shapeErrors, type GroupsPuzzle } from "./puzzle";

const PROPER_RE = /^[A-Z][a-z]+(?:[A-Z][a-z]+)?$/;

/** Problems with one word; empty means OK. */
export function wordErrors(word: string, tier: Tier = "common"): string[] {
  const errors: string[] = [];
  const joined = word.replace(/[^A-Za-z]/g, "");
  const known = tier === "common" ? isCommon : isWord;
  if (containsBlockedSubstring(joined) || containsBlockedSubstring([...joined].reverse().join(""))) errors.push(`${word}: blocked`);
  for (const token of word.split(/[ -]+/)) {
    const bare = token.replace(/'/g, "");
    if (!bare) continue;
    if (isBlocked(bare)) errors.push(`${word}: blocked`);
    else if (PROPER_RE.test(bare)) continue;
    else if (bare !== bare.toLowerCase()) errors.push(`${word}: odd capitals in ${token}`);
    else if (!known(bare)) errors.push(`${word}: ${bare} is not ${tier === "common" ? "an everyday word" : "in the lexicon"}`);
  }
  return errors;
}

/** Every problem with a puzzle: shape, words and text. Empty means it can be played. */
export function puzzleErrors(p: unknown, tier: Tier = "common"): string[] {
  const errors = shapeErrors(p);
  if (errors.length) return errors;
  const puzzle = p as GroupsPuzzle;
  for (const g of puzzle.groups) {
    for (const w of g.words) errors.push(...wordErrors(w, tier));
    for (const text of [g.title, g.hint]) {
      for (const token of text.split(/[^A-Za-z]+/)) if (token && isBlocked(token)) errors.push(`${text}: blocked word ${token}`);
    }
  }
  return errors;
}
