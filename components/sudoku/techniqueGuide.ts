import type { Technique } from "@/lib/games/sudoku";

/**
 * Plain-language technique guides: the coach's "Teach me this" when no cached
 * AI explanation exists, and the recap's "Learn …" panel.
 */
export const TECHNIQUE_GUIDE: Record<Technique, { title: string; body: string; unlocks: string }> = {
  "naked-single": {
    title: "Naked single",
    body: "List what each empty cell could be: cross out every number already in its row, column and box. When only one number is left, that's the answer.",
    unlocks: "every Easy grid",
  },
  "hidden-single": {
    title: "Hidden single",
    body: "Pick a number and a row, column or box. If that number fits in only one empty cell of that unit, it goes there, even if the cell has other options.",
    unlocks: "Easy and Medium grids",
  },
  pointing: {
    title: "Pointing",
    body: "Inside one box, if a number can only go in cells on the same row (or column), it must be in that box's part of the row. So cross it off the rest of that row outside the box.",
    unlocks: "Medium grids",
  },
  claiming: {
    title: "Claiming",
    body: "The mirror of pointing: if a number's only spots in a row (or column) all sit inside one box, it must go there, so cross it off the box's other cells.",
    unlocks: "Medium grids",
  },
  "naked-pair": {
    title: "Naked pair",
    body: "Two cells in one unit that can only be the same two numbers will take those two numbers between them. Cross both numbers off every other cell in that unit.",
    unlocks: "Hard grids",
  },
  "hidden-pair": {
    title: "Hidden pair",
    body: "If two numbers can only go in the same two cells of a unit, those cells hold that pair. Cross every other number out of those two cells.",
    unlocks: "Hard grids",
  },
  "naked-triple": {
    title: "Naked triple",
    body: "Three cells in a unit whose options together are only three numbers will use exactly those three. Remove them from the unit's other cells.",
    unlocks: "Hard grids",
  },
  "hidden-triple": {
    title: "Hidden triple",
    body: "Three numbers that can only go in the same three cells of a unit fill those cells. Clear any other options from them.",
    unlocks: "Hard grids",
  },
  "x-wing": {
    title: "X-Wing",
    body: "Find a number that fits in exactly two cells in each of two rows, and those cells line up in the same two columns. The number must sit on one diagonal of that rectangle, so cross it off the rest of both columns. It works the same with rows and columns swapped.",
    unlocks: "Expert grids",
  },
  swordfish: {
    title: "Swordfish",
    body: "An X-Wing over three rows: a number's spots in three rows all fall inside the same three columns. It must take one spot per column there, so remove it from the rest of those columns.",
    unlocks: "the hardest Expert grids",
  },
  "xy-wing": {
    title: "XY-Wing",
    body: "A pivot cell with options XY sees two cells with options XZ and YZ. Whatever the pivot becomes, one of those two is Z. So any cell that sees both of them can't be Z.",
    unlocks: "Expert grids",
  },
};
