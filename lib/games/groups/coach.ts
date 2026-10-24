/**
 * Groups coach: a three-rung hint ladder for the easiest group still on the
 * board (point to one of its words → a theme hint → reveal the group), the
 * skills a finished game earned, and the recap's key move / next skill.
 */
import type { GroupsPuzzle, Level } from "./puzzle";

export interface GroupsHint {
  /** Index of the group the hint is about (the lowest level still unsolved). */
  group: number;
  level: Level;
  /** The word rung 1 points to. */
  word: string;
  nudge: string;
  theme: string;
  answer: string;
}

const display = (w: string) => w.toUpperCase();

/**
 * The hint for the easiest unsolved group. `board` is the current tile order;
 * rung 1 points to that group's first word on the board, so the nudge is
 * about a tile the player can see. Null when every group is solved.
 */
export function hintFor(puzzle: GroupsPuzzle, solved: number[], board: string[]): GroupsHint | null {
  const group = puzzle.groups.findIndex((_, i) => !solved.includes(i));
  if (group < 0) return null;
  const g = puzzle.groups[group];
  const word = board.find((w) => g.words.includes(w as never)) ?? g.words[0];
  return {
    group,
    level: g.level,
    word,
    nudge: `Start with ${display(word)}. It belongs to the most direct group left on the board. Which three other words go with it?`,
    theme: `${display(word)}’s group: ${g.hint}.`,
    answer: `${g.title}: ${g.words.map(display).join(", ")}.`,
  };
}

export interface FinishFacts {
  won: boolean;
  mistakes: number;
  hints: number;
  timeMs: number;
  /** Group indices in the order they were found (coach reveals included). */
  solveOrder: number[];
  /** Groups the coach revealed. */
  coached: number[];
}

/** Skill ids a finished game earned (SKILL_TREES.groups in lib/games/kit/achievements.ts). */
export function earnedSkills(f: FinishFacts): string[] {
  if (!f.won) return [];
  const out = ["solve"];
  const mine = f.solveOrder.filter((g) => !f.coached.includes(g));
  if (!f.hints) out.push("no-hint");
  if (!f.mistakes) out.push("perfect");
  if (f.mistakes === 3) out.push("comeback");
  if (f.timeMs < 120_000) out.push("fast");
  if (f.solveOrder[0] === 3 && mine[0] === 3) out.push("trickiest-first");
  if (!f.coached.length && f.solveOrder.join("") === "3210") out.push("reverse");
  if (!f.mistakes && !f.hints) out.push("flawless");
  return out;
}

/** Recap order of skills to suggest next (first one not yet earned). */
const NEXT: { id: string; text: string }[] = [
  { id: "no-hint", text: "Solve one without the coach. Say each word out loud and listen for a second meaning." },
  { id: "perfect", text: "A perfect solve: no mistakes. Only submit a four once you can name its link." },
  { id: "trickiest-first", text: "Find the level 4 group first. It’s usually wordplay: hidden words, sounds or a missing word." },
  { id: "fast", text: "Solve in under two minutes. Lock in the group you’re surest of first; it shrinks the board." },
  { id: "flawless", text: "Flawless: no mistakes and no hints in the same game." },
  { id: "reverse", text: "Upside down: solve level 4, then 3, 2 and 1, in that order." },
];

export function nextSkill(earnedNow: string[], earnedBefore: Record<string, number>): string {
  const has = (id: string) => earnedNow.includes(id) || (earnedBefore[id] ?? 0) > 0;
  return (NEXT.find((n) => !has(n.id)) ?? NEXT[NEXT.length - 1]).text;
}

export const LEARN = {
  title: "How to spot the tricky group",
  body:
    "Most boards hide one plain category, two that need a second thought and one built on wordplay. Before you submit, look for words that could belong to two groups: the extra one is a decoy. For the trickiest group try four tests: does each word hide a smaller word, sound like something else, complete a phrase with the same missing word (___ball, pine ___), or share a pattern like anagrams? When you can name the link out loud, you’re ready to submit.",
};
