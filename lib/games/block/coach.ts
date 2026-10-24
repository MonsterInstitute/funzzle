/**
 * Block Puzzle coach: the best next placement, found by searching the pieces
 * in hand in every order (a beam over positions keeps it to a few
 * milliseconds), scoring the points made plus how open the final board is.
 *
 * Board value: empty squares, minus isolated single holes (only a 1-square
 * piece fits them), minus ragged edges between filled and empty, plus room for
 * the awkward pieces (the 3×3 square and the 5-bars). A line of pieces where
 * one can't be placed at all is heavily penalised.
 */
import { clearLines, drop, fullLines, lineScore, PIECES, placements, SIZE, type State } from "./engine";

export type HintReason = "clear" | "multi" | "combo" | "room" | "edge" | "survive";

export interface Hint {
  slot: number;
  row: number;
  col: number;
  pieceId: string;
  reason: HintReason;
  /** Lines this placement clears. */
  lines: number;
  /** What to do, in plain English. */
  text: string;
  /** Why it's the best spot. */
  why: string;
  /** The other pieces in hand all still fit afterwards. */
  restFit: boolean;
}

function fits3x3(board: number[]): boolean {
  return placements(board, "o3").length > 0;
}

// Scratch buffer: empty-run length to the right of each cell (one pass per board).
const RUN = new Int8Array(64);

/** Heuristic value of a board after a line of placements (one O(64) pass). */
export function boardValue(board: number[]): number {
  let empty = 0;
  let isolated = 0;
  let edges = 0;
  let bar5h = false;
  for (let r = 0; r < SIZE; r++) {
    let run = 0;
    for (let c = SIZE - 1; c >= 0; c--) {
      const i = r * SIZE + c;
      const v = board[i];
      run = v ? 0 : run + 1;
      RUN[i] = run;
      if (run >= 5) bar5h = true;
      if (!v) {
        empty++;
        const up = r === 0 || board[i - SIZE];
        const down = r === SIZE - 1 || board[i + SIZE];
        const left = c === 0 || board[i - 1];
        const right = c === SIZE - 1 || board[i + 1];
        if (up && down && left && right) isolated++;
      }
      if (c < SIZE - 1 && !v !== !board[i + 1]) edges++;
      if (r < SIZE - 1 && !v !== !board[i + SIZE]) edges++;
    }
  }
  let square = false;
  for (let r = 0; r + 3 <= SIZE && !square; r++) {
    for (let c = 0; c + 3 <= SIZE; c++) {
      if (RUN[r * SIZE + c] >= 3 && RUN[(r + 1) * SIZE + c] >= 3 && RUN[(r + 2) * SIZE + c] >= 3) {
        square = true;
        break;
      }
    }
  }
  let bar5v = false;
  for (let c = 0; c < SIZE && !bar5v; c++) {
    let run = 0;
    for (let r = 0; r < SIZE; r++) {
      run = board[r * SIZE + c] ? 0 : run + 1;
      if (run >= 5) {
        bar5v = true;
        break;
      }
    }
  }
  let v = empty * 1.2 - isolated * 7 - edges * 0.75;
  v += square ? 10 : -14;
  v += bar5h ? 4 : -6;
  v += bar5v ? 4 : -6;
  return v;
}

interface Step {
  board: number[];
  points: number;
  lines: number;
}

/** Drop + clear, the points it makes (combo ignored: it rewards clearing anyway). */
function step(board: number[], id: string, r: number, c: number, combo: number): Step & { combo: number } {
  const d = drop(board, id, r, c)!;
  const { rows, cols } = fullLines(d);
  const n = rows.length + cols.length;
  const nextCombo = n ? combo + 1 : 0;
  return {
    board: n ? clearLines(d, rows, cols) : d,
    points: PIECES[id].cells.length + lineScore(n) + (n ? 10 * (nextCombo - 1) : 0),
    lines: n,
    combo: nextCombo,
  };
}

/** Placements kept at each depth (the first piece, then the second). */
const BEAM = [8, 4];
const MISS = -400;

/** Best value reachable placing `ids` in this order from `board`. */
function search(board: number[], ids: string[], depth: number, combo: number): number {
  if (!ids.length) return boardValue(board);
  const [id, ...rest] = ids;
  if (!rest.length) {
    // Last piece: no beam needed, just the best spot.
    let best = -Infinity;
    for (const [r, c] of placements(board, id)) {
      const s = step(board, id, r, c, combo);
      best = Math.max(best, s.points + boardValue(s.board));
    }
    return best === -Infinity ? MISS + boardValue(board) : best;
  }
  const options = placements(board, id).map(([r, c]) => {
    const s = step(board, id, r, c, combo);
    return { s, quick: s.points + boardValue(s.board) };
  });
  if (!options.length) return MISS * ids.length + boardValue(board);
  options.sort((a, b) => b.quick - a.quick);
  let best = -Infinity;
  for (const o of options.slice(0, BEAM[Math.min(depth, BEAM.length - 1)])) {
    best = Math.max(best, o.s.points + search(o.s.board, rest, depth + 1, o.s.combo));
  }
  return best;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

const rowsText = (r: number, h: number) => (h === 1 ? `row ${r + 1}` : `rows ${r + 1}–${r + h}`);
const colsText = (c: number, w: number) => (w === 1 ? `column ${c + 1}` : `columns ${c + 1}–${c + w}`);

/** The coach's best next placement, or null when nothing fits. */
export function bestPlacement(s: State): Hint | null {
  const slots = s.tray.map((id, i) => ({ id, i })).filter((x): x is { id: string; i: number } => x.id !== null);
  if (!slots.length) return null;
  let best: { slot: number; r: number; c: number; value: number; lines: number; restFit: boolean } | null = null;
  for (const first of slots) {
    const rest = slots.filter((x) => x.i !== first.i).map((x) => x.id);
    const orders = permutations(rest);
    const options = placements(s.board, first.id).map(([r, c]) => {
      const st = step(s.board, first.id, r, c, s.combo);
      return { r, c, st, quick: st.points + boardValue(st.board) };
    });
    options.sort((a, b) => b.quick - a.quick);
    for (const o of options.slice(0, BEAM[0])) {
      const after = Math.max(...orders.map((ord) => search(o.st.board, ord, 1, o.st.combo)));
      const value = o.st.points + after;
      if (!best || value > best.value) {
        best = { slot: first.i, r: o.r, c: o.c, value, lines: o.st.lines, restFit: after > MISS / 2 };
      }
    }
  }
  if (!best) return null;
  const pieceId = s.tray[best.slot]!;
  const p = PIECES[pieceId];
  const where = `${rowsText(best.r, p.h)}, ${colsText(best.c, p.w)}`;
  const text = `Put the ${p.name} (piece ${best.slot + 1}) in ${where}.`;
  const afterBoard = step(s.board, pieceId, best.r, best.c, s.combo).board;
  let reason: HintReason;
  let why: string;
  if (best.lines >= 2) {
    reason = "multi";
    why = `It clears ${best.lines} lines at once for ${lineScore(best.lines)} points, more than clearing them one by one.`;
  } else if (best.lines === 1 && s.combo > 0) {
    reason = "combo";
    why = `It clears a line and keeps your combo going: the bonus grows with every piece in a row that clears.`;
  } else if (best.lines === 1) {
    reason = "clear";
    why = "It completes a line, which clears it and frees the space for your next pieces.";
  } else if (!best.restFit) {
    reason = "survive";
    why = "Space is tight: this is the spot that leaves the most room, even though not every piece will fit.";
  } else if (fits3x3(afterBoard)) {
    reason = "room";
    why = "No line clears yet, so it fills in neatly against what’s there and keeps an open 3×3 area for the big square.";
  } else {
    reason = "edge";
    why = "No line clears yet, so it packs the piece tight and leaves as few single holes as possible.";
  }
  if (best.restFit && slots.length > 1 && reason !== "survive") why += " Your other pieces still fit afterwards.";
  return { slot: best.slot, row: best.r, col: best.c, pieceId, reason, lines: best.lines, text, why, restFit: best.restFit };
}

/** Simple self-play with the coach, for tests and calibration. */
export function autoplay(s: State, place: (s: State, slot: number, r: number, c: number) => { state: State }, isOver: (s: State) => boolean, maxMoves = 2000): State {
  let cur = s;
  for (let i = 0; i < maxMoves && !isOver(cur); i++) {
    const h = bestPlacement(cur);
    if (!h) break;
    cur = place(cur, h.slot, h.row, h.col).state;
  }
  return cur;
}

