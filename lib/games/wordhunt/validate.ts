/**
 * Strict checks for a Word Hunt theme (bank themes in tests, AI themes in the
 * daily content job). GENERATOR-SIDE ONLY: imports the full lexicon.
 */
import { isBlocked } from "@/lib/games/words/blocklist";
import { isCommon, isWord } from "@/lib/games/words/lexicon";
import { shapeProblems } from "./generate";
import type { WordHuntTheme } from "./types";

/**
 * A dictionary word (valid tier), or a clear common phrase written without
 * spaces: two or three common words of 3+ letters ("icecream", "toothbrush").
 * Returns the parts, or null.
 */
export function wordParts(word: string): string[] | null {
  const w = word.toLowerCase();
  if (isWord(w)) return [w];
  const split = (s: string, parts: number): string[] | null => {
    if (parts === 1) return s.length >= 3 && isCommon(s) ? [s] : null;
    for (let i = 3; i <= s.length - 3; i++) {
      const head = s.slice(0, i);
      if (!isCommon(head)) continue;
      const tail = split(s.slice(i), parts - 1);
      if (tail) return [head, ...tail];
    }
    return null;
  };
  return split(w, 2) ?? split(w, 3);
}

export function themeProblems(theme: Pick<WordHuntTheme, "title" | "span" | "words">): string[] {
  const out = shapeProblems(theme);
  const title = theme.title.trim();
  if (title.length < 3 || title.length > 40) out.push("the title must be 3–40 characters");
  if (!/^[A-Za-z0-9 ,'’&!?:.-]+$/.test(title)) out.push("the title has unusual characters");
  for (const w of [theme.span, ...theme.words]) {
    const lower = w.toLowerCase();
    if (!/^[a-z]+$/.test(lower)) continue; // reported by shapeProblems
    const parts = wordParts(lower);
    if (!parts) out.push(`"${w}" is not a dictionary word or a clear compound`);
    if (isBlocked(lower) || parts?.some(isBlocked)) out.push(`"${w}" is not allowed`);
    if (title.toLowerCase().includes(lower)) out.push(`the title gives away "${w}"`);
  }
  if (title.split(/[^A-Za-z]+/).some((t) => t && isBlocked(t))) out.push("the title is not allowed");
  return out;
}
