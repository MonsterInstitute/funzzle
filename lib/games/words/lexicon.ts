/**
 * The full 3-15 letter lexicon (~61k words, ~250 KB gzip). GENERATOR-SIDE
 * ONLY: import it from build scripts, cron jobs and Workers routes that create
 * daily puzzles, never from a client component. Each daily puzzle should ship
 * its own answer / valid-word list to the browser instead.
 *
 * Need just one length in the browser? Import `./data/lenNN` and wrap it in
 * `PackedWords` (5 letters: use `./words5`).
 *
 * Tiers:
 *   "common" — SCOWL size <= 35: everyday words, eligible as answers.
 *   "valid"  — SCOWL size <= 50 (superset of common): accepted guesses / bonus words.
 * Both are lowercase a-z, no proper nouns, abbreviations or blocklisted words.
 */
import * as L03 from "./data/len03";
import * as L04 from "./data/len04";
import * as L05 from "./data/len05";
import * as L06 from "./data/len06";
import * as L07 from "./data/len07";
import * as L08 from "./data/len08";
import * as L09 from "./data/len09";
import * as L10 from "./data/len10";
import * as L11 from "./data/len11";
import * as L12 from "./data/len12";
import * as L13 from "./data/len13";
import * as L14 from "./data/len14";
import * as L15 from "./data/len15";
import { PackedWords, UnionWords, type WordList } from "./packed";

export type Tier = "common" | "valid";

export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 15;

const MODULES = [L03, L04, L05, L06, L07, L08, L09, L10, L11, L12, L13, L14, L15];

interface Bucket {
  common: PackedWords;
  extra: PackedWords;
  valid: WordList;
}

let buckets: Map<number, Bucket> | null = null;

function bucket(len: number): Bucket | undefined {
  if (!buckets) {
    buckets = new Map();
    for (const m of MODULES) {
      const common = new PackedWords(m.COMMON, m.LENGTH);
      const extra = new PackedWords(m.EXTRA, m.LENGTH);
      buckets.set(m.LENGTH, { common, extra, valid: new UnionWords([common, extra]) });
    }
  }
  return buckets.get(len);
}

const EMPTY: WordList = new UnionWords([]);

/** Words of exactly `len` letters in a tier (common words first, then the rest). */
export function wordsOfLength(len: number, tier: Tier = "valid"): WordList {
  const b = bucket(len);
  if (!b) return EMPTY;
  return tier === "common" ? b.common : b.valid;
}

/** Accepted word (valid tier). Case-insensitive. */
export function isWord(word: string): boolean {
  const b = bucket(word.length);
  return !!b && b.valid.has(word);
}

/** Everyday word (common tier). Case-insensitive. */
export function isCommon(word: string): boolean {
  const b = bucket(word.length);
  return !!b && b.common.has(word);
}

/** 26-bit mask of the distinct letters in `s` (a = bit 0). Non a-z chars give -1. */
export function letterMask(s: string): number {
  let m = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) | 0x20; // ASCII lowercase
    const bit = c - 97;
    if (bit < 0 || bit > 25) return -1;
    m |= 1 << bit;
  }
  return m;
}

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

export interface FromLettersOptions {
  minLength?: number;
  maxLength?: number;
  /** Every one of these letters must appear (Spelling Hive: the center letter). */
  mustInclude?: string;
  tier?: Tier;
  /**
   * true (default): letters may be reused any number of times (Spelling Hive,
   * Letter Box). false: each letter at most as often as it appears in `letters`.
   */
  reuse?: boolean;
}

/**
 * Words spelled only from `letters`, sorted by length then alphabetically.
 * Scans the whole tier (a few ms); meant for generators.
 */
export function wordsFromLetters(letters: string, opts: FromLettersOptions = {}): string[] {
  const { minLength = MIN_WORD_LENGTH, maxLength = MAX_WORD_LENGTH, tier = "valid", reuse = true } = opts;
  const allowed = letterMask(letters);
  const required = letterMask(opts.mustInclude ?? "");
  if (allowed < 0 || required < 0) throw new Error("letters must be a-z");
  const counts = new Array<number>(26).fill(0);
  for (const ch of letters.toLowerCase()) counts[ch.charCodeAt(0) - 97]++;

  const out: string[] = [];
  const lo = Math.max(minLength, MIN_WORD_LENGTH);
  const hi = Math.min(maxLength, MAX_WORD_LENGTH, reuse ? MAX_WORD_LENGTH : letters.length);
  const used = new Array<number>(26);
  for (let len = lo; len <= hi; len++) {
    const list = wordsOfLength(len, tier);
    for (let i = 0; i < list.size; i++) {
      const w = list.at(i);
      const m = letterMask(w);
      if ((m & ~allowed) !== 0 || (m & required) !== required) continue;
      if (!reuse) {
        used.fill(0);
        let ok = true;
        for (let j = 0; j < w.length && ok; j++) {
          const k = w.charCodeAt(j) - 97;
          if (++used[k] > counts[k]) ok = false;
        }
        if (!ok) continue;
      }
      out.push(w);
    }
  }
  return out.sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
}

export interface PangramOptions {
  /** Distinct letters a pangram uses (Spelling Hive: 7). */
  distinct?: number;
  tier?: Tier;
  /** Skip words containing any of these letters (e.g. "s" to avoid plural-heavy hives). */
  excludeLetters?: string;
}

/** Words with exactly `distinct` distinct letters: candidate Spelling Hive pangrams, sorted. */
export function pangramCandidates(opts: PangramOptions = {}): string[] {
  const { distinct = 7, tier = "common", excludeLetters = "" } = opts;
  const banned = letterMask(excludeLetters);
  const out: string[] = [];
  for (let len = Math.max(distinct, MIN_WORD_LENGTH); len <= MAX_WORD_LENGTH; len++) {
    const list = wordsOfLength(len, tier);
    for (let i = 0; i < list.size; i++) {
      const w = list.at(i);
      const m = letterMask(w);
      if ((m & banned) === 0 && popcount(m) === distinct) out.push(w);
    }
  }
  return out.sort();
}

/**
 * Words matching a pattern with "." or "?" as a wildcard ("c.a.e" -> crane,
 * crate, ...). For crossword fill. Sorted, common words first.
 */
export function matchPattern(pattern: string, tier: Tier = "valid"): string[] {
  const p = pattern.toLowerCase();
  const list = wordsOfLength(p.length, tier);
  const fixed: [number, string][] = [];
  for (let i = 0; i < p.length; i++) if (p[i] !== "." && p[i] !== "?") fixed.push([i, p[i]]);
  const out: string[] = [];
  for (let i = 0; i < list.size; i++) {
    const w = list.at(i);
    if (fixed.every(([j, c]) => w[j] === c)) out.push(w);
  }
  return out;
}
