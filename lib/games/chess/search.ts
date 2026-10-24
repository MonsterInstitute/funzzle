/**
 * Alpha-beta search: iterative deepening, principal variation search, a
 * transposition table, quiescence on captures, MVV-LVA + killer + history
 * move ordering, check extension, null-move pruning and late-move
 * reductions. With `exact` the pruning that can miss a forced line (null
 * move, reductions) is off — the puzzle generator uses that to prove a
 * tactic is unique.
 *
 * Searches limited by depth or nodes are deterministic (the daily puzzle
 * depends on it); a time limit is only for play.
 */
import { F_CAPTURE, F_PROMO, KING, mFlags, mFrom, mPromo, mTo, PAWN, Position, QUEEN, typeOf, VALUE } from "./position";

export const MATE = 32_000;
/** Scores beyond this are forced mates. */
export const MATE_BOUND = MATE - 1_000;
const INF = 1_000_000;
const MAX_PLY = 96;

const TT_BITS = 18;
const TT_SIZE = 1 << TT_BITS;
const TT_EXACT = 1;
const TT_LOWER = 2;
const TT_UPPER = 3;

export interface SearchOptions {
  /** Deepest iteration (default 64). */
  depth?: number;
  /** Stop after about this long (ms); the last finished iteration wins. */
  timeMs?: number;
  /** Keep searching past timeMs until this depth is done (hard cap 3× timeMs). */
  minDepth?: number;
  /** Stop after this many nodes. Deterministic, unlike timeMs. */
  nodes?: number;
  /** Root moves to leave out (second-best search). */
  exclude?: number[];
  /** No null-move pruning or reductions. */
  exact?: boolean;
}

export interface SearchResult {
  /** 0 when there is no legal move (or every move was excluded). */
  move: number;
  /** Centipawns for the side to move; ±(MATE − plies) for forced mates. */
  score: number;
  depth: number;
  pv: number[];
  nodes: number;
}

/** Moves to mate (positive: side to move mates; negative: gets mated), or null. */
export function mateIn(score: number): number | null {
  if (score > MATE_BOUND) return Math.ceil((MATE - score) / 2);
  if (score < -MATE_BOUND) return -Math.ceil((MATE + score) / 2);
  return null;
}

export class Searcher {
  private ttLo = new Int32Array(TT_SIZE);
  private ttHi = new Int32Array(TT_SIZE);
  private ttMove = new Int32Array(TT_SIZE);
  private ttScore = new Int32Array(TT_SIZE);
  private ttMeta = new Int32Array(TT_SIZE); // depth << 2 | flag
  private killers = new Int32Array(MAX_PLY * 2);
  private history = new Int32Array(15 * 128);
  private moveBuf = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(256));
  private scoreBuf = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(256));
  private pvTable = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(MAX_PLY + 8));
  private pvLen = new Int32Array(MAX_PLY + 8);
  private nodes = 0;
  private stopped = false;
  private deadline = Infinity;
  private hardDeadline = Infinity;
  private nodeLimit = Infinity;
  private softStop = false;
  private exact = false;
  private pos!: Position;

  /** Nodes visited by the last search() or scoreMoves() call. */
  get lastNodes(): number {
    return this.nodes;
  }

  clear(): void {
    this.ttMeta.fill(0);
    this.ttLo.fill(0);
    this.ttHi.fill(0);
    this.history.fill(0);
    this.killers.fill(0);
  }

  search(pos: Position, opts: SearchOptions = {}): SearchResult {
    this.pos = pos;
    this.nodes = 0;
    this.stopped = false;
    this.exact = !!opts.exact;
    const now = Date.now();
    this.deadline = opts.timeMs ? now + opts.timeMs : Infinity;
    this.hardDeadline = opts.timeMs ? now + opts.timeMs * 3 : Infinity;
    this.nodeLimit = opts.nodes ?? Infinity;
    this.killers.fill(0);
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 2;
    const maxDepth = Math.min(opts.depth ?? 64, MAX_PLY - 8);
    const exclude = new Set(opts.exclude ?? []);

    const root = pos.legalMoves().filter((m) => !exclude.has(m));
    let best: SearchResult = { move: root[0] ?? 0, score: 0, depth: 0, pv: root[0] ? [root[0]] : [], nodes: 0 };
    if (!root.length) {
      const score = exclude.size ? -INF : pos.inCheck() ? -MATE : 0;
      return { ...best, score };
    }
    let order = this.orderRoot(root, 0);
    for (let depth = 1; depth <= maxDepth; depth++) {
      this.softStop = depth > (opts.minDepth ?? 1);
      const res = this.searchRoot(order, depth);
      if (this.stopped && depth > 1) break;
      best = { ...res, depth, nodes: this.nodes };
      order = [res.move, ...order.filter((m) => m !== res.move)];
      if (this.stopped) break;
      // A forced mate found at full width can't get any shorter.
      if (Math.abs(res.score) > MATE_BOUND && depth >= MATE - Math.abs(res.score) + 1) break;
      if (Date.now() > this.deadline && depth >= (opts.minDepth ?? 1)) break;
    }
    best.nodes = this.nodes;
    return best;
  }

  /** Exact score of every root move to `depth` (weak levels pick among them). */
  scoreMoves(pos: Position, depth: number): { move: number; score: number }[] {
    this.pos = pos;
    this.nodes = 0;
    this.stopped = false;
    this.exact = false;
    this.deadline = this.hardDeadline = Infinity;
    this.nodeLimit = Infinity;
    const out: { move: number; score: number }[] = [];
    for (const m of pos.legalMoves()) {
      pos.make(m);
      const score = -this.negamax(depth - 1, -INF, INF, 1, true);
      pos.unmake();
      out.push({ move: m, score });
    }
    return out;
  }

  private orderRoot(moves: number[], ttMove: number): number[] {
    const scored = moves.map((m) => ({ m, s: this.moveScore(m, ttMove, 0) }));
    scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.m);
  }

  private searchRoot(moves: number[], depth: number): { move: number; score: number; pv: number[] } {
    const pos = this.pos;
    let alpha = -INF;
    const beta = INF;
    let bestMove = moves[0];
    let bestScore = -INF;
    this.pvLen[0] = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      pos.make(m);
      let score: number;
      if (i === 0) score = -this.negamax(depth - 1, -beta, -alpha, 1, true);
      else {
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, 1, true);
        if (score > alpha && !this.stopped) score = -this.negamax(depth - 1, -beta, -alpha, 1, true);
      }
      pos.unmake();
      if (this.stopped) break;
      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
        if (score > alpha) {
          alpha = score;
          this.updatePv(0, m);
        }
      }
    }
    const pv = this.pvLen[0] && this.pvTable[0][0] === bestMove ? Array.from(this.pvTable[0].subarray(0, this.pvLen[0])) : [bestMove];
    return { move: bestMove, score: bestScore, pv };
  }

  private updatePv(ply: number, m: number) {
    const row = this.pvTable[ply];
    const next = this.pvTable[ply + 1];
    row[0] = m;
    const n = this.pvLen[ply + 1];
    for (let i = 0; i < n; i++) row[i + 1] = next[i];
    this.pvLen[ply] = n + 1;
  }

  private checkLimits() {
    if (this.nodes >= this.nodeLimit) this.stopped = true;
    else if ((this.nodes & 1023) === 0) {
      const t = Date.now();
      if (t > this.hardDeadline || (this.softStop && t > this.deadline)) this.stopped = true;
    }
  }

  private moveScore(m: number, ttMove: number, ply: number): number {
    if (m === ttMove) return 10_000_000;
    const flags = mFlags(m);
    const b = this.pos.board;
    if (flags & F_CAPTURE) {
      const victim = typeOf(b[mTo(m)]) || PAWN;
      return 1_000_000 + VALUE[victim] * 10 - VALUE[typeOf(b[mFrom(m)])] / 10 + (flags & F_PROMO ? VALUE[mPromo(m)] : 0);
    }
    if (flags & F_PROMO) return mPromo(m) === QUEEN ? 900_000 : -1000;
    if (this.killers[ply * 2] === m) return 800_000;
    if (this.killers[ply * 2 + 1] === m) return 700_000;
    return this.history[b[mFrom(m)] * 128 + mTo(m)];
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, nullOk: boolean): number {
    const pos = this.pos;
    this.pvLen[ply] = 0;
    if (pos.halfmove >= 100 || pos.repetitions() >= 1 || (pos.phase <= 2 && pos.insufficientMaterial())) return 0;
    if (ply >= MAX_PLY) return pos.evaluate();
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);
    this.nodes++;
    this.checkLimits();
    if (this.stopped) return 0;

    // Mate distance pruning.
    alpha = Math.max(alpha, -MATE + ply);
    beta = Math.min(beta, MATE - ply - 1);
    if (alpha >= beta) return alpha;

    const pvNode = beta - alpha > 1;
    const idx = pos.hashLo & (TT_SIZE - 1);
    let ttMove = 0;
    if (this.ttLo[idx] === pos.hashLo && this.ttHi[idx] === pos.hashHi && this.ttMeta[idx]) {
      ttMove = this.ttMove[idx];
      const ttDepth = this.ttMeta[idx] >> 2;
      const flag = this.ttMeta[idx] & 3;
      if (ttDepth >= depth && !pvNode) {
        let s = this.ttScore[idx];
        if (s > MATE_BOUND) s -= ply;
        else if (s < -MATE_BOUND) s += ply;
        if (flag === TT_EXACT || (flag === TT_LOWER && s >= beta) || (flag === TT_UPPER && s <= alpha)) return s;
      }
    }

    if (!this.exact && nullOk && !inCheck && !pvNode && depth >= 3 && pos.hasNonPawnMaterial(pos.side) && pos.evaluate() >= beta) {
      pos.makeNull();
      const s = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (this.stopped) return 0;
      if (s >= beta && s < MATE_BOUND) return beta;
    }

    const moves = this.moveBuf[ply];
    const scores = this.scoreBuf[ply];
    const n = pos.generate(moves);
    for (let i = 0; i < n; i++) scores[i] = this.moveScore(moves[i], ttMove, ply);

    let legal = 0;
    let bestScore = -INF;
    let bestMove = 0;
    const alphaStart = alpha;
    for (let i = 0; i < n; i++) {
      // Selection sort: the next best-ordered move.
      let bi = i;
      for (let j = i + 1; j < n; j++) if (scores[j] > scores[bi]) bi = j;
      const m = moves[bi];
      moves[bi] = moves[i];
      moves[i] = m;
      const ms = scores[bi];
      scores[bi] = scores[i];
      scores[i] = ms;
      if (!pos.make(m)) continue;
      legal++;
      const quiet = !(mFlags(m) & (F_CAPTURE | F_PROMO));
      let score: number;
      if (legal === 1) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        let r = 0;
        if (!this.exact && quiet && depth >= 3 && legal > 3 && !inCheck && !pos.inCheck()) r = legal > 8 ? 2 : 1;
        score = -this.negamax(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (r && score > alpha) score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
        if (score > alpha) {
          alpha = score;
          this.updatePv(ply, m);
          if (score >= beta) {
            if (quiet) {
              if (this.killers[ply * 2] !== m) {
                this.killers[ply * 2 + 1] = this.killers[ply * 2];
                this.killers[ply * 2] = m;
              }
              const h = pos.board[mFrom(m)] * 128 + mTo(m);
              this.history[h] = Math.min(600_000, this.history[h] + depth * depth);
            }
            break;
          }
        }
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;

    const flag = bestScore >= beta ? TT_LOWER : bestScore > alphaStart ? TT_EXACT : TT_UPPER;
    const stored = bestScore > MATE_BOUND ? bestScore + ply : bestScore < -MATE_BOUND ? bestScore - ply : bestScore;
    const oldDepth = this.ttMeta[idx] >> 2;
    if (depth >= oldDepth || this.ttLo[idx] !== pos.hashLo) {
      this.ttLo[idx] = pos.hashLo;
      this.ttHi[idx] = pos.hashHi;
      this.ttMove[idx] = bestMove;
      this.ttScore[idx] = stored;
      this.ttMeta[idx] = (depth << 2) | flag;
    }
    return bestScore;
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    const pos = this.pos;
    this.nodes++;
    this.checkLimits();
    if (this.stopped) return 0;
    const stand = pos.evaluate();
    if (ply >= MAX_PLY) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const moves = this.moveBuf[ply];
    const scores = this.scoreBuf[ply];
    const n = pos.generate(moves, 0, true);
    for (let i = 0; i < n; i++) scores[i] = this.moveScore(moves[i], 0, ply);
    let best = stand;
    for (let i = 0; i < n; i++) {
      let bi = i;
      for (let j = i + 1; j < n; j++) if (scores[j] > scores[bi]) bi = j;
      const m = moves[bi];
      moves[bi] = moves[i];
      moves[i] = m;
      const ms = scores[bi];
      scores[bi] = scores[i];
      scores[i] = ms;
      // Delta pruning: even winning this piece can't lift alpha.
      const victim = typeOf(pos.board[mTo(m)]);
      if (victim !== KING && !(mFlags(m) & F_PROMO) && stand + VALUE[victim || PAWN] + 200 < alpha) continue;
      if (!pos.make(m)) continue;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stopped) return 0;
      if (score > best) {
        best = score;
        if (score > alpha) {
          alpha = score;
          if (score >= beta) break;
        }
      }
    }
    return best;
  }
}
