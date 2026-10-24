/**
 * Spider Solitaire engine: rules, a solver that proves daily deals winnable,
 * and the AI Coach. Pure TypeScript with no dependencies, so it runs the
 * same in the browser and in a Worker.
 */

export { cardLabel, suitName, SUITS, type Card, type Suit, type SuitCount } from "./cards";
export {
  applyMove,
  canDeal,
  deal,
  isLegal,
  isWon,
  legalMoves,
  movableRun,
  positionKey,
  SCORE,
  type Column,
  type Move,
  type State,
} from "./engine";
export { DAILY_BUDGET, dailyDeal, knownLine, rememberWinningLine, solve, type SolveResult } from "./solver";
export { bestMove, describeMove, type Hint, type Reason } from "./coach";
