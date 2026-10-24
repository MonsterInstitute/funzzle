/**
 * Minesweeper play state around the engine's GameState: what a tap does
 * (reveal, flag or chord), the one-step "undo the last flag", hints and the
 * coach's answers, and the opt-in second chance after a mine. Pure reducer,
 * unit-tested in tests/unit/minesweeper-state.test.ts.
 */
import {
  chord,
  neighbors,
  newGame,
  numberAt,
  reveal,
  toggleFlag,
  undoExplosion,
  type GameState,
  type Layout,
} from "@/lib/games/minesweeper";

export const MAX_HINTS = 3;

export interface PlayState {
  game: GameState;
  /** Hints opened (each one counts, like Sudoku). */
  hints: number;
  /** Mines hit, rewound or not: what the results count as mistakes. */
  explosions: number;
  /** The cell of the last flag placed or removed, for Undo (one step only). */
  lastFlag: number | null;
  /** Cells the coach opened or flagged for the player. */
  coached: number[];
  /** Techniques the coach explained, for the recap. */
  coachedTechniques: string[];
}

export type Action =
  /** A tap / left click / Space: chord on an opened number, otherwise reveal (or flag in flag mode). */
  | { type: "activate"; cell: number; flagMode: boolean }
  | { type: "flag"; cell: number }
  | { type: "undo-flag" }
  | { type: "hint-used"; technique: string }
  /** The coach's answer: open a safe cell, flag a mine, or take a wrong flag off. */
  | { type: "coach-apply"; cell: number; kind: "safe" | "mine"; mistake: boolean }
  | { type: "second-chance" };

export function initialState(board: Layout & { firstClick: number }): PlayState {
  return { game: newGame(board), hints: 0, explosions: 0, lastFlag: null, coached: [], coachedTechniques: [] };
}

/** Count a new loss once. */
function withGame(state: PlayState, game: GameState): PlayState {
  if (game === state.game) return state;
  const exploded = game.status === "lost" && state.game.status !== "lost";
  return { ...state, game, explosions: state.explosions + (exploded ? 1 : 0) };
}

export function reducer(state: PlayState, action: Action): PlayState {
  const g = state.game;
  switch (action.type) {
    case "activate": {
      if (g.status !== "playing") return state;
      const c = action.cell;
      if (g.revealed[c]) return withGame(state, chord(g, c));
      if (action.flagMode) return reducer(state, { type: "flag", cell: c });
      return withGame(state, reveal(g, c));
    }
    case "flag": {
      const next = toggleFlag(g, action.cell);
      if (next === g) return state;
      return { ...state, game: next, lastFlag: action.cell };
    }
    case "undo-flag": {
      const c = state.lastFlag;
      if (c === null || g.status !== "playing" || g.revealed[c]) return { ...state, lastFlag: null };
      return { ...state, game: toggleFlag(g, c), lastFlag: null };
    }
    case "hint-used":
      return {
        ...state,
        hints: state.hints + 1,
        coachedTechniques: state.coachedTechniques.includes(action.technique) ? state.coachedTechniques : [...state.coachedTechniques, action.technique],
      };
    case "coach-apply": {
      if (g.status !== "playing") return state;
      const c = action.cell;
      let game = g;
      if (action.mistake) {
        if (g.flagged[c]) game = toggleFlag(g, c);
      } else if (action.kind === "mine") {
        if (!g.flagged[c]) game = toggleFlag(g, c);
      } else {
        if (g.flagged[c]) game = toggleFlag(game, c);
        game = reveal(game, c);
      }
      if (game === g) return state;
      return { ...withGame(state, game), coached: state.coached.includes(c) ? state.coached : [...state.coached, c] };
    }
    case "second-chance": {
      const game = undoExplosion(g);
      return game === g ? state : { ...state, game, lastFlag: null };
    }
  }
}

/** Hidden, unflagged cells that are safe: what's left to open. */
export function safeLeft(g: GameState): number {
  let n = 0;
  for (let i = 0; i < g.mines.length; i++) if (!g.revealed[i] && !g.mines[i]) n++;
  return n;
}

/** What a cell shows, for rendering and its aria-label. */
export type CellView =
  | { kind: "hidden" }
  | { kind: "flag"; wrong: boolean }
  | { kind: "open"; n: number }
  | { kind: "mine"; exploded: boolean };

export function cellView(g: GameState, i: number): CellView {
  const over = g.status === "lost";
  if (g.revealed[i]) return g.mines[i] ? { kind: "mine", exploded: g.exploded === i } : { kind: "open", n: numberAt(g, i) };
  if (g.flagged[i]) return { kind: "flag", wrong: over && !g.mines[i] };
  // After a loss the remaining mines are shown, as in the classic game.
  if (over && g.mines[i]) return { kind: "mine", exploded: false };
  return { kind: "hidden" };
}

export function cellLabel(g: GameState, i: number): string {
  const where = `Row ${Math.floor(i / g.width) + 1}, column ${(i % g.width) + 1}`;
  const v = cellView(g, i);
  switch (v.kind) {
    case "hidden":
      return `${where}: hidden`;
    case "flag":
      return `${where}: flagged${v.wrong ? ", not a mine" : ""}`;
    case "mine":
      return `${where}: mine${v.exploded ? ", exploded" : ""}`;
    case "open": {
      if (!v.n) return `${where}: empty`;
      const flags = neighbors(g.width, g.height, i).filter((j) => g.flagged[j]).length;
      return `${where}: ${v.n}${flags ? `, ${flags} flagged around` : ""}`;
    }
  }
}

/** Cursor move for the arrow keys; stays put at the edges. */
export function moveCursor(width: number, height: number, cell: number, key: string): number {
  const r = Math.floor(cell / width);
  const c = cell % width;
  if (key === "ArrowUp") return r > 0 ? cell - width : cell;
  if (key === "ArrowDown") return r < height - 1 ? cell + width : cell;
  if (key === "ArrowLeft") return c > 0 ? cell - 1 : cell;
  if (key === "ArrowRight") return c < width - 1 ? cell + 1 : cell;
  return cell;
}
