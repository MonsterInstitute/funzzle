/**
 * Chess coach: the engine's best move with a plain-English "why" — mates,
 * captures, threats and forks, checks, escaping an attack, stopping the
 * opponent's threat, development, castling and king safety.
 */
import {
  BISHOP,
  colorOf,
  F_CASTLE,
  F_PROMO,
  KING,
  KNIGHT,
  mFlags,
  mFrom,
  mPromo,
  mTo,
  moveToSan,
  moveToUci,
  PAWN,
  Position,
  QUEEN,
  ROOK,
  squareName,
  typeOf,
  VALUE,
} from "./position";
import { mateIn, MATE_BOUND, Searcher } from "./search";
import { attacksFrom } from "./themes";

export const PIECE_NAME = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];

export type HintReason = "mate" | "capture" | "promote" | "fork" | "threat" | "check" | "escape" | "defend" | "castle" | "develop" | "centre" | "improve";

export interface ChessHint {
  uci: string;
  san: string;
  /** "Play Nf3: move your knight from g1 to f3." */
  text: string;
  /** Short reasons, most important first. */
  why: string[];
  reason: HintReason;
  /** Engine score for the side to move after the best line, centipawns. */
  score: number;
  mate: number | null;
}

const worth = (t: number) => (t === KING ? 10_000 : VALUE[t]);

/** What the opponent would win if it were their move now (their best capture/mate), or null. */
function opponentThreat(pos: Position, s: Searcher): { move: number; score: number } | null {
  if (pos.inCheck()) return null;
  pos.makeNull();
  const r = s.search(pos, { depth: 3 });
  pos.unmakeNull();
  // Compare with how they'd stand anyway (static view from their side).
  const base = -pos.evaluate();
  return r.move && (r.score > MATE_BOUND || r.score - base >= 250) ? { move: r.move, score: r.score } : null;
}

export function describeMove(pos: Position, m: number): string {
  const from = mFrom(m);
  const to = mTo(m);
  const t = typeOf(pos.board[from]);
  if (mFlags(m) & F_CASTLE) return (to & 7) === 6 ? "castle kingside" : "castle queenside";
  const target = pos.board[to];
  const verb = target ? `take the ${PIECE_NAME[typeOf(target)]} on ${squareName(to)} with your ${PIECE_NAME[t]}` : `move your ${PIECE_NAME[t]} from ${squareName(from)} to ${squareName(to)}`;
  return mFlags(m) & F_PROMO ? `${verb} and promote to a ${PIECE_NAME[mPromo(m)]}` : verb;
}

/**
 * Explain `move` in `pos`. `score` is the engine's evaluation of the move for
 * the side to move (from the search), used for the closing sentence.
 */
export function explainMove(pos: Position, move: number, score: number, s: Searcher = new Searcher()): ChessHint {
  const san = moveToSan(pos, move);
  const from = mFrom(move);
  const to = mTo(move);
  const flags = mFlags(move);
  const us = pos.side;
  const mover = pos.board[from];
  const t = typeOf(mover);
  const victim = pos.board[to] || (flags & 2 ? 1 : 0);
  const why: string[] = [];
  let reason: HintReason = "improve";
  const set = (r: HintReason) => {
    if (reason === "improve") reason = r;
  };

  const threatBefore = opponentThreat(pos, s);
  const attackedBefore = pos.attacked(from, (us ^ 1) as 0 | 1);
  const defendedBefore = pos.attacked(from, us);

  pos.make(move);
  const mate = mateIn(score);
  const isMate = !pos.hasLegalMove() && pos.inCheck();
  if (isMate) {
    why.push("It’s checkmate: the king is in check and has no way out.");
    set("mate");
  } else if (mate !== null && mate > 0) {
    why.push(`It starts a forced mate in ${mate}: every reply loses.`);
    set("mate");
  }

  if (victim) {
    const vt = typeOf(victim);
    const recapture = pos.attacked(to, (us ^ 1) as 0 | 1);
    if (!recapture) why.push(`It wins the ${PIECE_NAME[vt]} on ${squareName(to)} for free: nothing can take back.`);
    else if (worth(vt) > worth(t)) why.push(`It trades up: your ${PIECE_NAME[t]} for their ${PIECE_NAME[vt]}.`);
    else if (worth(vt) === worth(t)) why.push(`It trades ${PIECE_NAME[t]}s, which suits the side that’s ahead.`);
    else why.push(`It takes the ${PIECE_NAME[vt]} on ${squareName(to)}.`);
    set("capture");
  }
  if (flags & F_PROMO) {
    why.push(`The pawn becomes a ${PIECE_NAME[mPromo(move)]}.`);
    set("promote");
  }
  const givesCheck = pos.inCheck();
  if (givesCheck && !isMate) {
    why.push("It’s check, so they have to deal with the king before anything else.");
    set("check");
  }

  // New attacks from the moved piece: kings, bigger pieces, undefended pieces.
  const hits = attacksFrom(pos, to).filter((sq) => {
    const q = pos.board[sq];
    if (!q || colorOf(q) === us) return false;
    const qt = typeOf(q);
    return qt === KING || worth(qt) > worth(typeOf(pos.board[to])) || (qt !== PAWN && !pos.attacked(sq, colorOf(q)));
  });
  if (!isMate && hits.length >= 2) {
    const names = hits.slice(0, 2).map((sq) => (typeOf(pos.board[sq]) === KING ? "the king" : `the ${PIECE_NAME[typeOf(pos.board[sq])]} on ${squareName(sq)}`));
    why.push(`It’s a fork: it attacks ${names[0]} and ${names[1]} at once, and they can’t save both.`);
    set("fork");
  } else if (!isMate && hits.length === 1 && typeOf(pos.board[hits[0]]) !== KING) {
    why.push(`It attacks the ${PIECE_NAME[typeOf(pos.board[hits[0]])]} on ${squareName(hits[0])}.`);
    set("threat");
  }

  if (attackedBefore && (!defendedBefore || t === QUEEN) && !victim && !pos.attacked(to, (us ^ 1) as 0 | 1) && t !== PAWN && t !== KING) {
    why.push(`It moves your ${PIECE_NAME[t]} out of danger.`);
    set("escape");
  }

  if (threatBefore && !isMate) {
    const after = opponentThreatAfter(pos, s, threatBefore.move);
    if (after) {
      const tm = threatBefore.move;
      const what = threatBefore.score > MATE_BOUND ? "a mating attack" : pieceAt(pos, mTo(tm)) ? `taking on ${squareName(mTo(tm))}` : `${squareName(mFrom(tm))}–${squareName(mTo(tm))}`;
      why.push(`It stops their threat of ${what}.`);
      set("defend");
    }
  }

  if (flags & F_CASTLE) {
    why.push("Castling tucks your king behind its pawns and brings a rook toward the centre.");
    set("castle");
  } else if ((t === KNIGHT || t === BISHOP) && from >> 4 === (us === 0 ? 0 : 7) && pos.fullmove <= 15) {
    why.push(`It develops your ${PIECE_NAME[t]}: pieces do more off the back rank, and it clears the way to castle.`);
    set("develop");
  } else if (t === PAWN && [51, 52, 67, 68].includes(to) && pos.fullmove <= 12) {
    why.push("It stakes a claim in the centre, where your pieces want to be.");
    set("centre");
  } else if (t === KING && pos.phase > 12 && !givesCheck) {
    why.push("It keeps your king safer.");
  }
  pos.unmake();

  if (!why.length) why.push(t === ROOK ? "It puts the rook on a more active square." : "It improves your worst-placed piece without allowing anything.");
  if (!isMate) why.push(scoreLine(score));

  const text = `Play ${san}: ${describeMove(pos, move)}.`;
  return { uci: moveToUci(move), san, text, why, reason, score, mate: isMate ? 1 : mate };
}

function pieceAt(pos: Position, sq: number) {
  return pos.board[sq] !== 0;
}

/** Is the opponent's earlier threat (their best move if it were their turn) still on after our move? */
function opponentThreatAfter(pos: Position, s: Searcher, threat: number): boolean {
  // Our move is already made: it's their turn now.
  const r = s.search(pos, { depth: 3 });
  const stillWorks = r.move === threat && (r.score > MATE_BOUND || r.score >= 250);
  return !stillWorks;
}

export interface GameReview {
  /** The player's move that improved their position most (punishing a slip, winning material). */
  key: { moveNo: number; san: string; swing: number } | null;
  /** The player's costliest move and what the engine preferred. */
  worst: { moveNo: number; san: string; loss: number; better: string } | null;
}

/**
 * Post-game review for the recap: a short search on each of `color`'s moves.
 * `moves` are UCI from `fen`.
 */
export function reviewGame(fen: string, moves: string[], color: 0 | 1, s: Searcher = new Searcher()): GameReview {
  const pos = Position.fromFen(fen);
  let key: GameReview["key"] = null;
  let worst: GameReview["worst"] = null;
  let prevAfter: number | null = null;
  const cap = (v: number) => Math.max(-3000, Math.min(3000, v));
  for (const u of moves) {
    const legal = pos.legalMoves();
    const m = legal.find((x) => moveToUci(x) === u);
    if (!m) break;
    if (pos.side !== color) {
      pos.make(m);
      continue;
    }
    const best = s.search(pos, { depth: 3 });
    const san = moveToSan(pos, m, legal);
    const better = best.move && best.move !== m ? moveToSan(pos, best.move, legal) : "";
    const moveNo = pos.fullmove;
    pos.make(m);
    const after = pos.hasLegalMove() ? -s.search(pos, { depth: 2 }).score : pos.inCheck() ? 32_000 : 0;
    const loss = cap(best.score) - cap(after);
    if (better && loss >= 150 && (!worst || loss > worst.loss)) worst = { moveNo, san, loss, better };
    if (prevAfter !== null) {
      const swing = cap(after) - cap(prevAfter);
      if (swing >= 150 && (!key || swing > key.swing)) key = { moveNo, san, swing };
    }
    prevAfter = after;
  }
  return { key, worst };
}

export function scoreLine(score: number): string {
  const mate = mateIn(score);
  if (mate !== null) return mate > 0 ? `The engine sees mate in ${mate}.` : `The engine sees you getting mated in ${-mate} whatever you do; this lasts longest.`;
  const pawns = Math.abs(score) / 100;
  if (pawns < 0.4) return "The position stays about level.";
  const amount = pawns >= 3 ? "a winning position" : pawns >= 1.5 ? `about ${pawns.toFixed(1)} pawns more` : "a small edge";
  return score > 0 ? `After it, the engine gives you ${amount}.` : `You’re worse here, but this is the toughest defence.`;
}
