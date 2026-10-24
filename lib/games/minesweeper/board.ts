/**
 * Minesweeper rules: board geometry, the game state and the three player
 * actions (reveal, flag, chord). Everything is pure: each action returns a new
 * state and leaves the old one untouched, and the state is plain JSON so it can
 * be saved to local storage as is.
 *
 * Cells are numbered row-major: index = row * width + col. The board is always
 * generated around the first click (see generate.ts), so a new game starts
 * with that cell already opened.
 */

export type Difficulty = "beginner" | "intermediate" | "expert" | "expert-mobile";

export const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert", "expert-mobile"];

export interface BoardSize {
  width: number;
  height: number;
  mines: number;
}

/** Expert is 30 wide by 16 tall; "expert-mobile" is the same board stood upright for portrait screens. */
export const SIZES: Record<Difficulty, BoardSize> = {
  beginner: { width: 9, height: 9, mines: 10 },
  intermediate: { width: 16, height: 16, mines: 40 },
  expert: { width: 30, height: 16, mines: 99 },
  "expert-mobile": { width: 16, height: 30, mines: 99 },
};

/** Just the mine layout: all the solver needs besides what the player has opened. */
export interface Layout {
  width: number;
  height: number;
  mineCount: number;
  /** One flag per cell, true = mine. */
  mines: boolean[];
}

export interface Board extends Layout {
  difficulty: Difficulty;
  seed: string;
  /** The cell the board was generated around: it is a zero, so it always opens an area. */
  firstClick: number;
  /** How many seeded layouts were tried before one passed the no-guess check (1 = the first). */
  attempts: number;
}

export type Status = "playing" | "won" | "lost";

/** What undoExplosion restores: the player's view just before the fatal click. */
export interface Snapshot {
  revealed: boolean[];
  flagged: boolean[];
  moves: number;
}

export interface GameState extends Layout {
  revealed: boolean[];
  flagged: boolean[];
  /** The mine the player opened, when lost. */
  exploded: number | null;
  status: Status;
  /** Actions that changed the board, the opening click included. */
  moves: number;
  /** Set when a click loses the game, so a "second chance" can rewind it. */
  beforeExplosion: Snapshot | null;
}

export const rowOf = (width: number, cell: number) => Math.floor(cell / width);
export const colOf = (width: number, cell: number) => cell % width;

/** The up-to-8 cells touching `cell`, ascending. */
export function neighbors(width: number, height: number, cell: number): number[] {
  const r = Math.floor(cell / width);
  const c = cell % width;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    const rr = r + dr;
    if (rr < 0 || rr >= height) continue;
    for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc;
      if ((dr === 0 && dc === 0) || cc < 0 || cc >= width) continue;
      out.push(rr * width + cc);
    }
  }
  return out;
}

/** The number shown on every cell (mine cells get -1). */
export function adjacentCounts(layout: Layout): number[] {
  const { width, height, mines } = layout;
  const out = new Array<number>(width * height).fill(0);
  for (let i = 0; i < out.length; i++) {
    if (mines[i]) {
      out[i] = -1;
      continue;
    }
    let n = 0;
    for (const j of neighbors(width, height, i)) if (mines[j]) n++;
    out[i] = n;
  }
  return out;
}

/** The number on one revealed cell. */
export function numberAt(layout: Layout, cell: number): number {
  let n = 0;
  for (const j of neighbors(layout.width, layout.height, cell)) if (layout.mines[j]) n++;
  return n;
}

/** Mines minus flags: what the counter above the board shows. */
export function minesLeft(state: GameState): number {
  return state.mineCount - state.flagged.filter(Boolean).length;
}

/** Opens `start`, spreading through zeros like the classic game. Flagged cells are never opened. */
export function floodReveal(layout: Layout, revealed: boolean[], flagged: boolean[], start: number): void {
  const { width, height, mines } = layout;
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (revealed[i] || flagged[i]) continue;
    revealed[i] = true;
    if (mines[i]) continue;
    const around = neighbors(width, height, i);
    if (around.some((j) => mines[j])) continue;
    for (const j of around) if (!revealed[j] && !flagged[j]) stack.push(j);
  }
}

const isWon = (s: GameState) => s.revealed.every((r, i) => r || s.mines[i]);

/** A fresh game on `board`, with its first click already opened. */
export function newGame(board: Layout & { firstClick: number }): GameState {
  const empty: GameState = {
    width: board.width,
    height: board.height,
    mineCount: board.mineCount,
    mines: board.mines.slice(),
    revealed: new Array<boolean>(board.mines.length).fill(false),
    flagged: new Array<boolean>(board.mines.length).fill(false),
    exploded: null,
    status: "playing",
    moves: 0,
    beforeExplosion: null,
  };
  return reveal(empty, board.firstClick);
}

/** Opens several cells as one move; loses on the first mine among them. */
function openCells(state: GameState, cells: number[]): GameState {
  const revealed = state.revealed.slice();
  const flagged = state.flagged.slice();
  const snapshot: Snapshot = { revealed: state.revealed.slice(), flagged: state.flagged.slice(), moves: state.moves };
  let exploded: number | null = null;
  for (const cell of cells) {
    if (state.mines[cell]) {
      revealed[cell] = true;
      if (exploded === null) exploded = cell;
    } else floodReveal(state, revealed, flagged, cell);
  }
  const next: GameState = { ...state, revealed, flagged, moves: state.moves + 1 };
  if (exploded !== null) return { ...next, status: "lost", exploded, beforeExplosion: snapshot };
  if (isWon(next)) {
    // Like the classic game, a win flags every remaining mine for you.
    return { ...next, status: "won", flagged: state.mines.slice() };
  }
  return next;
}

/** Opens one hidden, unflagged cell. Anything else (or a finished game) is a no-op. */
export function reveal(state: GameState, cell: number): GameState {
  if (state.status !== "playing" || state.revealed[cell] || state.flagged[cell]) return state;
  return openCells(state, [cell]);
}

/** Puts or removes a flag on a hidden cell. */
export function toggleFlag(state: GameState, cell: number): GameState {
  if (state.status !== "playing" || state.revealed[cell]) return state;
  const flagged = state.flagged.slice();
  flagged[cell] = !flagged[cell];
  return { ...state, flagged, moves: state.moves + 1 };
}

/**
 * Chording: on an opened number that already touches that many flags, open
 * every other hidden neighbor at once. A wrong flag makes this lose the game,
 * as in the classic version.
 */
export function chord(state: GameState, cell: number): GameState {
  if (state.status !== "playing" || !state.revealed[cell] || state.mines[cell]) return state;
  const around = neighbors(state.width, state.height, cell);
  const flags = around.filter((j) => state.flagged[j]).length;
  if (flags !== numberAt(state, cell)) return state;
  const targets = around.filter((j) => !state.revealed[j] && !state.flagged[j]);
  if (!targets.length) return state;
  return openCells(state, targets);
}

/**
 * The opt-in "second chance": the state just before the click that lost the
 * game, so the player can carry on. Returns the state unchanged if it isn't a
 * loss that can be rewound.
 */
export function undoExplosion(state: GameState): GameState {
  const snap = state.beforeExplosion;
  if (state.status !== "lost" || !snap) return state;
  return {
    ...state,
    revealed: snap.revealed.slice(),
    flagged: snap.flagged.slice(),
    moves: snap.moves,
    exploded: null,
    status: "playing",
    beforeExplosion: null,
  };
}
