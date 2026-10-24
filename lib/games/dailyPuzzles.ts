/**
 * Daily puzzles: one per game per UTC day, the same for everyone.
 *
 * The stored row in daily_puzzles is the source of truth (written ahead of
 * time by the answers cron), so a later
 * generator change never swaps a puzzle people are already playing. When the
 * row doesn't exist yet the page generates the same puzzle from the same seed.
 * A database error throws instead: a cached page built from a fallback during
 * an outage could differ from the stored puzzle.
 */
import { generateSudoku, type Grid } from "@/lib/games/sudoku";
import { dailyDeal, type Move, type State } from "@/lib/games/solitaire";
import { dailyDeal as dailyFreeCellDeal, type Move as FreeCellMove, type State as FreeCellState } from "@/lib/games/freecell";
import { dailyBoard, type Board } from "@/lib/games/minesweeper";
import { dailyDeal as mahjongDailyDeal, type LayoutId, type Pair, type State as MahjongState } from "@/lib/games/mahjong";
import { dailyDeal as spiderDailyDeal, type Move as SpiderMove, type State as SpiderState, type SuitCount } from "@/lib/games/spider";
import { MINESWEEPER_DAILY_LEVEL, sudokuDifficultyFor, type SudokuDifficulty } from "./dailySchedule";
import { generateHive } from "@/lib/games/hive/generate";
import type { HivePuzzle } from "@/lib/games/hive";
import { generateLetterBox } from "@/lib/games/letterbox/generate";
import type { LetterBoxPuzzle } from "@/lib/games/letterbox";
import { bankPuzzleFor, type GroupsPuzzle } from "@/lib/games/groups";
import { generatePuzzle, type ChessPuzzle } from "@/lib/games/chess/puzzle";
import { bankMiniFor } from "@/lib/games/mini/bank";
import { clueSetProblems } from "@/lib/games/mini/clues";
import { shapeProblems, type MiniPuzzle } from "@/lib/games/mini/grid";
import { classicAnswer, mathAnswer, quadAnswers, WORD_MODES, type DailyWord, type WordMode } from "@/lib/games/word";
import { geoAnswer } from "@/lib/games/word/geoData";
import type { WordHuntPuzzle } from "@/lib/games/wordhunt";
import { bankIdForDate, bankPuzzle } from "@/lib/games/wordhunt/server";
import { daily2048, type Daily2048 } from "@/lib/games/t2048";
import { dailyBlock, type DailyBlock } from "@/lib/games/block";
import { dailyJigsaw, type DailyJigsaw } from "@/lib/games/jigsaw";
import { all, batch, first, parseJson } from "@/lib/db";
import { fallbackDailyWordSearch, type WordSearchPuzzle } from "@/lib/games/wordsearch";
import { fallbackDailyCrossword, type CrosswordPuzzle } from "@/lib/games/crossword";

export type { Daily2048, DailyBlock, DailyJigsaw };

export interface DailySudoku {
  date: string;
  difficulty: SudokuDifficulty;
  puzzle: Grid;
  solution: Grid;
}

export interface DailySolitaire {
  date: string;
  draw: 1 | 3;
  seed: string;
  state: State;
  /** Winning line found by the solver: proof the deal is winnable. */
  solution: Move[];
}

export interface DailyFreeCell {
  date: string;
  seed: string;
  state: FreeCellState;
  /** Winning line found by the solver: proof the deal is winnable. */
  solution: FreeCellMove[];
}

/** The day's no-guess board (it opens at the center cell), plus its date. */
export interface DailyMinesweeper extends Board {
  date: string;
}

export interface DailyMahjong {
  date: string;
  layout: LayoutId;
  seed: string;
  state: MahjongState;
  /** Winning line replayed to an empty board: proof the deal can be cleared. */
  solution: Pair[];
}

export interface DailySpider {
  date: string;
  suits: SuitCount;
  seed: string;
  state: SpiderState;
  /** Winning line found by the solver: proof the deal is winnable. */
  solution: SpiderMove[];
}

/** Daily Mahjong is always the 144-tile Turtle. */
export const MAHJONG_DAILY_LAYOUT: LayoutId = "turtle";

/** Spelling Hive: the row ships its own answer and bonus lists (lib/games/hive). */
export interface DailyHive extends HivePuzzle {
  date: string;
}

/** Letter Box: the row ships its playable word list (lib/games/letterbox). */
export interface DailyLetterBox extends LetterBoxPuzzle {
  date: string;
}

export interface DailyGroups {
  date: string;
  /** "ai": generated and validated by lib/cron/content/groups.ts; "bank": the fallback bank. */
  source: "ai" | "bank";
  puzzle: GroupsPuzzle;
}

export interface DailyChess {
  date: string;
  /** Found by seeded self-play and checked unique by an exact search. */
  puzzle: ChessPuzzle;
}

export interface DailyMini extends MiniPuzzle {
  date: string;
  /** "generated": filled by lib/games/mini/fill + LLM clues (lib/cron/content/mini.ts); "bank": the hand-clued fallback. */
  source: "generated" | "bank";
  bankId?: string;
}

export interface DailyWordHunt {
  date: string;
  /** "ai": the stored theme from the daily content job; "bank": the hand-written fallback. */
  source: "ai" | "bank";
  puzzle: WordHuntPuzzle;
}

/**
 * Word Search and Crossword rows are written by their content jobs
 * (lib/cron/content/wordsearch.ts, crossword.ts: DeepSeek themes / clues,
 * validated in code), not by ensureDailyPuzzles: a bank row written first
 * would block the LLM one. Without a row the page uses the fallback bank,
 * picked by date, so it never shows an empty puzzle.
 */
export interface DailyWordSearch extends WordSearchPuzzle {
  date: string;
  source: "llm" | "bank";
}

export interface DailyCrossword extends CrosswordPuzzle {
  date: string;
  source: "llm" | "bank";
}

export function generateDailyWordSearch(date: string): DailyWordSearch {
  return { date, source: "bank", ...fallbackDailyWordSearch(date) };
}

export function generateDailyCrossword(date: string): DailyCrossword {
  return { date, source: "bank", ...fallbackDailyCrossword(date) };
}

export async function getDailyWordSearch(date: string): Promise<DailyWordSearch> {
  return (await readRow<DailyWordSearch>("word-search", date, "")) ?? generateDailyWordSearch(date);
}

export async function getDailyCrossword(date: string): Promise<DailyCrossword> {
  return (await readRow<DailyCrossword>("crossword", date, "")) ?? generateDailyCrossword(date);
}

async function readRow<T>(game: string, date: string, variant: string): Promise<T | null> {
  const row = await first<{ data: string }>(
    "SELECT data FROM daily_puzzles WHERE game = ? AND puzzle_date = ? AND variant = ?",
    game,
    date,
    variant
  );
  return row ? parseJson<T>(row.data) : null;
}

export function generateDailySudoku(date: string): DailySudoku {
  const difficulty = sudokuDifficultyFor(date);
  const p = generateSudoku(`sudoku:${date}`, difficulty);
  return { date, difficulty: p.difficulty, puzzle: p.puzzle, solution: p.solution };
}

export function generateDailySolitaire(date: string, draw: 1 | 3): DailySolitaire {
  const d = dailyDeal(date, draw);
  return { date, draw, seed: d.seed, state: d.state, solution: d.solution };
}

export function generateDailyFreeCell(date: string): DailyFreeCell {
  const d = dailyFreeCellDeal(date);
  return { date, seed: d.seed, state: d.state, solution: d.solution };
}

export function generateDailyMinesweeper(date: string): DailyMinesweeper {
  return { date, ...dailyBoard(date, MINESWEEPER_DAILY_LEVEL) };
}

export function generateDailyMahjong(date: string): DailyMahjong {
  const d = mahjongDailyDeal(date, MAHJONG_DAILY_LAYOUT);
  return { date, layout: MAHJONG_DAILY_LAYOUT, seed: d.seed, state: d.state, solution: d.solution };
}

/**
 * Spider deals take ~60 ms to find and prove with 1 suit, but ~0.4–2 s and up
 * to ~250 MB with 2 suits, and ~5–16 s and ~0.4–1 GB with 4 suits. A Worker
 * has 128 MB, so only 1-suit deals are generated here; 2- and 4-suit dailies
 * are generated offline by scripts/pregenerate-spider.ts and stored ahead in
 * daily_puzzles (the answers cron alerts when fewer than 30 days remain).
 */
export function generateDailySpider(date: string, suits: SuitCount): DailySpider {
  const d = spiderDailyDeal(date, suits);
  return { date, suits, seed: d.seed, state: d.state, solution: d.solution };
}

/** 1 suit: the stored row, or the same deal regenerated from its seed. */
export async function getDailySpider(date: string): Promise<DailySpider> {
  return (await readRow<DailySpider>("spider-solitaire", date, "suits1")) ?? generateDailySpider(date, 1);
}

/** The stored row only (null if not pre-generated). The only way pages get a 2- or 4-suit deal. */
export async function getStoredDailySpider(date: string, suits: SuitCount): Promise<DailySpider | null> {
  return readRow<DailySpider>("spider-solitaire", date, `suits${suits}`);
}

/** Days ahead (from today) with stored 2- and 4-suit Spider dailies; the answers cron alerts below 30. */
export async function spiderDaysStored(today: string): Promise<number> {
  const row = await first<{ n: number }>(
    "SELECT count(DISTINCT puzzle_date) AS n FROM daily_puzzles WHERE game = 'spider-solitaire' AND variant = 'suits4' AND puzzle_date >= ?",
    today
  );
  return row?.n ?? 0;
}

export function generateDailyHive(date: string): DailyHive {
  return { date, ...generateHive(`spelling-hive:${date}`) };
}

export function generateDailyLetterBox(date: string): DailyLetterBox {
  return { date, ...generateLetterBox(`letter-box:${date}`) };
}

export async function getDailyHive(date: string): Promise<DailyHive> {
  return (await readRow<DailyHive>("spelling-hive", date, "")) ?? generateDailyHive(date);
}

export async function getDailyLetterBox(date: string): Promise<DailyLetterBox> {
  return (await readRow<DailyLetterBox>("letter-box", date, "")) ?? generateDailyLetterBox(date);
}

/**
 * The fallback Groups daily: a bank puzzle picked by date. Groups rows are
 * written by lib/cron/content/groups.ts (not ensureDailyPuzzles), which
 * stores exactly this fallback for any day that is already live without a
 * row, so a page that served it never changes puzzle mid-day.
 */
export function generateDailyGroups(date: string): DailyGroups {
  return { date, source: "bank", puzzle: bankPuzzleFor(date) };
}

export async function getDailyGroups(date: string): Promise<DailyGroups> {
  return (await readRow<DailyGroups>("groups", date, "")) ?? generateDailyGroups(date);
}

export function generateDailyChess(date: string): DailyChess {
  return { date, puzzle: generatePuzzle(`chess:${date}`) };
}

/** Funzzle Word's daily puzzle for a mode (the stored row's variant is the mode). */
export function generateDailyWord(date: string, mode: WordMode): DailyWord {
  if (mode === "geo") return { date, puzzle: { mode, ...geoAnswer(date) } };
  const answers = mode === "classic" ? [classicAnswer(date)] : mode === "quad" ? quadAnswers(date) : [mathAnswer(date)];
  return { date, puzzle: { mode, answers } };
}

export async function getDailyWord(date: string, mode: WordMode): Promise<DailyWord> {
  return (await readRow<DailyWord>("word", date, mode)) ?? generateDailyWord(date, mode);
}

/**
 * Word Hunt's fallback: a hand-written bank theme picked by date. The daily
 * AI theme is stored by lib/cron/content/wordhunt.ts (ensureWordHuntPuzzles),
 * not by ensureDailyPuzzles: storing the fallback ahead of time would block it.
 */
export function generateDailyWordHunt(date: string): DailyWordHunt {
  return { date, source: "bank", puzzle: bankPuzzle(bankIdForDate(date))! };
}

export async function getDailyWordHunt(date: string): Promise<DailyWordHunt> {
  return (await readRow<DailyWordHunt>("word-hunt", date, "")) ?? generateDailyWordHunt(date);
}

export async function getDailySudoku(date: string): Promise<DailySudoku> {
  return (await readRow<DailySudoku>("sudoku", date, "")) ?? generateDailySudoku(date);
}

export async function getDailySolitaire(date: string, draw: 1 | 3): Promise<DailySolitaire> {
  return (await readRow<DailySolitaire>("solitaire", date, `draw${draw}`)) ?? generateDailySolitaire(date, draw);
}

export async function getDailyMahjong(date: string): Promise<DailyMahjong> {
  return (await readRow<DailyMahjong>("mahjong", date, MAHJONG_DAILY_LAYOUT)) ?? generateDailyMahjong(date);
}

export async function getDailyFreeCell(date: string): Promise<DailyFreeCell> {
  return (await readRow<DailyFreeCell>("freecell", date, "")) ?? generateDailyFreeCell(date);
}

export async function getDailyMinesweeper(date: string): Promise<DailyMinesweeper> {
  return (await readRow<DailyMinesweeper>("minesweeper", date, MINESWEEPER_DAILY_LEVEL)) ?? generateDailyMinesweeper(date);
}

function generateRow(game: string, date: string, variant: string): object {
  if (game === "sudoku") return generateDailySudoku(date);
  if (game === "minesweeper") return generateDailyMinesweeper(date);
  if (game === "freecell") return generateDailyFreeCell(date);
  if (game === "mahjong") return generateDailyMahjong(date);
  if (game === "spider-solitaire") return generateDailySpider(date, 1);
  if (game === "spelling-hive") return generateDailyHive(date);
  if (game === "letter-box") return generateDailyLetterBox(date);
  if (game === "chess") return generateDailyChess(date);
  if (game === "word") return generateDailyWord(date, variant as WordMode);
  if (game === "2048") return daily2048(date);
  if (game === "block-puzzle") return dailyBlock(date);
  if (game === "jigsaw") return dailyJigsaw(date);
  return generateDailySolitaire(date, variant === "draw3" ? 3 : 1);
}

export async function getDailyChess(date: string): Promise<DailyChess> {
  return (await readRow<DailyChess>("chess", date, "")) ?? generateDailyChess(date);
}

/** The hand-clued bank puzzle a date falls back to (lib/games/mini/bank.ts). */
export function fallbackDailyMini(date: string): DailyMini {
  const b = bankMiniFor(date);
  return { date, size: b.size, rows: b.rows, clues: b.clues, source: "bank", bankId: b.id };
}

/**
 * The day's Mini Crossword: the stored row (generated grid + LLM clues,
 * written ahead by lib/cron/content/mini.ts) or the bank fallback. Not part of
 * ensureDailyPuzzles: storing the fallback would block the clued row.
 */
export async function getDailyMini(date: string): Promise<DailyMini> {
  const row = await readRow<DailyMini>("mini-crossword", date, "");
  // A malformed row (hand-edited, older format) must never reach the board.
  if (row && Array.isArray(row.rows) && row.clues && !shapeProblems(row.rows).length && !clueSetProblems(row).length) return row;
  return fallbackDailyMini(date);
}

export async function getDaily2048(date: string): Promise<Daily2048> {
  return (await readRow<Daily2048>("2048", date, "")) ?? daily2048(date);
}

export async function getDailyBlock(date: string): Promise<DailyBlock> {
  return (await readRow<DailyBlock>("block-puzzle", date, "")) ?? dailyBlock(date);
}

export async function getDailyJigsaw(date: string): Promise<DailyJigsaw> {
  return (await readRow<DailyJigsaw>("jigsaw", date, "")) ?? dailyJigsaw(date);
}

/**
 * Store the daily puzzles for `dates` that aren't stored yet. Existing rows are
 * never overwritten. Returns what it wrote.
 */
export async function ensureDailyPuzzles(dates: string[]): Promise<string[]> {
  const wanted = dates.flatMap((date) => [
    { game: "sudoku", date, variant: "" },
    { game: "solitaire", date, variant: "draw1" },
    { game: "solitaire", date, variant: "draw3" },
    { game: "freecell", date, variant: "" },
    { game: "minesweeper", date, variant: MINESWEEPER_DAILY_LEVEL },
    { game: "mahjong", date, variant: MAHJONG_DAILY_LAYOUT },
    // 2- and 4-suit Spider rows come from scripts/pregenerate-spider.ts.
    { game: "spider-solitaire", date, variant: "suits1" },
    { game: "spelling-hive", date, variant: "" },
    { game: "letter-box", date, variant: "" },
    { game: "chess", date, variant: "" },
    ...WORD_MODES.map((variant) => ({ game: "word", date, variant })),
    { game: "2048", date, variant: "" },
    { game: "block-puzzle", date, variant: "" },
    { game: "jigsaw", date, variant: "" },
  ]);
  const existing = await all<{ game: string; puzzle_date: string; variant: string }>(
    `SELECT game, puzzle_date, variant FROM daily_puzzles WHERE puzzle_date IN (${dates.map(() => "?").join(", ")})`,
    ...dates
  );
  const have = new Set(existing.map((r) => `${r.game}|${r.puzzle_date}|${r.variant}`));
  const rows = wanted
    .filter((w) => !have.has(`${w.game}|${w.date}|${w.variant}`))
    .map((w) => ({
      ...w,
      data: generateRow(w.game, w.date, w.variant),
    }));
  if (!rows.length) return [];
  await batch(
    rows.map((r) => [
      "INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
      r.game,
      r.date,
      r.variant,
      JSON.stringify(r.data),
    ])
  );
  return rows.map((r) => `${r.game}${r.variant ? `/${r.variant}` : ""} ${r.date}`);
}
