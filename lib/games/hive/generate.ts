/**
 * Spelling Hive generator. SERVER ONLY: it imports the full lexicon.
 *
 * A hive is a pure function of its seed ("spelling-hive:2026-10-24" for the
 * daily): pick a seven-letter pangram word from the common tier (no "s", so
 * plurals don't flood the list), then choose the center letter so the common
 * answer list has 20–60 words. Every pangram seed is itself an answer, so each
 * hive has at least one pangram.
 */
import { createRng } from "@/lib/games/kit/rng";
import { isBlocked } from "@/lib/games/words/blocklist";
import { letterMask, pangramCandidates, wordsFromLetters } from "@/lib/games/words/lexicon";
import { letterSet, maxScoreOf, MIN_LENGTH, type HivePuzzle } from "./hive";

export const MIN_ANSWERS = 20;
export const MAX_ANSWERS = 60;
const MAX_ATTEMPTS = 400;

let seedMasks: number[] | null = null;

/** Distinct seven-letter sets that have a common, unblocked pangram, in a stable order. */
function letterSets(): number[] {
  if (!seedMasks) {
    const masks = new Set<number>();
    for (const w of pangramCandidates({ distinct: 7, tier: "common", excludeLetters: "s" })) {
      if (!isBlocked(w)) masks.add(letterMask(w));
    }
    seedMasks = [...masks].sort((a, b) => a - b);
  }
  return seedMasks;
}

const lettersOf = (mask: number) =>
  Array.from({ length: 26 }, (_, i) => (mask & (1 << i) ? String.fromCharCode(97 + i) : "")).join("");

/** Try one letter set with a given center; null when it doesn't make a good hive. */
export function buildHive(letters: string, center: string, outerOrder?: string): HivePuzzle | null {
  const common = wordsFromLetters(letters, { minLength: MIN_LENGTH, tier: "common", mustInclude: center }).filter((w) => !isBlocked(w));
  if (common.length < MIN_ANSWERS || common.length > MAX_ANSWERS) return null;
  const set = letterSet({ center, outer: letters });
  const pangrams = common.filter((w) => [...set].every((l) => w.includes(l)));
  if (!pangrams.length) return null;
  const commonSet = new Set(common);
  const bonus = wordsFromLetters(letters, { minLength: MIN_LENGTH, tier: "valid", mustInclude: center }).filter((w) => !commonSet.has(w) && !isBlocked(w));
  const answers = [...common].sort();
  return {
    center,
    outer: outerOrder ?? letters.replace(center, ""),
    answers,
    bonus: bonus.sort(),
    pangrams: pangrams.sort(),
    maxScore: maxScoreOf(answers, set),
  };
}

export function generateHive(seed: string): HivePuzzle {
  const rng = createRng(seed);
  const sets = letterSets();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const letters = lettersOf(sets[rng.int(sets.length)]);
    const centers = rng.shuffle(letters.split(""));
    const outerFor = (c: string) => rng.shuffle(letters.replace(c, "").split("")).join("");
    // One scan per letter set, then filter by center.
    const all = wordsFromLetters(letters, { minLength: MIN_LENGTH, tier: "common" }).filter((w) => !isBlocked(w));
    for (const center of centers) {
      const n = all.reduce((k, w) => k + (w.includes(center) ? 1 : 0), 0);
      if (n < MIN_ANSWERS || n > MAX_ANSWERS) continue;
      const hive = buildHive(letters, center, outerFor(center));
      if (hive) return hive;
    }
  }
  throw new Error(`spelling hive: no hive for seed ${seed}`);
}
