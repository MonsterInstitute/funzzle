/**
 * Letter Box rules, the shortest-solution search and the coach ladder. Pure
 * and browser-safe: the puzzle ships its own playable word list (see
 * generate.ts, which is server-only).
 *
 * Twelve letters sit three to a side of a square. Words are 3+ letters;
 * consecutive letters must come from different sides; each word starts with
 * the last letter of the previous one. The puzzle is solved when every letter
 * has been used. Fewer words is better.
 */

export type Sides = [string, string, string, string];

export interface LetterBoxPuzzle {
  /** Top, right, bottom, left: three lowercase letters each. */
  sides: Sides;
  /**
   * Every playable word, lowercase: the `common` everyday words first
   * (sorted), then the rarer accepted ones (sorted).
   */
  words: string[];
  /** How many of `words` (from the start) are everyday words. */
  common: number;
  /** Fewest words of the shortest solution the generator found. */
  par: number;
  /** One shortest solution (everyday words). */
  solution: string[];
}

export const MIN_WORD = 3;
export const FULL = (1 << 12) - 1;

export function letters(sides: Sides): string {
  return sides.join("");
}

/** Letter → side index (0–3). */
export function sideMap(sides: Sides): Map<string, number> {
  const m = new Map<string, number>();
  sides.forEach((s, i) => s.split("").forEach((ch) => m.set(ch, i)));
  return m;
}

/** True when `word` can be traced on the box (ignores the dictionary). */
export function traceable(word: string, sides: Sides): boolean {
  const m = sideMap(sides);
  let prev = -1;
  for (const ch of word) {
    const s = m.get(ch);
    if (s === undefined || s === prev) return false;
    prev = s;
  }
  return word.length >= MIN_WORD;
}

/** 12-bit mask of the box positions a word uses. */
export function wordMask(word: string, sides: Sides): number {
  const all = letters(sides);
  let m = 0;
  for (const ch of word) {
    const i = all.indexOf(ch);
    if (i >= 0) m |= 1 << i;
  }
  return m;
}

export function usedMask(words: string[], sides: Sides): number {
  return words.reduce((m, w) => m | wordMask(w, sides), 0);
}

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

export type WordCheck = { ok: true } | { ok: false; reason: "short" | "start" | "unknown" | "side" };

export const REJECT_MESSAGE: Record<Extract<WordCheck, { ok: false }>["reason"], string> = {
  short: "Words need 3 letters or more",
  start: "Start with the last letter of your previous word",
  unknown: "Not in the word list",
  side: "Letters next to each other must come from different sides",
};

export function checkWord(p: LetterBoxPuzzle, played: string[], raw: string): WordCheck {
  const word = raw.toLowerCase();
  if (word.length < MIN_WORD) return { ok: false, reason: "short" };
  const last = played[played.length - 1];
  if (last && word[0] !== last[last.length - 1]) return { ok: false, reason: "start" };
  if (!traceable(word, p.sides)) return { ok: false, reason: "side" };
  if (!p.words.includes(word)) return { ok: false, reason: "unknown" };
  return { ok: true };
}

interface Edge {
  word: string;
  start: number;
  end: number;
  mask: number;
}

/**
 * Fewest further words that use every letter, starting from `played` (or from
 * scratch). Breadth-first over (last letter, letters used); within a level,
 * words covering more new letters are tried first, so the path favours big
 * words. Returns null when no solution of at most `maxWords` more words exists.
 */
export function shortestFrom(sides: Sides, words: string[], played: string[] = [], maxWords = 4): string[] | null {
  const all = letters(sides);
  const edges: Edge[][] = Array.from({ length: 12 }, () => []);
  for (const w of words) {
    const start = all.indexOf(w[0]);
    if (start < 0) continue;
    edges[start].push({ word: w, start, end: all.indexOf(w[w.length - 1]), mask: wordMask(w, sides) });
  }
  const used0 = usedMask(played, sides);
  if (used0 === FULL && played.length) return [];
  const last0 = played.length ? all.indexOf(played[played.length - 1].slice(-1)) : -1;
  type Node = { last: number; used: number; path: string[] };
  let frontier: Node[] = [{ last: last0, used: used0, path: [] }];
  const seen = new Set<number>([(last0 + 1) * 4096 + used0]);
  for (let depth = 0; depth < maxWords; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      const out = node.last < 0 ? edges.flat() : edges[node.last];
      const ranked = [...out].sort((a, b) => popcount(b.mask & ~node.used) - popcount(a.mask & ~node.used) || b.word.length - a.word.length);
      for (const e of ranked) {
        const used = node.used | e.mask;
        if (used === FULL) return [...node.path, e.word];
        const key = (e.end + 1) * 4096 + used;
        if (seen.has(key) || used === node.used) continue;
        seen.add(key);
        next.push({ last: e.end, used, path: [...node.path, e.word] });
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}

/** Shortest solution from `played`, preferring everyday words. */
export function bestPath(p: LetterBoxPuzzle, played: string[], maxWords = 4): string[] | null {
  return shortestFrom(p.sides, p.words.slice(0, p.common), played, maxWords) ?? shortestFrom(p.sides, p.words, played, maxWords);
}

export interface BoxHint {
  /** Rung 1: where to start (or that the chain should restart). */
  nudge: string;
  /** Rung 2: a word's shape and how many new letters it uses. */
  pattern: string;
  patternText: string;
  /** Rung 3: the word. */
  word: string;
  answer: string;
  /** The hint assumes a fresh start (the current chain can't finish well). */
  restart: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Coach ladder from the current position: a good starting letter (or, mid
 * chain, how many words can still finish it), then the next word's shape and
 * how many unused letters it covers, then the word itself, which is the next
 * step of a shortest solution.
 */
export function boxHint(p: LetterBoxPuzzle, played: string[]): BoxHint | null {
  let restart = false;
  let path = played.length ? bestPath(p, played, Math.max(1, p.par + 2 - played.length)) : null;
  if (!path) {
    restart = played.length > 0;
    path = bestPath(p, [], 4);
  }
  if (!path || !path.length) return null;
  const base = restart ? [] : played;
  const word = path[0];
  const used = usedMask(base, p.sides);
  const fresh = popcount(wordMask(word, p.sides) & ~used);
  const L = word[0].toUpperCase();
  const unused = letters(p.sides)
    .split("")
    .filter((_, i) => !(used & (1 << i)))
    .map((c) => c.toUpperCase());
  let nudge: string;
  if (restart) nudge = `This chain is hard to finish. Restart and begin with ${L}: a ${path.length}-word solution starts there.`;
  else if (!base.length) nudge = `Start with ${L}. A ${path.length}-word solution begins there.`;
  else nudge = `From ${L} you can finish in ${plural(path.length, "more word")}. Unused: ${unused.join(", ")}.`;
  const shape = [L, ...Array.from({ length: word.length - 1 }, () => "_")].join(" ");
  return {
    nudge,
    pattern: shape,
    patternText: `A ${word.length}-letter word from ${L} that uses ${plural(fresh, "new letter")}${word.length > 1 ? `, ending in ${word[word.length - 1].toUpperCase()}` : ""}.`,
    word,
    answer: `Play ${word.toUpperCase()}${path.length > 1 ? `, then ${path.length - 1} more` : " to finish"}.`,
    restart,
  };
}
