/**
 * Chess for Funzzle: rules (FEN, SAN, every draw rule), an alpha-beta engine
 * with six playing levels, the coach's best move with a plain-English why,
 * and daily/practice puzzles from seeded self-play. Pure TypeScript with no
 * dependencies, so it runs the same in the browser, a Web Worker and the
 * Cloudflare Worker that stores the daily puzzle.
 */
export { Position, START_FEN, moveToSan, moveToUci, sanToMove, uciToMove, perft, type GameEnd } from "./position";
export { Searcher, mateIn, MATE, type SearchOptions, type SearchResult } from "./search";
export { analyse, chooseMove, LEVELS, LEVEL_INFO, type Level, type LevelInfo } from "./ai";
export { explainMove, PIECE_NAME, reviewGame, scoreLine, type ChessHint, type GameReview, type HintReason } from "./coach";
export { generatePuzzle, verifyPosition, PUZZLE_DIFFICULTY_LABEL, type ChessPuzzle, type PuzzleDifficulty } from "./puzzle";
export { detectThemes, THEMES, THEME_INFO, type Theme } from "./themes";
export {
  boardArray,
  captured,
  checkSquare,
  END_TEXT,
  legalUiMoves,
  materialBalance,
  pieceLabel,
  replay,
  sanList,
  squareLabel,
  status,
  type PieceCode,
  type Promotion,
  type Status,
  type UiMove,
} from "./game";
