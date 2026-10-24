/**
 * A finished crossword: the answer grid plus one clue per entry, keyed
 * "12A" / "7D". Validation is shared by the tests (fallback bank) and the
 * cron (DeepSeek's clues) so a puzzle is checked the same way wherever it
 * comes from.
 */
import { isBlocked } from "../words/blocklist";
import { entriesOf, entryText, gridProblems, sizeOf, type Entry } from "./grid";

export interface CrosswordPuzzle {
  title: string;
  size: number;
  /** size × size: "#" black, a-z answer letters. */
  grid: string;
  clues: Record<string, string>;
}

export const CLUE_MIN = 3;
export const CLUE_MAX = 90;

const SUFFIXES = ["ings", "ing", "ies", "ied", "est", "ers", "er", "es", "ed", "ly", "s", "d", "y"];

/** The answer with a common inflection removed ("eluding" → "elud", "stars" → "star"). */
export function stemOf(answer: string): string {
  for (const suf of SUFFIXES) {
    if (answer.endsWith(suf) && answer.length - suf.length >= 3) return answer.slice(0, -suf.length);
  }
  return answer;
}

/** Problems with one clue for one answer (empty = fine). */
export function clueProblems(answer: string, clue: string): string[] {
  const out: string[] = [];
  const a = answer.toLowerCase();
  if (typeof clue !== "string") return ["missing clue"];
  const c = clue.trim();
  if (c.length < CLUE_MIN || c.length > CLUE_MAX) out.push(`length ${c.length}`);
  if (/[<>{}\\]|https?:/i.test(c) || /[\u0000-\u001f]/.test(c)) out.push("markup or control characters");
  if (/\.$/.test(c) && !/\.\.\.$/.test(c)) out.push("trailing period");
  const lower = c.toLowerCase();
  if (lower.split(/[^a-z]+/).some((w) => w.includes(a))) out.push("contains the answer");
  const stem = stemOf(a);
  for (const w of lower.split(/[^a-z]+/).filter(Boolean)) {
    if (w.includes(a)) continue; // reported above
    if (stem.length >= 4 && w.startsWith(stem)) out.push(`"${w}" shares the answer's stem`);
    else if (w.length >= 3 && a.startsWith(w) && w.length >= a.length - 2) out.push(`"${w}" is most of the answer`);
    else if (w.length >= 4 && a.length >= 4 && w.slice(0, 4) === a.slice(0, 4) && stem.length >= 4) out.push(`"${w}" starts like the answer`);
  }
  for (const w of lower.split(/[^a-z]+/).filter((x) => x.length >= 3)) if (isBlocked(w)) out.push(`blocked word "${w}"`);
  return out;
}

/** Problems with a whole puzzle (empty = valid). */
export function crosswordProblems(p: CrosswordPuzzle): string[] {
  const out: string[] = [];
  if (!p.title || p.title.length > 60) out.push("bad title");
  let size: number;
  try {
    size = sizeOf(p.grid);
  } catch (err) {
    return [(err as Error).message];
  }
  if (size !== p.size) out.push(`size ${p.size} but grid is ${size}`);
  if (!/^[a-z#]+$/.test(p.grid)) out.push("grid has letters outside a-z");
  out.push(...gridProblems(p.grid));
  const entries = entriesOf(p.grid);
  const ids = new Set(entries.map((e) => e.id));
  const seen = new Set<string>();
  for (const e of entries) {
    const answer = entryText(p.grid, e);
    if (seen.has(answer)) out.push(`${answer} appears twice`);
    seen.add(answer);
    if (isBlocked(answer)) out.push(`${e.id} ${answer}: blocked`);
    const clue = p.clues[e.id];
    if (!clue) {
      out.push(`${e.id} has no clue`);
      continue;
    }
    for (const problem of clueProblems(answer, clue)) out.push(`${e.id} ${answer}: ${problem} (${clue})`);
  }
  for (const id of Object.keys(p.clues)) if (!ids.has(id)) out.push(`clue ${id} has no entry`);
  return out;
}

/** Entries with their answers and clues, across then down. */
export function cluedEntries(p: CrosswordPuzzle): (Entry & { answer: string; clue: string })[] {
  return entriesOf(p.grid).map((e) => ({ ...e, answer: entryText(p.grid, e), clue: p.clues[e.id] ?? "" }));
}
