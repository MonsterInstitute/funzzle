/**
 * Theme validation against the dictionary. GENERATOR-SIDE ONLY (imports the
 * full lexicon): the cron checks DeepSeek's themes with it, and the tests
 * check the fallback bank.
 */
import { isBlocked } from "../words/blocklist";
import { isWord } from "../words/lexicon";
import { MAX_LETTERS, MIN_LETTERS, type Theme } from "./generate";

/** Lowercase, single dictionary words of 3–12 letters, no blocked words, no duplicates. */
export function cleanThemeWords(words: unknown[]): string[] {
  const out: string[] = [];
  for (const raw of words) {
    if (typeof raw !== "string") continue;
    const w = raw.trim().toLowerCase();
    if (!/^[a-z]+$/.test(w) || w.length < MIN_LETTERS || w.length > MAX_LETTERS) continue;
    if (!isWord(w) || isBlocked(w) || out.includes(w)) continue;
    out.push(w);
  }
  return out;
}

/** Problems with a theme (empty = usable). */
export function themeProblems(t: Theme, minWords = 14): string[] {
  const out: string[] = [];
  if (!/^[A-Za-z][A-Za-z' &-]{1,30}$/.test(t.title)) out.push(`title ${JSON.stringify(t.title)}`);
  if (isBlocked(t.title.replace(/[^a-z]/gi, ""))) out.push("blocked title");
  const clean = cleanThemeWords(t.words);
  const bad = t.words.filter((w) => !clean.includes(w));
  if (bad.length) out.push(`not usable: ${bad.join(", ")}`);
  if (clean.length < minWords) out.push(`only ${clean.length} usable words`);
  return out;
}
