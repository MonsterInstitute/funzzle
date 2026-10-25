/**
 * Groups: 16 words, four hidden groups of four. Level 1 is the most
 * straightforward link, level 4 the trickiest (usually wordplay).
 *
 * Words keep their natural case ("apple", "Mars", "hot dog") so the generator
 * can tell everyday words (checked against the lexicon) from proper nouns;
 * the board shows them in capitals. This file is client-safe: the lexicon
 * checks live in ./validate.ts (generators and tests only).
 */
import { createRng } from "@/lib/games/kit/rng";

export type Level = 1 | 2 | 3 | 4;

export interface Group {
  level: Level;
  /** The link, shown when the group is solved. <= 40 chars. */
  title: string;
  /** Coach rung 2: a nudge toward the theme that doesn't give the title away. */
  hint: string;
  words: [string, string, string, string];
}

export interface GroupsPuzzle {
  /** "b07" for the fallback bank, "ai-2026-10-24" for a generated daily. */
  id: string;
  /** Exactly four groups, levels 1–4 in order. */
  groups: [Group, Group, Group, Group];
}

export const LEVELS: Level[] = [1, 2, 3, 4];
export const MAX_WORD_CHARS = 14;
export const MAX_TITLE_CHARS = 40;
export const MAX_HINT_CHARS = 90;

/** Level colors from the Funzzle palette (design/DESIGN.md signature colors). Ink text on all. */
export const LEVEL_COLOR: Record<Level, string> = {
  1: "#9EE6E0",
  2: "#FFC857",
  3: "#FFB8DA",
  4: "#C9B8E8",
};

/** Share-text squares per level (teal, amber, pink, lavender ≈ blue, orange, red, purple). */
export const LEVEL_EMOJI: Record<Level, string> = { 1: "🟦", 2: "🟧", 3: "🟥", 4: "🟪" };

export const LEVEL_NAME: Record<Level, string> = {
  1: "Level 1",
  2: "Level 2",
  3: "Level 3",
  4: "Level 4",
};

/** Comparison key for a word: case and spacing don't make two words different. */
export const wordKey = (w: string) => w.toLowerCase().replace(/[^a-z]/g, "");

export const WORD_RE = /^[A-Za-z](?:[A-Za-z' -]*[A-Za-z])?$/;

/**
 * Shape checks every puzzle must pass (also run in the browser on archive
 * data): four groups with levels 1–4, sixteen distinct words of sane length,
 * short titles and hints that don't contain their own words. Returns the
 * problems found; empty means OK.
 */
export function shapeErrors(p: unknown): string[] {
  const errors: string[] = [];
  const puzzle = p as Partial<GroupsPuzzle> | null;
  if (!puzzle || typeof puzzle !== "object") return ["not an object"];
  if (typeof puzzle.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(puzzle.id)) errors.push("bad id");
  const groups = puzzle.groups;
  if (!Array.isArray(groups) || groups.length !== 4) return [...errors, "need exactly 4 groups"];
  const seen = new Set<string>();
  const titles = new Set<string>();
  groups.forEach((g, i) => {
    const where = `group ${i + 1}`;
    if (!g || typeof g !== "object") return errors.push(`${where}: not an object`);
    if (g.level !== i + 1) errors.push(`${where}: level must be ${i + 1}`);
    if (typeof g.title !== "string" || !g.title.trim() || g.title.length > MAX_TITLE_CHARS) errors.push(`${where}: title must be 1–${MAX_TITLE_CHARS} chars`);
    else if (titles.has(g.title.toLowerCase())) errors.push(`${where}: duplicate title`);
    else titles.add(g.title.toLowerCase());
    if (typeof g.hint !== "string" || !g.hint.trim() || g.hint.length > MAX_HINT_CHARS) errors.push(`${where}: hint must be 1–${MAX_HINT_CHARS} chars`);
    if (!Array.isArray(g.words) || g.words.length !== 4) return errors.push(`${where}: need exactly 4 words`);
    for (const w of g.words) {
      if (typeof w !== "string" || !WORD_RE.test(w) || w.length > MAX_WORD_CHARS || /\s{2}/.test(w)) {
        errors.push(`${where}: bad word ${JSON.stringify(w)}`);
        continue;
      }
      const k = wordKey(w);
      if (seen.has(k)) errors.push(`${where}: duplicate word ${w}`);
      seen.add(k);
      const inText = new RegExp(`\\b${w.toLowerCase().replace(/[^a-z' -]/g, "")}\\b`, "i");
      if (typeof g.title === "string" && inText.test(g.title)) errors.push(`${where}: title gives away ${w}`);
      if (typeof g.hint === "string" && inText.test(g.hint)) errors.push(`${where}: hint gives away ${w}`);
    }
  });
  return errors;
}

export function isPuzzle(p: unknown): p is GroupsPuzzle {
  return shapeErrors(p).length === 0;
}

/** Which group (0–3) a word belongs to; -1 if none. */
export function groupOf(puzzle: GroupsPuzzle, word: string): number {
  return puzzle.groups.findIndex((g) => g.words.includes(word as never));
}

/**
 * The starting tile order, a pure function of the seed. Re-shuffles (still
 * deterministically) when a row of the 4×4 board would hold a whole group.
 */
export function initialOrder(puzzle: GroupsPuzzle, seed: string): string[] {
  const rng = createRng(`groups-order:${seed}`);
  const words = puzzle.groups.flatMap((g) => g.words);
  for (let attempt = 0; ; attempt++) {
    const order = rng.shuffle(words.slice());
    const rowIsGroup = [0, 4, 8, 12].some((r) => new Set(order.slice(r, r + 4).map((w) => groupOf(puzzle, w))).size === 1);
    if (!rowIsGroup || attempt >= 20) return order;
  }
}
