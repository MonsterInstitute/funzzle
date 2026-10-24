/**
 * UI-facing helpers over the engine: a game is a start FEN plus the UCI
 * moves played, so it serializes to local storage and replays exactly
 * (including the repetition history the draw rules need).
 */
import {
  colorOf,
  F_CAPTURE,
  F_CASTLE,
  F_PROMO,
  mFlags,
  mFrom,
  mPromo,
  mTo,
  moveToSan,
  moveToUci,
  Position,
  sq64,
  typeOf,
  uciToMove,
  type GameEnd,
} from "./position";

/** "wP", "bK", … */
export type PieceCode = `${"w" | "b"}${"P" | "N" | "B" | "R" | "Q" | "K"}`;
export type Promotion = "q" | "r" | "b" | "n";

export interface UiMove {
  uci: string;
  san: string;
  /** 0–63, a1 = 0, h8 = 63. */
  from: number;
  to: number;
  promotion: Promotion | null;
  capture: boolean;
  castle: boolean;
}

const LETTER = " PNBRQK";

export function pieceCode(p: number): PieceCode | null {
  return p ? (`${colorOf(p) ? "b" : "w"}${LETTER[typeOf(p)]}` as PieceCode) : null;
}

const NAMES: Record<string, string> = { P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };
export const pieceLabel = (code: PieceCode) => `${code[0] === "w" ? "white" : "black"} ${NAMES[code[1]]}`;
export const squareLabel = (i: number) => "abcdefgh"[i & 7] + String((i >> 3) + 1);

/** Replay `moves` (UCI) from `fen`; throws on an illegal move. */
export function replay(fen: string, moves: string[]): Position {
  const pos = Position.fromFen(fen);
  for (const u of moves) {
    const m = uciToMove(pos, u);
    if (!m) throw new Error(`illegal move ${u} in ${pos.toFen()}`);
    pos.make(m);
  }
  return pos;
}

/** SAN for each move of a game. */
export function sanList(fen: string, moves: string[]): string[] {
  const pos = Position.fromFen(fen);
  return moves.map((u) => {
    const m = uciToMove(pos, u);
    const san = moveToSan(pos, m);
    pos.make(m);
    return san;
  });
}

export function toUiMove(pos: Position, m: number, legal?: number[]): UiMove {
  const f = mFlags(m);
  return {
    uci: moveToUci(m),
    san: moveToSan(pos, m, legal),
    from: sq64(mFrom(m)),
    to: sq64(mTo(m)),
    promotion: f & F_PROMO ? ("  nbrq"[mPromo(m)] as Promotion) : null,
    capture: !!(f & F_CAPTURE),
    castle: !!(f & F_CASTLE),
  };
}

export function legalUiMoves(pos: Position): UiMove[] {
  const legal = pos.legalMoves();
  return legal.map((m) => toUiMove(pos, m, legal));
}

/** The 64 squares, a1 first. */
export function boardArray(pos: Position): (PieceCode | null)[] {
  return Array.from({ length: 64 }, (_, i) => pieceCode(pos.board[(i >> 3) * 16 + (i & 7)]));
}

export interface Status {
  turn: "w" | "b";
  check: boolean;
  end: GameEnd | null;
  /** Winner when the game is over by mate; null for draws or ongoing games. */
  winner: "w" | "b" | null;
}

export function status(pos: Position): Status {
  const end = pos.gameEnd();
  const turn = pos.side ? "b" : "w";
  return { turn, check: pos.inCheck(), end, winner: end === "checkmate" ? (turn === "w" ? "b" : "w") : null };
}

export const END_TEXT: Record<GameEnd, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  "fifty-move": "Draw by the 50-move rule",
  threefold: "Draw by threefold repetition",
  insufficient: "Draw: not enough material to mate",
};

/** Pieces each side has lost, compared with a full set (promotions clamp at 0). */
export function captured(pos: Position): { w: PieceCode[]; b: PieceCode[] } {
  const full: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const out = { w: [] as PieceCode[], b: [] as PieceCode[] };
  for (const color of ["w", "b"] as const) {
    for (const t of ["Q", "R", "B", "N", "P"]) {
      const code = `${color}${t}` as PieceCode;
      const have = boardArray(pos).filter((p) => p === code).length;
      for (let i = have; i < full[t]; i++) out[color].push(code);
    }
  }
  return out;
}

/** Material balance in points from white's view (pawn = 1). */
export function materialBalance(pos: Position): number {
  return pos.material(0);
}

/** Square (0–63) of the side-to-move's king when it is in check, else -1. */
export function checkSquare(pos: Position): number {
  return pos.inCheck() ? sq64(pos.kings[pos.side]) : -1;
}
