/**
 * Jigsaw engine for Daily Jigsaw: an original picture drawn from the seed,
 * a seeded classic tab/blank cut, snapping, and the "Show a piece" coach.
 * Pure TypeScript, so the server and the browser draw the same puzzle.
 *
 * A daily puzzle is a pure function of "jigsaw:<date>" (24 pieces): the
 * stored row only keeps the seed and size; picture and cut are regenerated.
 */
import { SIZES, type PieceCount } from "./cut";

export {
  isPieceCount,
  makeCut,
  pieceBox,
  PIC_H,
  PIC_W,
  PIECE_COUNTS,
  SIZES,
  snapRadius,
  snaps,
  trayOrder,
  type Cut,
  type Edge,
  type Piece,
  type PieceCount,
  type Side,
} from "./cut";
export { drawPicture, pictureDataUrl, THEMES, type Picture, type Theme } from "./picture";
export { placedNeighbours, suggestPiece, where, type HintReason, type PieceHint } from "./coach";

export interface DailyJigsaw {
  date: string;
  seed: string;
  pieces: PieceCount;
  cols: number;
  rows: number;
}

export const DAILY_PIECES: PieceCount = 24;

export function dailyJigsaw(date: string): DailyJigsaw {
  return { date, seed: `jigsaw:${date}`, pieces: DAILY_PIECES, ...SIZES[DAILY_PIECES] };
}
