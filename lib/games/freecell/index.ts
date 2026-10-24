/**
 * FreeCell engine for Daily FreeCell: rules with supermoves and safe
 * auto-moves, a solver that proves daily deals winnable, and the AI Coach.
 * Pure TypeScript with no dependencies, so it runs the same in the browser
 * and in a Worker.
 */

export { cardLabel, SUITS, type Card, type Suit } from "@/lib/games/solitaire/cards";
export {
  CELLS,
  COLUMNS,
  applyMove,
  autoMoves,
  deal,
  emptyColumns,
  freeCells,
  isLegal,
  isSafeHome,
  isWon,
  legalMoves,
  maxRun,
  positionKey,
  runLength,
  type Move,
  type State,
} from "./engine";
export { dailyDeal, knownLine, rememberWinningLine, solve, type SolveResult } from "./solver";
export { bestMove, describeMove, type Hint, type Reason } from "./coach";
