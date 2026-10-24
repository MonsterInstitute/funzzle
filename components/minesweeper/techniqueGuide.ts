import type { HintTechnique } from "@/lib/games/minesweeper";

/**
 * Plain-language guides to the solver's techniques: the coach's "Teach me
 * this" and the recap's "Learn …" panel.
 */
export const TECHNIQUE_GUIDE: Record<HintTechnique, { title: string; phrase: string; body: string; unlocks: string }> = {
  "single-flag": {
    title: "Single flag",
    phrase: "a single flag",
    body: "Count a number's hidden neighbors. If a 3 touches exactly three hidden cells (counting flags as mines), every one of them is a mine: flag them all.",
    unlocks: "every board, from the first move",
  },
  "single-safe": {
    title: "Single safe",
    phrase: "a single safe cell",
    body: "When a number already touches that many flags, it has all its mines. Every other hidden cell around it is safe, so open them, or tap the number to chord.",
    unlocks: "every board",
  },
  "1-1 pattern": {
    title: "1-1 pattern",
    phrase: "a 1-1 pattern",
    body: "Two 1s side by side along an edge share most of their hidden cells. If every hidden cell of the first 1 also touches the second, the second 1's mine is in that shared part, so its other hidden cells are safe.",
    unlocks: "Intermediate boards",
  },
  "1-2 pattern": {
    title: "1-2 pattern",
    phrase: "a 1-2 pattern",
    body: "A 2 next to a 1: the 1 allows at most one mine in the cells they share, so the 2 needs another mine in a cell the 1 doesn't touch. When there's only one such cell, flag it.",
    unlocks: "Intermediate and Expert boards",
  },
  subset: {
    title: "Subset",
    phrase: "a subset",
    body: "If all the hidden cells around one number also touch a second number, the first one's mines are part of the second's. Subtract: the second number's other cells hold exactly the difference, which often makes them all safe or all mines.",
    unlocks: "Intermediate and Expert boards",
  },
  "frontier enumeration": {
    title: "Frontier enumeration",
    phrase: "a frontier enumeration",
    body: "When no pair of numbers settles anything, take a short stretch of the edge and try every way of placing mines that fits all its numbers. A cell that's safe (or a mine) in every one of those ways is settled.",
    unlocks: "Expert boards",
  },
  "mine count": {
    title: "Mine count",
    phrase: "the mine count",
    body: "Near the end, check the counter. If the numbers allow a few layouts but only some use exactly the mines that are left, those decide it. With zero mines left, every hidden cell is safe.",
    unlocks: "the last few cells of a board",
  },
  mistake: {
    title: "Checking your flags",
    phrase: "a flag check",
    body: "A wrong flag makes the numbers around it lie. When a deduction doesn't add up, recount the flags around the numbers you used and take off any you can't prove.",
    unlocks: "clean boards",
  },
  "tough-spot": {
    title: "Tough spots",
    phrase: "a tough spot",
    body: "Look for two numbers whose hidden cells overlap and compare what each one still needs. Most stuck spots open up once you subtract one from the other.",
    unlocks: "Expert boards",
  },
};
