import type { Technique } from "@/lib/games/nonogram";

/**
 * Plain-language technique guides: the coach's "Teach me this" and the
 * recap's "Learn …" panel.
 */
export const TECHNIQUE_GUIDE: Record<Technique, { title: string; phrase: string; body: string; unlocks: string }> = {
  "simple-boxes": {
    title: "Simple boxes",
    phrase: "simple boxes (the overlap)",
    body: "Take a line's clue and push all its blocks as far left as they go, then as far right. If a block covers the same cells in both positions, those cells are filled wherever the block really sits. A 7 in a line of 10 can slide 3 cells, so its middle 4 cells are always filled.",
    unlocks: "the first move in every puzzle",
  },
  "simple-spaces": {
    title: "Simple spaces",
    phrase: "simple spaces",
    body: "Cross off what can't be filled: every cell of a line with clue 0, the leftovers once a line's blocks are all in place, and any cell no block can reach with the marks you already have.",
    unlocks: "clean, quick 5 × 5 solves",
  },
  "edge-logic": {
    title: "Edge logic",
    phrase: "edge logic",
    body: "A filled cell near the edge or next to a crossed-off cell can only belong to one block, and that block can't slide past the wall. If row 1 starts with a filled cell and its first clue is 4, the first 4 cells are filled and the 5th is empty. Use your marks to push each block as far as it can go both ways: what it covers both times is filled.",
    unlocks: "every 10 × 10 and 15 × 15 puzzle",
  },
  forcing: {
    title: "Forcing",
    phrase: "forcing",
    body: "When the quick rules stop, picture every way the clue's blocks could still sit in the line, given your marks. A cell that comes out filled in all of them is filled; one that comes out empty in all of them is empty.",
    unlocks: "the trickiest 15 × 15 lines",
  },
  contradiction: {
    title: "Contradiction",
    phrase: "a contradiction check",
    body: "Assume a cell is filled and follow the clues. If some line can no longer fit its clue, the assumption was wrong, so the cell is empty. Funzzle's puzzles never need this, but it's always a way forward.",
    unlocks: "puzzles beyond line logic",
  },
};
