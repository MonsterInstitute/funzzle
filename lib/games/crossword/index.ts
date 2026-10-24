/**
 * Crossword engine, browser-safe part: grid numbering and validation, the
 * puzzle type, the coach's hint ladder and the fallback bank. The fill
 * (fill.ts, generate.ts) imports the full lexicon and is for the cron only.
 */
export type { Direction, Entry } from "./grid";
export { BLACK, cellNumbers, entriesOf, entryText, gridProblems, isBlack, sizeOf, templateOf } from "./grid";
export type { CrosswordPuzzle } from "./puzzle";
export { clueProblems, cluedEntries, crosswordProblems, stemOf } from "./puzzle";
export type { CrosswordHint } from "./coach";
export { answerOf, crosswordHint, entryLabel } from "./coach";
export { bankIndexFor, fallbackDailyCrossword, practiceCrossword } from "./daily";
export { BANK } from "./bank";
