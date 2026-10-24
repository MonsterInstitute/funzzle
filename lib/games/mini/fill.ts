/**
 * Mini Crossword grid fill. GENERATOR-SIDE ONLY (cron, scripts, tests): it
 * imports the full lexicon. A daily grid is a pure function of its seed
 * ("mini-crossword:2026-10-24").
 *
 * Backtracking over the entries with the fewest candidates first (MRV), with
 * candidates from `matchPattern(…, "common")`. Every entry is a common,
 * non-blocked word, no word repeats, and no grid line contains a blocked
 * substring in either direction. Words that are plain inflections (-s, -ed,
 * -ing of another word) are avoided first and only allowed when a grid can't
 * be filled without them.
 */
import { createRng, type Rng } from "../kit/rng";
import { containsBlockedSubstring, isBlocked } from "../words/blocklist";
import { isCommon, isWord, matchPattern } from "../words/lexicon";
import { gridLines, layoutOf, type MiniPuzzle } from "./grid";
import { patterns5, patterns7 } from "./patterns";

export interface FillOptions {
  /** Give up on a pattern after this many search nodes. */
  maxNodes?: number;
  /** Allow plain inflections (plurals, -ed, -ing). Default: only as a fallback. */
  inflections?: boolean;
  /** Words that must not appear (recently used answers, …), lowercase. */
  exclude?: Iterable<string>;
}

export interface FilledGrid {
  size: number;
  rows: string[];
  /** Search nodes used (for timing reports). */
  nodes: number;
}

/** Plain inflection of a shorter valid word: -s, -es, -ies, -ed, -ied, -ing. */
export function isInflection(w: string): boolean {
  if (w.endsWith("ies") && isWord(w.slice(0, -3) + "y")) return true;
  if (w.endsWith("ied") && isWord(w.slice(0, -3) + "y")) return true;
  if (w.endsWith("es") && isWord(w.slice(0, -2))) return true;
  if (w.endsWith("s") && !w.endsWith("ss") && isWord(w.slice(0, -1))) return true;
  for (const suf of ["ed", "ing"]) {
    if (!w.endsWith(suf)) continue;
    const b = w.slice(0, -suf.length);
    if (isWord(b) || isWord(b + "e")) return true;
    if (b.length > 2 && b.at(-1) === b.at(-2) && isWord(b.slice(0, -1))) return true;
  }
  return false;
}

/**
 * Not blocked, but not breakfast-table fill either: bodily fluids, disease,
 * dated or awkward words a casual solver would wince at.
 */
export const MINI_AVOID = new Set([
  "anal", "anus", "enema", "feces", "pus", "puss", "pis", "teat", "teats", "urine", "vomit", "spew", "snot",
  "tumor", "tumors", "cyst", "pimp", "nazi", "nazis", "slave", "slaves", "gypsy", "lynch", "rape", "corpse",
  "booze", "bra", "bras", "barf", "gonad", "colon", "polyp", "ulcer", "fart", "farts", "turd", "poop",
]);

const patternCache = new Map<string, string[]>();
const baseCache = new Map<string, string[]>();

/** Common, non-blocked words matching a pattern ("c.a.e"). Cached. */
function candidates(pattern: string): string[] {
  let list = patternCache.get(pattern);
  if (!list) {
    list = matchPattern(pattern, "common").filter((w) => !isBlocked(w) && !MINI_AVOID.has(w));
    patternCache.set(pattern, list);
  }
  return list;
}

/** candidates() minus plain inflections unless allowed. Cached. */
function baseCandidates(pattern: string, allowInfl: boolean): string[] {
  if (allowInfl) return candidates(pattern);
  let list = baseCache.get(pattern);
  if (!list) {
    list = candidates(pattern).filter((w) => !isInflection(w));
    baseCache.set(pattern, list);
  }
  return list;
}

/**
 * Fill one black-square pattern ("." open, "#" black). Returns uppercase rows,
 * or null when no fill was found within the node budget.
 */
export function fillPattern(pattern: string[], rng: Rng, opts: FillOptions = {}, stats?: { nodes: number }): FilledGrid | null {
  const size = pattern.length;
  const L = layoutOf(pattern);
  const slots = L.entries.map((e) => e.cells);
  const letters: string[] = Array.from(pattern.join(""), (ch) => (ch === "#" ? "#" : "."));
  const filled = new Array<string | null>(slots.length).fill(null);
  const used = new Set<string>(opts.exclude ?? []);
  const maxNodes = opts.maxNodes ?? 20_000;
  const allowInfl = opts.inflections ?? false;
  let nodes = 0;

  const patternOf = (s: number) => slots[s].map((i) => letters[i]).join("");
  // Long lists only need a size estimate; short ones are filtered exactly so
  // a dead end (every match already used) is caught early.
  const options = (s: number) => {
    const list = baseCandidates(patternOf(s), allowInfl);
    return list.length > 64 ? list : list.filter((w) => !used.has(w));
  };

  const rec = (): boolean => {
    if (++nodes > maxNodes) return false;
    // Most constrained open slot.
    let best = -1;
    let bestList: string[] = [];
    for (let s = 0; s < slots.length; s++) {
      if (filled[s] !== null) continue;
      const list = options(s);
      if (!list.length) return false;
      if (best < 0 || list.length < bestList.length) {
        best = s;
        bestList = list;
        if (list.length === 1) break;
      }
    }
    if (best < 0) return true;
    const order = rng.shuffle(bestList.filter((w) => !used.has(w)));
    for (const w of order) {
      const prev = slots[best].map((i) => letters[i]);
      slots[best].forEach((i, k) => (letters[i] = w[k]));
      filled[best] = w;
      used.add(w);
      // Slots completed by this word's crossings must be words too (handled by
      // `options` returning [] when the full pattern isn't an unused word).
      if (rec()) return true;
      used.delete(w);
      filled[best] = null;
      slots[best].forEach((i, k) => (letters[i] = prev[k]));
      if (nodes > maxNodes) return false;
    }
    return false;
  };

  const ok = rec();
  if (stats) stats.nodes = Math.min(nodes, maxNodes);
  if (!ok) return null;
  const rows = Array.from({ length: size }, (_, r) => letters.slice(r * size, r * size + size).join("").toUpperCase());
  if (gridLines(rows).some(containsBlockedSubstring)) return null;
  return { size, rows, nodes };
}

/**
 * A filled grid for a seed: picks a pattern with the seeded RNG and fills it,
 * moving on to the next pattern when one runs out of budget.
 */
export function generateGrid(seed: string, size: 5 | 7 = 5, opts: FillOptions & { totalNodes?: number } = {}): FilledGrid {
  const rng = createRng(seed);
  // 7×7: many patterns tried briefly beats a few tried long (measured: 1–4 s
  // for a fill without inflections at 3,000 nodes per pattern).
  const total = opts.totalNodes ?? (size === 7 ? 200_000 : 1_000_000);
  const perPattern = opts.maxNodes ?? (size === 7 ? 3_000 : 20_000);
  let spent = 0;
  const all = size === 7 ? patterns7() : patterns5();
  // Grids with a few black squares fill fastest and read best; an open 5×5 is
  // a rare treat. Weight: 0 black → 1, 2 → 3, 4 → 4.
  const weighted = all.flatMap((p) => {
    const b = p.join("").split("#").length - 1;
    return Array<string[]>(size === 7 ? 1 : b === 0 ? 1 : b === 2 ? 3 : 4).fill(p);
  });
  const order = rng.shuffle(weighted.slice());
  const seen = new Set<string>();
  for (const allowInfl of opts.inflections === undefined ? [false, true] : [opts.inflections]) {
    seen.clear();
    for (const p of order) {
      const key = p.join("/");
      if (seen.has(key)) continue;
      seen.add(key);
      const budget = Math.min(perPattern, total - spent);
      if (budget <= 0) break;
      const stats = { nodes: 0 };
      const g = fillPattern(p, rng, { ...opts, maxNodes: budget, inflections: allowInfl }, stats);
      spent += stats.nodes;
      if (g) return { ...g, nodes: spent };
    }
  }
  throw new Error(`no ${size}×${size} fill for ${seed} within ${total} nodes`);
}

/** Entries of a filled grid as lowercase words. */
export function gridWords(rows: string[]): string[] {
  return layoutOf(rows).entries.map((e) => e.answer.toLowerCase());
}

/** A complete puzzle (rows + clues) passes the word rules. Returns problems. */
export function wordProblems(p: Pick<MiniPuzzle, "rows">): string[] {
  const out: string[] = [];
  const words = gridWords(p.rows);
  const seen = new Set<string>();
  for (const w of words) {
    if (!/^[a-z]{3,}$/.test(w)) out.push(`${w}: not a 3+ letter word`);
    else if (!isCommon(w)) out.push(`${w}: not a common word`);
    if (isBlocked(w)) out.push(`${w}: blocked`);
    if (MINI_AVOID.has(w)) out.push(`${w}: avoided`);
    if (seen.has(w)) out.push(`${w}: repeated`);
    seen.add(w);
  }
  if (gridLines(p.rows).some(containsBlockedSubstring)) out.push("a grid line contains a blocked string");
  return out;
}

/** Saturday is the big one: a 7×7 when one fills within budget, else a 5×5. */
export const isBigDay = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() === 6;

/** The generated grid for a daily date: a pure function of the date. */
export function dailyGrid(date: string, opts: FillOptions = {}): FilledGrid {
  if (isBigDay(date)) {
    try {
      return generateGrid(`mini-crossword:${date}:7`, 7, opts);
    } catch {
      // Fall through to the regular size.
    }
  }
  return generateGrid(`mini-crossword:${date}`, 5, opts);
}
