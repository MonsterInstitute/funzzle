/**
 * Word Hunt engine, browser-safe parts: board geometry, the generator and the
 * coach's hint ladder. Server-only pieces (bonus words from the full lexicon,
 * the fallback bank as playable puzzles, theme validation) live in server.ts,
 * bonus.ts and validate.ts and must not be imported from client components.
 */

export type { PlacedWord, WordHuntPuzzle, WordHuntTheme } from "./types";
export { CELLS, COLS, NEIGHBORS, ROWS, adjacent, cellAt, colOf, diagonalOf, isPath, rowOf, spanSides, spell, touchesOppositeSides, tracePaths } from "./grid";
export { generateWordHunt, partitionable, shapeProblems, TilingError, type GeneratedGrid } from "./generate";
export { hintLadder, pickHintWord, type HintLadder } from "./coach";
