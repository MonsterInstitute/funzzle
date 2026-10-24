import type { Technique } from "@/lib/games/kakuro";

/**
 * Plain-language technique guides: the coach's "Teach me this" and the
 * recap's "Learn …" panel.
 */
export const TECHNIQUE_GUIDE: Record<Technique, { title: string; phrase: string; body: string; unlocks: string }> = {
  "last-cell": {
    title: "Last cell",
    phrase: "a last-cell sum",
    body: "When a run has only one empty cell left, it takes whatever the clue still needs: subtract the digits already there from the clue. A 15 across with 4 and 8 placed leaves 3.",
    unlocks: "the end of every grid",
  },
  "unique-sum": {
    title: "Unique sum",
    phrase: "a unique sum",
    body: "Some sums can only be made one way, so you know their digits before you start. In two cells: 3 = 1 + 2, 4 = 1 + 3, 16 = 7 + 9, 17 = 8 + 9. In three cells: 6 = 1 + 2 + 3, 7 = 1 + 2 + 4, 23 = 6 + 8 + 9, 24 = 7 + 8 + 9. Only the order is left to find.",
    unlocks: "every Easy grid",
  },
  intersection: {
    title: "Intersection",
    phrase: "an intersection",
    body: "Every white cell sits in an across run and a down run, so its digit has to work for both. If the across run allows 1 or 3 and the down run allows 1 or 2, the cell where they cross is 1.",
    unlocks: "Easy and Medium grids",
  },
  "sum-combos": {
    title: "Sum combinations",
    phrase: "sum combinations",
    body: "List the ways to make a run's sum with different digits. A digit that's in none of them can't go anywhere in that run: 10 in two cells is 1 + 9, 2 + 8, 3 + 7 or 4 + 6, so never 5. Bigger runs work the same way: 30 in four cells must use 6, 7, 8 and 9.",
    unlocks: "Medium grids",
  },
  "crossing-elimination": {
    title: "Crossing elimination",
    phrase: "crossing elimination",
    body: "Check each combination of a run against what its crossing runs allow. If one cell can only be 1 or 2 because of its down run, any combination for the across run that needs a bigger digit there drops out. The combinations that survive tell you which digits can go where.",
    unlocks: "Medium and Hard grids",
  },
};
