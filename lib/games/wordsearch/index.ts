/**
 * Word Search engine: seeded grid generation (8 directions, clean filler),
 * the theme bank, daily/practice pickers and the coach's hint ladder.
 * Browser-safe: no lexicon import (validate.ts, which needs it, is for the
 * cron and tests).
 */
export type { PlacedWord, Theme, WordSearchPuzzle, WordSearchSize } from "./generate";
export {
  DIR_DIFFICULTY,
  DIR_PHRASE,
  DIR_SKILL,
  DIRS,
  SIZES,
  WORD_COUNT,
  generateWordSearch,
  gridLines,
  lineCells,
  matchSelection,
  puzzleProblems,
  wordCells,
  WordSearchError,
} from "./generate";
export type { WordSearchHint } from "./coach";
export { hardness, wordSearchHint } from "./coach";
export { DAILY_SIZE, bankThemeFor, fallbackDailyWordSearch, practiceWordSearch } from "./daily";
export { THEMES } from "./themes";
