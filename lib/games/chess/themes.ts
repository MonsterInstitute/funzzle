/**
 * Tactic themes for puzzles (the chess skill tree): detected from the
 * position and the solution line, so every daily and practice puzzle is
 * tagged the same way the coach talks about it.
 */
import { BISHOP, colorOf, KING, KNIGHT, mFrom, mTo, PAWN, Position, QUEEN, ROOK, typeOf, uciToMove, VALUE, type Color } from "./position";

export type Theme = "mate-in-1" | "mate-in-2" | "mate-in-3" | "back-rank" | "fork" | "pin" | "skewer" | "discovered-attack" | "win-material";

export const THEME_INFO: Record<Theme, { name: string; what: string; tip: string }> = {
  "mate-in-1": { name: "Mate in 1", what: "Find the one move that ends it", tip: "Check every check first: most mates in one are a check the king can’t escape." },
  "win-material": { name: "Win material", what: "Win a piece or more by force", tip: "Look for pieces that are attacked more times than they are defended." },
  fork: { name: "Fork", what: "One piece attacks two at once", tip: "Knights and queens fork best: look for a square that hits the king and an undefended piece together." },
  pin: { name: "Pin", what: "A piece can’t move without exposing a bigger one", tip: "Line up a bishop, rook or queen with the enemy king or queen and the piece in front is stuck." },
  skewer: { name: "Skewer", what: "Attack a big piece, win the one behind it", tip: "A skewer is a pin in reverse: check the king or attack the queen on a line, and take what’s behind." },
  "discovered-attack": { name: "Discovered attack", what: "Move one piece to unmask another", tip: "When a piece stands between your rook, bishop or queen and a target, moving it with a threat gives two attacks at once." },
  "back-rank": { name: "Back-rank mate", what: "Mate a king trapped behind its pawns", tip: "A castled king with no escape square is weak on its first rank: look for a rook or queen check there." },
  "mate-in-2": { name: "Mate in 2", what: "A forcing two-move mate", tip: "Forcing moves first: checks, then captures, then threats. Ask what the reply must be." },
  "mate-in-3": { name: "Mate in 3", what: "A three-move mating attack", tip: "Picture the final mating net, then work back to the checks that drive the king into it." },
};

export const THEMES = Object.keys(THEME_INFO) as Theme[];

const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
const K_OFF = [1, -1, 16, -16, 17, 15, -17, -15];
const B_OFF = [17, 15, -17, -15];
const R_OFF = [1, -1, 16, -16];

const worth = (p: number) => (typeOf(p) === KING ? 10_000 : VALUE[typeOf(p)]);

/** Squares the piece on `s` attacks. */
export function attacksFrom(pos: Position, s: number): number[] {
  const p = pos.board[s];
  const t = typeOf(p);
  const out: number[] = [];
  if (t === PAWN) {
    const dir = colorOf(p) === 0 ? 16 : -16;
    for (const d of [dir - 1, dir + 1]) if (!((s + d) & 0x88)) out.push(s + d);
  } else if (t === KNIGHT || t === KING) {
    for (const d of t === KNIGHT ? N_OFF : K_OFF) if (!((s + d) & 0x88)) out.push(s + d);
  } else if (t) {
    for (const d of t === BISHOP ? B_OFF : t === ROOK ? R_OFF : K_OFF) {
      let to = s + d;
      while (!(to & 0x88)) {
        out.push(to);
        if (pos.board[to]) break;
        to += d;
      }
    }
  }
  return out;
}

const defended = (pos: Position, s: number) => pos.attacked(s, colorOf(pos.board[s]));

/** Enemy pieces the piece on `s` attacks that matter: the king, bigger pieces, or undefended ones. */
function targets(pos: Position, s: number): number[] {
  const mover = pos.board[s];
  const us = colorOf(mover);
  return attacksFrom(pos, s).filter((t) => {
    const q = pos.board[t];
    if (!q || colorOf(q) === us) return false;
    return typeOf(q) === KING || worth(q) > worth(mover) || (typeOf(q) !== PAWN && !defended(pos, t));
  });
}

function sliderDirs(t: number): number[] {
  return t === BISHOP ? B_OFF : t === ROOK ? R_OFF : t === QUEEN ? K_OFF : [];
}

/** Pin or skewer made by the slider on `s` (after its move). */
function lineTactic(pos: Position, s: number): "pin" | "skewer" | null {
  const p = pos.board[s];
  const us = colorOf(p);
  for (const d of sliderDirs(typeOf(p))) {
    let to = s + d;
    let first = -1;
    while (!(to & 0x88)) {
      const q = pos.board[to];
      if (q) {
        if (colorOf(q) === us) break;
        if (first < 0) first = to;
        else {
          const front = pos.board[first];
          const back = q;
          if (typeOf(back) === KING || (worth(back) > worth(front) && worth(back) > worth(p) && typeOf(front) !== PAWN)) {
            if (typeOf(front) !== KING && typeOf(front) !== PAWN) return "pin";
          } else if ((typeOf(front) === KING || worth(front) > worth(back)) && typeOf(back) !== PAWN && (worth(back) >= worth(p) || !defended(pos, to))) {
            return "skewer";
          }
          break;
        }
      }
      to += d;
    }
  }
  return null;
}

/** A line from one of `us`'s sliders through `from` that the move opened onto a target. */
function discovered(pos: Position, from: number, movedTo: number, us: Color): boolean {
  for (let s = 0; s < 128; s++) {
    if (s & 0x88 || s === movedTo) continue;
    const p = pos.board[s];
    if (!p || colorOf(p) !== us) continue;
    for (const d of sliderDirs(typeOf(p))) {
      // Is `from` on this ray with nothing in between?
      let to = s + d;
      let through = false;
      while (!(to & 0x88)) {
        if (to === from) {
          through = true;
          break;
        }
        if (pos.board[to]) break;
        to += d;
      }
      if (!through) continue;
      to = from + d;
      while (!(to & 0x88)) {
        const q = pos.board[to];
        if (q) {
          if (colorOf(q) !== us && (typeOf(q) === KING || worth(q) > worth(p) || (typeOf(q) !== PAWN && !defended(pos, to)))) return true;
          break;
        }
        to += d;
      }
    }
  }
  return false;
}

/**
 * Themes of a puzzle: the solution line alternates the solver's moves and the
 * forced replies, starting from `fen`.
 */
export function detectThemes(fen: string, line: string[], mate: number | null): Theme[] {
  const pos = Position.fromFen(fen);
  const us = pos.side;
  const found = new Set<Theme>();
  if (mate) found.add(mate >= 3 ? "mate-in-3" : mate === 2 ? "mate-in-2" : "mate-in-1");
  for (let i = 0; i < line.length; i++) {
    const m = uciToMove(pos, line[i]);
    if (!m) break;
    if (i % 2 === 0) {
      const from = mFrom(m);
      const to = mTo(m);
      pos.make(m);
      if (targets(pos, to).length >= 2) found.add("fork");
      const lt = typeOf(pos.board[to]) >= BISHOP && typeOf(pos.board[to]) <= QUEEN ? lineTactic(pos, to) : null;
      if (lt) found.add(lt);
      if (discovered(pos, from, to, us)) found.add("discovered-attack");
    } else pos.make(m);
  }
  if (mate && !pos.hasLegalMove() && pos.inCheck()) {
    const k = pos.kings[pos.side];
    const backRank = pos.side === 0 ? 0 : 7;
    if (k >> 4 === backRank) {
      const last = pos.lastMove();
      const checker = pos.board[mTo(last)];
      if ((typeOf(checker) === ROOK || typeOf(checker) === QUEEN) && mTo(last) >> 4 === backRank) found.add("back-rank");
    }
  }
  if (!mate) found.add("win-material");
  return THEMES.filter((t) => found.has(t));
}
