/**
 * Chess rules: a 0x88 board with make/unmake, full legal move generation
 * (castling, en passant, promotion), check/mate/stalemate, the 50-move rule,
 * threefold repetition, insufficient material, FEN in/out and SAN.
 *
 * Squares inside the engine are 0x88 indexes (rank * 16 + file, a1 = 0).
 * Public helpers convert to the 0–63 index the UI uses (rank * 8 + file).
 * Moves are packed into one integer so search can keep them in typed arrays.
 */
import { createRng } from "@/lib/games/kit/rng";

export const WHITE = 0;
export const BLACK = 1;
export type Color = 0 | 1;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
const BLACK_BIT = 8;

export const typeOf = (p: number) => p & 7;
export const colorOf = (p: number): Color => (p >> 3) as Color;
export const makePiece = (color: Color, type: number) => (color ? BLACK_BIT : 0) | type;

// Move packing: from | to << 7 | promotion type << 14 | flags << 17.
export const F_CAPTURE = 1;
export const F_EP = 2;
export const F_CASTLE = 4;
export const F_DOUBLE = 8;
export const F_PROMO = 16;
const pack = (from: number, to: number, promo: number, flags: number) => from | (to << 7) | (promo << 14) | (flags << 17);
export const mFrom = (m: number) => m & 127;
export const mTo = (m: number) => (m >> 7) & 127;
export const mPromo = (m: number) => (m >> 14) & 7;
export const mFlags = (m: number) => m >> 17;

const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
const K_OFF = [1, -1, 16, -16, 17, 15, -17, -15];
const B_OFF = [17, 15, -17, -15];
const R_OFF = [1, -1, 16, -16];

const CASTLE_WK = 1;
const CASTLE_WQ = 2;
const CASTLE_BK = 4;
const CASTLE_BQ = 8;
const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0] = 15 & ~CASTLE_WQ;
CASTLE_MASK[7] = 15 & ~CASTLE_WK;
CASTLE_MASK[4] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[112] = 15 & ~CASTLE_BQ;
CASTLE_MASK[119] = 15 & ~CASTLE_BK;
CASTLE_MASK[116] = 15 & ~(CASTLE_BK | CASTLE_BQ);

export const sq88 = (i: number) => (i >> 3) * 16 + (i & 7);
export const sq64 = (s: number) => (s >> 4) * 8 + (s & 7);
export const FILES = "abcdefgh";
export const squareName = (s: number) => FILES[s & 7] + String((s >> 4) + 1);
export const squareName64 = (i: number) => FILES[i & 7] + String((i >> 3) + 1);
export function parseSquare(name: string): number {
  if (!/^[a-h][1-8]$/.test(name)) return -1;
  return (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
}

// ---------------------------------------------------------------------------
// Zobrist keys (two 32-bit halves) and evaluation tables
// ---------------------------------------------------------------------------

const zrng = createRng("chess:zobrist");
const rand32 = () => (zrng.next() * 4294967296) | 0;
const Z_PIECE_LO = Int32Array.from({ length: 15 * 128 }, rand32);
const Z_PIECE_HI = Int32Array.from({ length: 15 * 128 }, rand32);
const Z_CASTLE_LO = Int32Array.from({ length: 16 }, rand32);
const Z_CASTLE_HI = Int32Array.from({ length: 16 }, rand32);
const Z_EP_LO = Int32Array.from({ length: 8 }, rand32);
const Z_EP_HI = Int32Array.from({ length: 8 }, rand32);
const Z_SIDE_LO = rand32();
const Z_SIDE_HI = rand32();

/** Piece values in centipawns (middlegame / endgame). */
export const VALUE = [0, 100, 320, 330, 500, 900, 0];
const VALUE_EG = [0, 120, 300, 320, 530, 940, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];

// Piece-square tables, white's view, a8 first (row 0 = rank 8).
// prettier-ignore
const PST_MG: number[][] = [
  [],
  [ 0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
    0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0 ],
  [ -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
    -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50 ],
  [ -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
    -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20 ],
  [ 0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
    -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0 ],
  [ -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
    0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20 ],
  [ -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20 ],
];
// prettier-ignore
const PST_EG: number[][] = [
  [],
  [ 0,0,0,0,0,0,0,0, 90,90,90,90,90,90,90,90, 55,55,55,55,55,55,55,55, 30,30,30,30,30,30,30,30,
    15,15,15,15,15,15,15,15, 5,5,5,5,5,5,5,5, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0 ],
  PST_MG[2], PST_MG[3], PST_MG[4], PST_MG[5],
  [ -50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30,
    -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50 ],
];

// Per (piece code, 0x88 square) score, folded with material.
const SCORE_MG = new Int16Array(15 * 128);
const SCORE_EG = new Int16Array(15 * 128);
for (let color = 0; color < 2; color++) {
  for (let t = 1; t <= 6; t++) {
    const p = makePiece(color as Color, t);
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const rank = s >> 4;
      const file = s & 7;
      const idx = color === WHITE ? (7 - rank) * 8 + file : rank * 8 + file;
      SCORE_MG[p * 128 + s] = VALUE[t] + PST_MG[t][idx];
      SCORE_EG[p * 128 + s] = VALUE_EG[t] + PST_EG[t][idx];
    }
  }
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PIECE_CHARS = " PNBRQK  pnbrqk";

interface Undo {
  move: number;
  captured: number;
  castling: number;
  ep: number;
  halfmove: number;
  hashLo: number;
  hashHi: number;
}

export type GameEnd = "checkmate" | "stalemate" | "fifty-move" | "threefold" | "insufficient";

export class Position {
  board = new Int8Array(128);
  side: Color = WHITE;
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = [0, 0];
  hashLo = 0;
  hashHi = 0;
  mg = [0, 0];
  eg = [0, 0];
  phase = 0;
  /** Pieces on the board per piece code. */
  counts = new Int8Array(15);
  /** Undo records, newest last. */
  stack: Undo[] = [];
  /** Hashes of earlier positions (for repetition), parallel to stack. */
  private histLo: number[] = [];
  private histHi: number[] = [];

  static fromFen(fen: string): Position {
    const p = new Position();
    p.loadFen(fen);
    return p;
  }

  clone(): Position {
    const p = new Position();
    p.board.set(this.board);
    p.side = this.side;
    p.castling = this.castling;
    p.ep = this.ep;
    p.halfmove = this.halfmove;
    p.fullmove = this.fullmove;
    p.kings = [...this.kings];
    p.hashLo = this.hashLo;
    p.hashHi = this.hashHi;
    p.mg = [...this.mg];
    p.eg = [...this.eg];
    p.phase = this.phase;
    p.counts.set(this.counts);
    p.stack = this.stack.slice();
    p.histLo = this.histLo.slice();
    p.histHi = this.histHi.slice();
    return p;
  }

  private put(s: number, piece: number) {
    this.board[s] = piece;
    const k = piece * 128 + s;
    this.hashLo ^= Z_PIECE_LO[k];
    this.hashHi ^= Z_PIECE_HI[k];
    const c = colorOf(piece);
    this.mg[c] += SCORE_MG[k];
    this.eg[c] += SCORE_EG[k];
    this.phase += PHASE[typeOf(piece)];
    this.counts[piece]++;
    if (typeOf(piece) === KING) this.kings[c] = s;
  }

  private remove(s: number) {
    const piece = this.board[s];
    this.board[s] = 0;
    const k = piece * 128 + s;
    this.hashLo ^= Z_PIECE_LO[k];
    this.hashHi ^= Z_PIECE_HI[k];
    const c = colorOf(piece);
    this.mg[c] -= SCORE_MG[k];
    this.eg[c] -= SCORE_EG[k];
    this.phase -= PHASE[typeOf(piece)];
    this.counts[piece]--;
  }

  private setEp(ep: number) {
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP_LO[this.ep & 7];
      this.hashHi ^= Z_EP_HI[this.ep & 7];
    }
    this.ep = ep;
    if (ep >= 0) {
      this.hashLo ^= Z_EP_LO[ep & 7];
      this.hashHi ^= Z_EP_HI[ep & 7];
    }
  }

  private setCastling(c: number) {
    this.hashLo ^= Z_CASTLE_LO[this.castling] ^ Z_CASTLE_LO[c];
    this.hashHi ^= Z_CASTLE_HI[this.castling] ^ Z_CASTLE_HI[c];
    this.castling = c;
  }

  loadFen(fen: string) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 2) throw new Error(`bad FEN: ${fen}`);
    const [placement, side, castling = "-", ep = "-", half = "0", full = "1"] = parts;
    this.board.fill(0);
    this.hashLo = this.hashHi = 0;
    this.mg = [0, 0];
    this.eg = [0, 0];
    this.phase = 0;
    this.counts.fill(0);
    this.kings = [-1, -1];
    const rows = placement.split("/");
    if (rows.length !== 8) throw new Error(`bad FEN: ${fen}`);
    for (let r = 0; r < 8; r++) {
      let file = 0;
      for (const ch of rows[r]) {
        if (/[1-8]/.test(ch)) file += Number(ch);
        else {
          const idx = PIECE_CHARS.indexOf(ch);
          if (idx <= 0 || file > 7) throw new Error(`bad FEN: ${fen}`);
          this.put((7 - r) * 16 + file, idx);
          file++;
        }
      }
      if (file !== 8) throw new Error(`bad FEN: ${fen}`);
    }
    if (this.kings[0] < 0 || this.kings[1] < 0) throw new Error(`bad FEN (missing king): ${fen}`);
    if (side !== "w" && side !== "b") throw new Error(`bad FEN: ${fen}`);
    this.side = side === "w" ? WHITE : BLACK;
    if (this.side === BLACK) {
      this.hashLo ^= Z_SIDE_LO;
      this.hashHi ^= Z_SIDE_HI;
    }
    let c = 0;
    if (castling.includes("K") && this.board[4] === KING && this.board[7] === ROOK) c |= CASTLE_WK;
    if (castling.includes("Q") && this.board[4] === KING && this.board[0] === ROOK) c |= CASTLE_WQ;
    if (castling.includes("k") && this.board[116] === (BLACK_BIT | KING) && this.board[119] === (BLACK_BIT | ROOK)) c |= CASTLE_BK;
    if (castling.includes("q") && this.board[116] === (BLACK_BIT | KING) && this.board[112] === (BLACK_BIT | ROOK)) c |= CASTLE_BQ;
    this.castling = 0;
    this.hashLo ^= Z_CASTLE_LO[0];
    this.hashHi ^= Z_CASTLE_HI[0];
    this.setCastling(c);
    this.ep = -1;
    // Only record an en passant square a pawn could actually capture on (as FEN
    // writers differ), so equal positions hash equal.
    const epSq = ep === "-" ? -1 : parseSquare(ep);
    if (epSq >= 0 && this.epCapturable(epSq)) this.setEp(epSq);
    this.halfmove = Number(half) || 0;
    this.fullmove = Number(full) || 1;
    this.stack = [];
    this.histLo = [];
    this.histHi = [];
  }

  private epCapturable(epSq: number): boolean {
    const us = this.side;
    const pawn = makePiece(us, PAWN);
    const from = us === WHITE ? [epSq - 15, epSq - 17] : [epSq + 15, epSq + 17];
    return from.some((s) => !(s & 0x88) && this.board[s] === pawn);
  }

  toFen(): string {
    const rows: string[] = [];
    for (let r = 7; r >= 0; r--) {
      let row = "";
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 16 + f];
        if (!p) empty++;
        else {
          if (empty) row += empty;
          empty = 0;
          row += PIECE_CHARS[p];
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    let c = "";
    if (this.castling & CASTLE_WK) c += "K";
    if (this.castling & CASTLE_WQ) c += "Q";
    if (this.castling & CASTLE_BK) c += "k";
    if (this.castling & CASTLE_BQ) c += "q";
    return `${rows.join("/")} ${this.side === WHITE ? "w" : "b"} ${c || "-"} ${this.ep >= 0 ? squareName(this.ep) : "-"} ${this.halfmove} ${this.fullmove}`;
  }

  /** Is square `s` attacked by any piece of `by`? */
  attacked(s: number, by: Color): boolean {
    const b = this.board;
    const bit = by ? BLACK_BIT : 0;
    // Pawns
    if (by === WHITE) {
      if (!((s - 15) & 0x88) && b[s - 15] === PAWN) return true;
      if (!((s - 17) & 0x88) && b[s - 17] === PAWN) return true;
    } else {
      if (!((s + 15) & 0x88) && b[s + 15] === (BLACK_BIT | PAWN)) return true;
      if (!((s + 17) & 0x88) && b[s + 17] === (BLACK_BIT | PAWN)) return true;
    }
    for (let i = 0; i < 8; i++) {
      const t = s + N_OFF[i];
      if (!(t & 0x88) && b[t] === (bit | KNIGHT)) return true;
      const k = s + K_OFF[i];
      if (!(k & 0x88) && b[k] === (bit | KING)) return true;
    }
    for (let i = 0; i < 4; i++) {
      let t = s + B_OFF[i];
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === (bit | BISHOP) || p === (bit | QUEEN)) return true;
          break;
        }
        t += B_OFF[i];
      }
      t = s + R_OFF[i];
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === (bit | ROOK) || p === (bit | QUEEN)) return true;
          break;
        }
        t += R_OFF[i];
      }
    }
    return false;
  }

  inCheck(color: Color = this.side): boolean {
    return this.attacked(this.kings[color], (color ^ 1) as Color);
  }

  /**
   * Pseudo-legal moves into `out` starting at `start`; returns the new end.
   * `capturesOnly` adds captures and queen promotions (for quiescence).
   */
  generate(out: Int32Array | number[], start = 0, capturesOnly = false): number {
    const b = this.board;
    const us = this.side;
    const them = (us ^ 1) as Color;
    let n = start;
    const add = (m: number) => {
      out[n++] = m;
    };
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) {
        s += 7;
        continue;
      }
      const p = b[s];
      if (!p || colorOf(p) !== us) continue;
      const t = typeOf(p);
      if (t === PAWN) {
        const dir = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6;
        const promoRank = us === WHITE ? 6 : 1;
        const rank = s >> 4;
        const one = s + dir;
        if (!(one & 0x88) && !b[one]) {
          if (rank === promoRank) {
            add(pack(s, one, QUEEN, F_PROMO));
            if (!capturesOnly) {
              add(pack(s, one, ROOK, F_PROMO));
              add(pack(s, one, BISHOP, F_PROMO));
              add(pack(s, one, KNIGHT, F_PROMO));
            }
          } else if (!capturesOnly) {
            add(pack(s, one, 0, 0));
            const two = one + dir;
            if (rank === startRank && !b[two]) add(pack(s, two, 0, F_DOUBLE));
          }
        }
        for (const d of [dir - 1, dir + 1]) {
          const to = s + d;
          if (to & 0x88) continue;
          const q = b[to];
          if (q && colorOf(q) === them) {
            if (rank === promoRank) {
              add(pack(s, to, QUEEN, F_PROMO | F_CAPTURE));
              add(pack(s, to, ROOK, F_PROMO | F_CAPTURE));
              add(pack(s, to, BISHOP, F_PROMO | F_CAPTURE));
              add(pack(s, to, KNIGHT, F_PROMO | F_CAPTURE));
            } else add(pack(s, to, 0, F_CAPTURE));
          } else if (to === this.ep) add(pack(s, to, 0, F_CAPTURE | F_EP));
        }
      } else if (t === KNIGHT || t === KING) {
        const offs = t === KNIGHT ? N_OFF : K_OFF;
        for (let i = 0; i < 8; i++) {
          const to = s + offs[i];
          if (to & 0x88) continue;
          const q = b[to];
          if (!q) {
            if (!capturesOnly) add(pack(s, to, 0, 0));
          } else if (colorOf(q) === them) add(pack(s, to, 0, F_CAPTURE));
        }
        if (t === KING && !capturesOnly) this.genCastles(add);
      } else {
        const offs = t === BISHOP ? B_OFF : t === ROOK ? R_OFF : K_OFF;
        for (let i = 0; i < offs.length; i++) {
          const d = offs[i];
          let to = s + d;
          while (!(to & 0x88)) {
            const q = b[to];
            if (!q) {
              if (!capturesOnly) add(pack(s, to, 0, 0));
            } else {
              if (colorOf(q) === them) add(pack(s, to, 0, F_CAPTURE));
              break;
            }
            to += d;
          }
        }
      }
    }
    return n;
  }

  private genCastles(add: (m: number) => void) {
    const b = this.board;
    const us = this.side;
    const them = (us ^ 1) as Color;
    if (us === WHITE) {
      if ((this.castling & CASTLE_WK) && !b[5] && !b[6] && !this.attacked(4, them) && !this.attacked(5, them) && !this.attacked(6, them))
        add(pack(4, 6, 0, F_CASTLE));
      if ((this.castling & CASTLE_WQ) && !b[3] && !b[2] && !b[1] && !this.attacked(4, them) && !this.attacked(3, them) && !this.attacked(2, them))
        add(pack(4, 2, 0, F_CASTLE));
    } else {
      if ((this.castling & CASTLE_BK) && !b[117] && !b[118] && !this.attacked(116, them) && !this.attacked(117, them) && !this.attacked(118, them))
        add(pack(116, 118, 0, F_CASTLE));
      if ((this.castling & CASTLE_BQ) && !b[115] && !b[114] && !b[113] && !this.attacked(116, them) && !this.attacked(115, them) && !this.attacked(114, them))
        add(pack(116, 114, 0, F_CASTLE));
    }
  }

  /**
   * Play a pseudo-legal move. Returns false (and leaves the position as it
   * was) when it would leave the mover's king in check.
   */
  make(m: number): boolean {
    const from = mFrom(m);
    const to = mTo(m);
    const flags = mFlags(m);
    const b = this.board;
    const piece = b[from];
    const us = this.side;
    let captured = 0;
    this.stack.push({ move: m, captured: 0, castling: this.castling, ep: this.ep, halfmove: this.halfmove, hashLo: this.hashLo, hashHi: this.hashHi });
    this.histLo.push(this.hashLo);
    this.histHi.push(this.hashHi);
    const undo = this.stack[this.stack.length - 1];

    if (flags & F_EP) {
      const capSq = us === WHITE ? to - 16 : to + 16;
      captured = b[capSq];
      this.remove(capSq);
    } else if (b[to]) {
      captured = b[to];
      this.remove(to);
    }
    undo.captured = captured;
    this.remove(from);
    this.put(to, flags & F_PROMO ? makePiece(us, mPromo(m)) : piece);
    if (flags & F_CASTLE) {
      const [rf, rt] = to === 6 ? [7, 5] : to === 2 ? [0, 3] : to === 118 ? [119, 117] : [112, 115];
      const rook = b[rf];
      this.remove(rf);
      this.put(rt, rook);
    }
    this.setEp(flags & F_DOUBLE ? (from + to) >> 1 : -1);
    if (this.ep >= 0) {
      // Keep the ep square only when an enemy pawn can actually use it.
      this.side = (us ^ 1) as Color;
      const ok = this.epCapturable(this.ep);
      this.side = us;
      if (!ok) this.setEp(-1);
    }
    this.setCastling(this.castling & CASTLE_MASK[from] & CASTLE_MASK[to]);
    this.halfmove = typeOf(piece) === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.side = (us ^ 1) as Color;
    this.hashLo ^= Z_SIDE_LO;
    this.hashHi ^= Z_SIDE_HI;
    if (this.attacked(this.kings[us], this.side)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake(): void {
    const u = this.stack.pop();
    if (!u) return;
    this.histLo.pop();
    this.histHi.pop();
    const m = u.move;
    const from = mFrom(m);
    const to = mTo(m);
    const flags = mFlags(m);
    this.side = (this.side ^ 1) as Color;
    const us = this.side;
    if (us === BLACK) this.fullmove--;
    const moved = this.board[to];
    this.remove(to);
    this.put(from, flags & F_PROMO ? makePiece(us, PAWN) : moved);
    if (flags & F_CASTLE) {
      const [rf, rt] = to === 6 ? [7, 5] : to === 2 ? [0, 3] : to === 118 ? [119, 117] : [112, 115];
      const rook = this.board[rt];
      this.remove(rt);
      this.put(rf, rook);
    }
    if (u.captured) this.put(flags & F_EP ? (us === WHITE ? to - 16 : to + 16) : to, u.captured);
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.hashLo = u.hashLo;
    this.hashHi = u.hashHi;
  }

  /** Pass the move (null move pruning). Undo with unmakeNull. */
  makeNull(): void {
    this.stack.push({ move: 0, captured: 0, castling: this.castling, ep: this.ep, halfmove: this.halfmove, hashLo: this.hashLo, hashHi: this.hashHi });
    this.histLo.push(this.hashLo);
    this.histHi.push(this.hashHi);
    this.setEp(-1);
    this.halfmove++;
    this.side = (this.side ^ 1) as Color;
    this.hashLo ^= Z_SIDE_LO;
    this.hashHi ^= Z_SIDE_HI;
  }

  unmakeNull(): void {
    const u = this.stack.pop()!;
    this.histLo.pop();
    this.histHi.pop();
    this.side = (this.side ^ 1) as Color;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.hashLo = u.hashLo;
    this.hashHi = u.hashHi;
  }

  /** All legal moves. */
  legalMoves(): number[] {
    const pseudo: number[] = [];
    const n = this.generate(pseudo);
    const legal: number[] = [];
    for (let i = 0; i < n; i++) {
      if (this.make(pseudo[i])) {
        this.unmake();
        legal.push(pseudo[i]);
      }
    }
    return legal;
  }

  hasLegalMove(): boolean {
    const pseudo: number[] = [];
    const n = this.generate(pseudo);
    for (let i = 0; i < n; i++) {
      if (this.make(pseudo[i])) {
        this.unmake();
        return true;
      }
    }
    return false;
  }

  /** How many earlier positions (since the last capture or pawn move) equal this one. */
  repetitions(): number {
    let count = 0;
    const len = this.histLo.length;
    const stop = Math.max(0, len - this.halfmove);
    for (let i = len - 2; i >= stop; i -= 2) {
      if (this.histLo[i] === this.hashLo && this.histHi[i] === this.hashHi) count++;
    }
    return count;
  }

  insufficientMaterial(): boolean {
    const c = this.counts;
    if (c[PAWN] || c[ROOK] || c[QUEEN] || c[BLACK_BIT | PAWN] || c[BLACK_BIT | ROOK] || c[BLACK_BIT | QUEEN]) return false;
    const knights = c[KNIGHT] + c[BLACK_BIT | KNIGHT];
    const bishops = c[BISHOP] + c[BLACK_BIT | BISHOP];
    if (knights + bishops <= 1) return true;
    if (knights) return false;
    // Only bishops, all on one square color.
    let colors = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88 || typeOf(this.board[s]) !== BISHOP) continue;
      colors |= 1 << (((s >> 4) + (s & 7)) & 1);
    }
    return colors !== 3;
  }

  /** Why the game is over, or null. */
  gameEnd(): GameEnd | null {
    if (!this.hasLegalMove()) return this.inCheck() ? "checkmate" : "stalemate";
    if (this.halfmove >= 100) return "fifty-move";
    if (this.insufficientMaterial()) return "insufficient";
    if (this.repetitions() >= 2) return "threefold";
    return null;
  }

  /** Static evaluation from the side to move's view, centipawns. */
  evaluate(): number {
    const ph = Math.min(24, this.phase);
    const mg = this.mg[0] - this.mg[1];
    const eg = this.eg[0] - this.eg[1];
    let score = Math.round((mg * ph + eg * (24 - ph)) / 24);
    score += this.bishopPair(WHITE) - this.bishopPair(BLACK);
    return (this.side === WHITE ? score : -score) + 10;
  }

  private bishopPair(c: Color): number {
    return this.counts[makePiece(c, BISHOP)] >= 2 ? 30 : 0;
  }

  /** Material only (pawn = 1, knight/bishop = 3, rook = 5, queen = 9) for `c` minus the other side. */
  material(c: Color): number {
    const points = [0, 1, 3, 3, 5, 9, 0];
    let total = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const p = this.board[s];
      if (p) total += colorOf(p) === c ? points[typeOf(p)] : -points[typeOf(p)];
    }
    return total;
  }

  hasNonPawnMaterial(c: Color): boolean {
    const bit = c ? BLACK_BIT : 0;
    return this.counts[bit | KNIGHT] + this.counts[bit | BISHOP] + this.counts[bit | ROOK] + this.counts[bit | QUEEN] > 0;
  }

  /** The last move played, or 0. */
  lastMove(): number {
    return this.stack.length ? this.stack[this.stack.length - 1].move : 0;
  }
}

// ---------------------------------------------------------------------------
// Move text: UCI and SAN
// ---------------------------------------------------------------------------

export function moveToUci(m: number): string {
  const promo = mFlags(m) & F_PROMO ? " pnbrqk"[mPromo(m)] : "";
  return squareName(mFrom(m)) + squareName(mTo(m)) + promo;
}

/** The legal move for a UCI string ("e2e4", "e7e8q"), or 0. */
export function uciToMove(pos: Position, uci: string): number {
  const from = parseSquare(uci.slice(0, 2));
  const to = parseSquare(uci.slice(2, 4));
  const promo = uci.length > 4 ? " pnbrqk".indexOf(uci[4].toLowerCase()) : 0;
  for (const m of pos.legalMoves()) {
    if (mFrom(m) === from && mTo(m) === to && (mFlags(m) & F_PROMO ? mPromo(m) === promo : promo <= 0)) return m;
  }
  return 0;
}

/** Standard algebraic notation for a legal move in `pos` (e.g. "Nbd7", "exd5", "O-O", "e8=Q#"). */
export function moveToSan(pos: Position, m: number, legal: number[] = pos.legalMoves()): string {
  const from = mFrom(m);
  const to = mTo(m);
  const flags = mFlags(m);
  const piece = pos.board[from];
  const t = typeOf(piece);
  let san: string;
  if (flags & F_CASTLE) san = (to & 7) === 6 ? "O-O" : "O-O-O";
  else {
    const capture = flags & F_CAPTURE ? "x" : "";
    if (t === PAWN) {
      san = (capture ? FILES[from & 7] + "x" : "") + squareName(to);
      if (flags & F_PROMO) san += "=" + " PNBRQK"[mPromo(m)];
    } else {
      let dis = "";
      const rivals = legal.filter((o) => o !== m && mTo(o) === to && pos.board[mFrom(o)] === piece);
      if (rivals.length) {
        const sameFile = rivals.some((o) => (mFrom(o) & 7) === (from & 7));
        const sameRank = rivals.some((o) => mFrom(o) >> 4 === from >> 4);
        if (!sameFile) dis = FILES[from & 7];
        else if (!sameRank) dis = String((from >> 4) + 1);
        else dis = squareName(from);
      }
      san = " PNBRQK"[t] + dis + capture + squareName(to);
    }
  }
  pos.make(m);
  if (pos.inCheck()) san += pos.hasLegalMove() ? "+" : "#";
  pos.unmake();
  return san;
}

/** The legal move for a SAN string, or 0. Tolerates missing +/#, "0-0" and "e8Q". */
export function sanToMove(pos: Position, san: string): number {
  const clean = (s: string) => s.replace(/[+#!?]/g, "").replace(/0/g, "O").replace(/=/, "");
  const want = clean(san);
  const legal = pos.legalMoves();
  for (const m of legal) if (clean(moveToSan(pos, m, legal)) === want) return m;
  return 0;
}

/** Count leaf nodes to `depth` (move generator test). */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves: number[] = [];
  const n = pos.generate(moves);
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (!pos.make(moves[i])) continue;
    total += depth === 1 ? 1 : perft(pos, depth - 1);
    pos.unmake();
  }
  return total;
}
