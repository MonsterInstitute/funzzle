/**
 * Letter Box generator. SERVER ONLY: it imports the full lexicon.
 *
 * A box is a pure function of its seed ("letter-box:2026-10-24" for the
 * daily). It is built backwards from a two-word solution: pick an everyday
 * word, then a second everyday word starting with its last letter so the two
 * together use exactly twelve distinct letters (3–4 of them vowels). Split the
 * twelve letters into four sides of three so neither word has two neighbouring
 * letters on one side (vowels spread across sides where possible). Then the
 * playable list is every dictionary word traceable on that box, and the
 * generator checks there's no one-word solution and, preferably, at least one
 * three-word solution too. Par is the fewest words found: 2.
 */
import { createRng, type Rng } from "@/lib/games/kit/rng";
import { containsBlockedSubstring, isBlocked } from "@/lib/games/words/blocklist";
import { letterMask, wordsFromLetters, wordsOfLength } from "@/lib/games/words/lexicon";
import { FULL, shortestFrom, traceable, wordMask, type LetterBoxPuzzle, type Sides } from "./box";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const MAX_ATTEMPTS = 600;
/** After this many attempts, accept a box without a 3-word solution. */
const STRICT_ATTEMPTS = 400;

interface Cand {
  word: string;
  mask: number;
  distinct: number;
}

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

let pool: { first: Cand[]; byStart: Cand[][] } | null = null;

/** Everyday words that could be one half of a two-word solution. */
function candidates() {
  if (!pool) {
    const all: Cand[] = [];
    for (let len = 4; len <= 12; len++) {
      const list = wordsOfLength(len, "common");
      for (let i = 0; i < list.size; i++) {
        const w = list.at(i);
        if (/(.)\1/.test(w) || isBlocked(w)) continue;
        const mask = letterMask(w);
        const distinct = popcount(mask);
        if (distinct > 11) continue;
        all.push({ word: w, mask, distinct });
      }
    }
    const byStart: Cand[][] = Array.from({ length: 26 }, () => []);
    for (const c of all) byStart[c.word.charCodeAt(0) - 97].push(c);
    pool = { first: all.filter((c) => c.distinct >= 6 && c.distinct <= 9), byStart };
  }
  return pool;
}

/** Adjacent letter pairs that may not share a side. */
function conflicts(words: string[]): Set<string> {
  const s = new Set<string>();
  for (const w of words) for (let i = 1; i < w.length; i++) s.add(`${w[i - 1]}${w[i]}`).add(`${w[i]}${w[i - 1]}`);
  return s;
}

/** Four sides of three with no conflicting pair on a side; null if impossible. */
export function splitSides(letters: string[], bad: Set<string>, rng: Rng, maxVowelsPerSide: number): Sides | null {
  const order = rng.shuffle([...letters]);
  const groups: string[][] = [[], [], [], []];
  let tries = 0;
  const place = (k: number): boolean => {
    if (++tries > 20_000) return false;
    if (k === order.length) return true;
    const ch = order[k];
    for (let g = 0; g < 4; g++) {
      const side = groups[g];
      if (side.length === 3) continue;
      if (side.some((o) => bad.has(`${o}${ch}`))) continue;
      if (VOWELS.has(ch) && side.filter((o) => VOWELS.has(o)).length >= maxVowelsPerSide) continue;
      side.push(ch);
      if (place(k + 1)) return true;
      side.pop();
      // Empty sides are interchangeable: trying the next empty one is redundant.
      if (!side.length) break;
    }
    return false;
  };
  if (!place(0)) return null;
  return rng.shuffle(groups.map((g) => g.join(""))) as Sides;
}

function hasThreeWordSolution(words: string[], sides: Sides): boolean {
  const all = sides.join("");
  const items = words.map((w) => ({ w, s: all.indexOf(w[0]), e: all.indexOf(w[w.length - 1]), m: wordMask(w, sides) }));
  const byStart = Array.from({ length: 12 }, () => [] as typeof items);
  for (const it of items) byStart[it.s].push(it);
  for (const a of items) {
    for (const b of byStart[a.e]) {
      const need = FULL & ~(a.m | b.m);
      if (!need) continue;
      for (const c of byStart[b.e]) if ((c.m & need) === need) return true;
    }
  }
  return false;
}

export function generateLetterBox(seed: string): LetterBoxPuzzle {
  const rng = createRng(seed);
  const { first, byStart } = candidates();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const a = first[rng.int(first.length)];
    const last = a.word.charCodeAt(a.word.length - 1) - 97;
    const partners = byStart[last].filter((b) => b.word !== a.word && popcount(a.mask | b.mask) === 12);
    if (!partners.length) continue;
    const b = partners[rng.int(partners.length)];
    const mask = a.mask | b.mask;
    const letters = Array.from({ length: 26 }, (_, i) => (mask & (1 << i) ? String.fromCharCode(97 + i) : "")).filter(Boolean);
    const vowels = letters.filter((l) => VOWELS.has(l)).length;
    if (vowels < 3 || vowels > 4) continue;
    const bad = conflicts([a.word, b.word]);
    const sides = splitSides(letters, bad, rng, 1) ?? splitSides(letters, bad, rng, 2);
    if (!sides) continue;
    if (sides.some((s) => containsBlockedSubstring(s) || containsBlockedSubstring([...s].reverse().join("")))) continue;

    const box = letters.join("");
    const traced = (tier: "common" | "valid") =>
      wordsFromLetters(box, { minLength: 3, tier }).filter((w) => traceable(w, sides) && !isBlocked(w));
    const common = traced("common");
    const commonSet = new Set(common);
    const rare = traced("valid").filter((w) => !commonSet.has(w));
    const all = [...common, ...rare];
    // No one-word solutions: that would make par meaningless.
    if (all.some((w) => wordMask(w, sides) === FULL)) continue;
    if (attempt < STRICT_ATTEMPTS && !hasThreeWordSolution(common, sides)) continue;
    const solution = shortestFrom(sides, common, [], 2) ?? [a.word, b.word];
    return {
      sides,
      words: [...common.sort(), ...rare.sort()],
      common: common.length,
      par: solution.length,
      solution,
    };
  }
  throw new Error(`letter box: no box for seed ${seed}`);
}
