/**
 * "Show a piece": the coach picks a loose piece that fits next to what's
 * already on the board (most placed neighbours first, border pieces before
 * inside ones while the frame is unfinished), or a corner to start with, and
 * says in plain English why it goes there.
 */
import type { Cut, Piece, Side } from "./cut";

export type HintReason = "corner-start" | "edge-start" | "frame" | "fits" | "last";

export interface PieceHint {
  pieceId: number;
  reason: HintReason;
  text: string;
}

type Dir = "top" | "right" | "bottom" | "left";
const DIRS: [Dir, number, number][] = [
  ["top", -1, 0],
  ["right", 0, 1],
  ["bottom", 1, 0],
  ["left", 0, -1],
];

/** Placed neighbours of a piece, with the side of this piece that touches each. */
export function placedNeighbours(cut: Cut, p: Piece, placed: readonly boolean[]): { dir: Dir; piece: Piece }[] {
  const out: { dir: Dir; piece: Piece }[] = [];
  for (const [dir, dr, dc] of DIRS) {
    const r = p.row + dr;
    const c = p.col + dc;
    if (r < 0 || c < 0 || r >= cut.rows || c >= cut.cols) continue;
    const n = cut.pieces[r * cut.cols + c];
    if (placed[n.id]) out.push({ dir, piece: n });
  }
  return out;
}

/** "the top-left corner", "the top edge", "row 2, column 3". */
export function where(cut: Cut, p: Piece): string {
  const v = p.row === 0 ? "top" : p.row === cut.rows - 1 ? "bottom" : null;
  const h = p.col === 0 ? "left" : p.col === cut.cols - 1 ? "right" : null;
  if (v && h) return `the ${v}-${h} corner`;
  if (v || h) return `the ${v ?? h} edge, ${v ? `column ${p.col + 1}` : `row ${p.row + 1}`}`;
  return `row ${p.row + 1}, column ${p.col + 1}`;
}

const shape = (s: Side) => (s === 1 ? "tab" : "blank");

/** The coach's pick among `candidates` (default: every loose piece). Null when all are placed. */
export function suggestPiece(cut: Cut, placed: readonly boolean[], candidates?: readonly number[]): PieceHint | null {
  const loose = (candidates ?? cut.pieces.map((p) => p.id)).filter((id) => !placed[id]).map((id) => cut.pieces[id]);
  if (!loose.length) return null;
  const anyPlaced = placed.some(Boolean);
  const frameDone = cut.pieces.every((p) => !p.border || placed[p.id]);

  if (!anyPlaced) {
    const corner = loose.find((p) => p.corner) ?? loose.find((p) => p.border) ?? loose[0];
    return {
      pieceId: corner.id,
      reason: corner.corner ? "corner-start" : "edge-start",
      text: corner.corner
        ? `Start with a corner: two flat sides mean this piece can only go in ${where(cut, corner)}.`
        : `Start with the frame: this piece's flat side puts it on ${where(cut, corner)}.`,
    };
  }

  let best: { p: Piece; score: number; touching: { dir: Dir; piece: Piece }[] } | null = null;
  for (const p of loose) {
    const touching = placedNeighbours(cut, p, placed);
    if (!touching.length) continue;
    const score = touching.length * 10 + (!frameDone && p.border ? 5 : 0) + (p.corner ? 1 : 0);
    if (!best || score > best.score || (score === best.score && p.id < best.p.id)) best = { p, score, touching };
  }

  if (!best) {
    // Nothing loose touches the board (only possible with a filtered tray): any border piece, then anything.
    const p = loose.find((q) => q.border) ?? loose[0];
    return { pieceId: p.id, reason: p.border ? "frame" : "fits", text: `This one goes on ${where(cut, p)}.` };
  }

  const { p, touching } = best;
  if (loose.length === 1) return { pieceId: p.id, reason: "last", text: "The last piece: it fills the only gap left." };
  const t = touching[0];
  const mine = p.sides[t.dir];
  const fit = `Its ${t.dir} side has a ${shape(mine)} that fits the ${shape(-mine as Side)} on the piece ${t.dir === "top" ? "above it" : t.dir === "bottom" ? "below it" : `to its ${t.dir}`}`;
  if (touching.length >= 2) {
    return { pieceId: p.id, reason: "fits", text: `This piece locks in between ${touching.length} placed pieces at ${where(cut, p)}. ${fit}.` };
  }
  if (p.border && !frameDone) {
    return { pieceId: p.id, reason: "frame", text: `Keep building the frame: this edge piece goes on ${where(cut, p)}. ${fit}.` };
  }
  return { pieceId: p.id, reason: "fits", text: `This piece goes at ${where(cut, p)}. ${fit}.` };
}
