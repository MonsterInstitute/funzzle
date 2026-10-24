/**
 * Mahjong Solitaire (tile matching) engine: tiles, layouts, rules, solvable
 * deal generation, a solver and the AI Coach. Pure TypeScript with no
 * dependencies, so it runs the same in the browser and in a Worker.
 */

export {
  FLOWERS,
  KINDS,
  SEASONS,
  TILE_SET,
  groupName,
  groupNameOne,
  isTileId,
  matchKey,
  tileName,
  tilesMatch,
  type TileId,
} from "./tiles";
export {
  LAYOUTS,
  LAYOUT_IDS,
  geometry,
  getLayout,
  isLayoutId,
  type Cell,
  type Geometry,
  type Layout,
  type LayoutId,
} from "./layouts";
export {
  applyMatch,
  canMatch,
  freeTiles,
  isFree,
  isStuck,
  isValidState,
  isWon,
  matchCount,
  matchingPairs,
  newGame,
  positionKey,
  remaining,
  shuffleCount,
  shuffleRemaining,
  undo,
  type HistoryEntry,
  type Pair,
  type State,
} from "./engine";
export { generateDeal } from "./generate";
export { dailyDeal, knownLine, rememberWinningLine, solve, type SolveResult } from "./solver";
export { bestMove, explain, type Hint, type Reason } from "./coach";
