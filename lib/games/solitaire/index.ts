/**
 * Klondike Solitaire engine for Daily Solitaire: rules, a solver that proves
 * daily deals winnable, and the AI Coach. Pure TypeScript with no
 * dependencies, so it runs the same in the browser and in a Worker.
 */

export { cardLabel, SUITS, type Card, type Suit } from "./cards";
export {
  applyMove,
  autoFinish,
  canAutoFinish,
  deal,
  isLegal,
  isWon,
  legalMoves,
  type Column,
  type Move,
  type State,
} from "./engine";
export { dailyDeal, rememberWinningLine, solve, type SolveResult } from "./solver";
export { bestMove, describeMove, type Hint, type Reason } from "./coach";
