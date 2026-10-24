/**
 * Clue rules for Mini Crossword, shared by the cron (LLM clues), the bank
 * tests and the browser: every entry has a clue, 3–60 characters, that
 * doesn't give the answer away by containing it or its stem.
 */
import { layoutOf, type MiniPuzzle } from "./grid";

export const CLUE_MIN = 3;
export const CLUE_MAX = 60;

/** Rough stem: plural / verb / comparative endings off ("elves" → "elf", "taken" stays). */
export function stemOf(word: string): string {
  const w = word.toLowerCase();
  const rules: [string, string][] = [
    ["ies", "y"],
    ["ves", "f"],
    ["ing", ""],
    ["ied", "y"],
    ["es", ""],
    ["ed", ""],
    ["er", ""],
    ["ly", ""],
    ["s", ""],
  ];
  for (const [suf, rep] of rules) {
    if (w.endsWith(suf) && w.length - suf.length + rep.length >= 3) return w.slice(0, -suf.length) + rep;
  }
  return w;
}

/** Problems with one clue for `answer` (empty = fine). */
export function clueProblems(answer: string, clue: unknown): string[] {
  if (typeof clue !== "string") return ["missing clue"];
  const text = clue.trim();
  const out: string[] = [];
  if (text.length < CLUE_MIN || text.length > CLUE_MAX) out.push(`length ${text.length} not in ${CLUE_MIN}–${CLUE_MAX}`);
  if (/[\n\r<>{}]/.test(text)) out.push("odd characters");
  const a = answer.toLowerCase();
  const stem = stemOf(a);
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  // Long answers: anywhere inside the clue is a giveaway, even across words
  // ("ice cream" for ICECREAM). Short ones hide inside innocent words (TEN in
  // "often"), so only a word that starts with them, or a form of them, counts.
  const joined = tokens.join("");
  if (a.length >= 5 ? joined.includes(a) : tokens.some((t) => t === a || (a.length === 4 && t.startsWith(a)))) {
    out.push("contains the answer");
  } else if (a.length >= 5 && stem.length >= 4 && tokens.some((t) => t.includes(stem))) {
    out.push("contains the answer's stem");
  } else if (tokens.some((t) => stemOf(t) === stem)) {
    out.push("contains a form of the answer");
  }
  return out;
}

/** Problems with a puzzle's clue set: one valid clue per entry, nothing extra. */
export function clueSetProblems(p: Pick<MiniPuzzle, "rows" | "clues">): string[] {
  const L = layoutOf(p.rows);
  const out: string[] = [];
  const ids = new Set(L.entries.map((e) => e.id));
  for (const e of L.entries) for (const msg of clueProblems(e.answer, p.clues[e.id])) out.push(`${e.id} ${e.answer}: ${msg}`);
  for (const id of Object.keys(p.clues)) if (!ids.has(id)) out.push(`${id}: no such entry`);
  return out;
}
