/**
 * Chess puzzles from seeded self-play. Engine players of mixed strength play
 * a game from the start; whenever the side to move has a tactic, an exact
 * (no-pruning) search checks it:
 *
 *  - mate in 1–3 where no other first move mates at all, and every later
 *    solver move is the only one that keeps the mate on time; or
 *  - winning at least 3 points of material, where the best move beats the
 *    second-best by 2.5 pawns or more and the alternatives don't win.
 *
 * The solution alternates the solver's moves with the opponent's best
 * (longest) defence. Everything is depth- or node-limited, never timed, so a
 * puzzle is a pure function of its seed: the daily one is the same in the
 * cron, on the page and in the browser.
 */
import { createRng, hashSeed, type Rng } from "@/lib/games/kit/rng";
import { moveToSan, moveToUci, Position, START_FEN, type Color } from "./position";
import { mateIn, MATE_BOUND, Searcher } from "./search";
import { detectThemes, type Theme } from "./themes";

export type PuzzleDifficulty = "easy" | "medium" | "hard";

export interface ChessPuzzle {
  seed: string;
  /** Start position; the solver is the side to move. */
  fen: string;
  /** The opponent's move that led here (UCI), shown as the last move. */
  lastMove: string | null;
  /** UCI moves: solver, reply, solver, … ending with a solver move. */
  solution: string[];
  /** The same line in SAN, for the recap and the coach. */
  san: string[];
  kind: "mate" | "material";
  /** Moves to mate (mate puzzles). */
  mate: number | null;
  /** Material won, in points (pawn = 1). */
  gain: number;
  difficulty: PuzzleDifficulty;
  themes: Theme[];
}

export const PUZZLE_DIFFICULTY_LABEL: Record<PuzzleDifficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

const VERIFY_DEPTH = 5;
/** Margin the best move must beat the second-best by (material puzzles). */
const MARGIN = 250;
/** Node budget for one seed before giving up on the self-play loop. */
const NODE_BUDGET = 5_000_000;

export interface GenerateStats {
  attempts: number;
  candidates: number;
  nodes: number;
}

function difficultyFor(solverMoves: number): PuzzleDifficulty {
  return solverMoves >= 3 ? "hard" : solverMoves === 2 ? "medium" : "easy";
}

class Budget {
  nodes = 0;
  candidates = 0;
  constructor(public s: Searcher) {}
  search(pos: Position, opts: Parameters<Searcher["search"]>[1]) {
    const r = this.s.search(pos, opts);
    this.nodes += r.nodes;
    return r;
  }
}

/** Self-play move: mostly a shallow search, sometimes a plausible alternative. */
function playMove(pos: Position, b: Budget, rng: Rng, ply: number, weakSide: Color): number {
  const legal = pos.legalMoves();
  if (legal.length === 1) return legal[0];
  const opening = ply < 8;
  const weak = pos.side === weakSide;
  if (opening || rng.next() < (weak ? 0.3 : 0.1)) {
    // A reasonable-looking move: one of the best few by a 1-ply look.
    const scored = b.s.scoreMoves(pos, 1);
    b.nodes += b.s.lastNodes;
    scored.sort((x, y) => y.score - x.score || x.move - y.move);
    const pool = scored.filter((s) => s.score >= scored[0].score - (opening ? 60 : 200)).slice(0, opening ? 5 : 4);
    return pool[rng.int(pool.length)].move;
  }
  return b.search(pos, { depth: weak ? 1 : 2 }).move;
}

/** Check a candidate position; returns the puzzle or null. */
export function verifyPosition(pos: Position, b: Budget = new Budget(new Searcher())): Omit<ChessPuzzle, "seed" | "lastMove"> | null {
  const work = pos.clone();
  const player = work.side;
  const first = b.search(work, { depth: VERIFY_DEPTH, exact: true });
  if (!first.move) return null;
  const mate = mateIn(first.score);
  const second = b.search(work, { depth: VERIFY_DEPTH, exact: true, exclude: [first.move] });
  const line: number[] = [];
  let gain = 0;

  if (mate !== null && mate > 0) {
    if (mate > 3 || (mateIn(second.score) ?? 0) > 0) return null;
    let left = mate;
    let move = first.move;
    while (left > 0) {
      line.push(move);
      work.make(move);
      if (left === 1) {
        if (work.hasLegalMove() || !work.inCheck()) return null;
        break;
      }
      const reply = b.search(work, { depth: 2 * left - 2, exact: true });
      if (!reply.move) return null;
      line.push(reply.move);
      work.make(reply.move);
      left--;
      const next = b.search(work, { depth: 2 * left - 1, exact: true });
      const n = mateIn(next.score);
      if (n === null || n <= 0 || n > left) return null;
      if (n < left) left = n;
      if (left > 1) {
        // Later solver moves must be the only way to keep the mate on time.
        const alt = b.search(work, { depth: 2 * left - 1, exact: true, exclude: [next.move] });
        const an = mateIn(alt.score);
        if (an !== null && an > 0 && an <= left) return null;
      }
      move = next.move;
    }
  } else {
    if (first.score < MARGIN || first.score > MATE_BOUND) return null;
    if (second.score > first.score - MARGIN || second.score > 150) return null;
    const start = work.material(player);
    if (start < -1) return null;
    let move = first.move;
    for (let k = 0; ; k++) {
      line.push(move);
      work.make(move);
      if (!work.hasLegalMove()) return null; // mate or stalemate: not a material puzzle
      const reply = b.search(work, { depth: 4, exact: true });
      work.make(reply.move);
      gain = work.material(player) - start;
      work.unmake();
      if (gain >= 3) break;
      if (k === 2) return null;
      line.push(reply.move);
      work.make(reply.move);
      const a = b.search(work, { depth: 4, exact: true });
      const alt = b.search(work, { depth: 4, exact: true, exclude: [a.move] });
      if (!a.move || a.score < MARGIN || a.score - alt.score < 200) return null;
      move = a.move;
    }
  }

  // Replay for SAN and UCI from the start position.
  const replay = pos.clone();
  const san: string[] = [];
  const uci: string[] = [];
  for (const m of line) {
    san.push(moveToSan(replay, m));
    uci.push(moveToUci(m));
    replay.make(m);
  }
  const fen = pos.toFen();
  const solverMoves = Math.ceil(line.length / 2);
  return {
    fen,
    solution: uci,
    san,
    kind: mate ? "mate" : "material",
    mate: mate && mate > 0 ? Math.ceil(line.length / 2) : null,
    gain,
    difficulty: difficultyFor(solverMoves),
    themes: detectThemes(fen, uci, mate && mate > 0 ? Math.ceil(line.length / 2) : null),
  };
}

/**
 * A puzzle for `seed` (e.g. "chess:2026-10-24"). Deterministic. Throws only
 * if the node budget runs out without a puzzle, which tests guard against.
 */
export function generatePuzzle(seed: string, stats?: GenerateStats): ChessPuzzle {
  const b = new Budget(new Searcher());
  for (let attempt = 0; b.nodes < NODE_BUDGET; attempt++) {
    if (stats) stats.attempts = attempt + 1;
    const rng = createRng(`${seed}:${attempt}`);
    const pos = Position.fromFen(START_FEN);
    const weakSide = rng.int(2) as Color;
    for (let ply = 0; ply < 120; ply++) {
      if (pos.gameEnd()) break;
      if (ply >= 12) {
        // Cheap probe for the side to move before the exact check.
        const probe = b.search(pos, { depth: 3 });
        const mat = pos.material(pos.side);
        if (probe.score >= MARGIN && mat >= -1 && mat <= 3 && plausiblyUnique(pos, b, probe.move, probe.score)) {
          b.candidates++;
          const found = verifyPosition(pos, b);
          if (found) {
            if (stats) Object.assign(stats, { candidates: b.candidates, nodes: b.nodes });
            const last = pos.lastMove();
            return { seed, lastMove: last ? moveToUci(last) : null, ...found };
          }
        }
      }
      pos.make(playMove(pos, b, rng, ply, weakSide));
      if (b.nodes >= NODE_BUDGET) break;
    }
  }
  // Rare: no tactic within the budget. Fall back to a stored, re-verified position.
  for (let i = 0; i < FALLBACK.length; i++) {
    const fen = FALLBACK[(hashSeed(seed) + i) % FALLBACK.length];
    const found = verifyPosition(Position.fromFen(fen), b);
    if (found) return { seed, lastMove: null, ...found };
  }
  throw new Error(`generatePuzzle: no puzzle for ${seed}`);
}

/** Cheap shallow test that no second move is about as good, before the exact check. */
function plausiblyUnique(pos: Position, b: Budget, best: number, score: number): boolean {
  const alt = b.search(pos, { depth: 3, exclude: [best] });
  if (score > MATE_BOUND) return alt.score <= MATE_BOUND;
  return alt.score <= score - MARGIN + 50;
}

/** Puzzles found by this generator, used if a seed's self-play runs dry. */
export const FALLBACK = [
  "r1b1r1k1/1pp2ppp/p2bp3/4N1B1/3P1Q2/8/PPq2PPP/1R3RK1 w - - 0 17",
  "4r1k1/4Rpp1/3Q4/4P3/5q1p/8/5PPP/6K1 b - - 3 34",
  "r5kr/ppq2p1p/1bp1b2Q/4P3/3pN3/3B3P/PPP2PP1/3R1RK1 w - - 6 24",
  "6k1/1Q3pp1/p6p/4r2P/qP1p4/3P4/1r3PP1/3RR1K1 w - - 0 39",
  "r3kb1r/ppp2ppp/3q4/1N2n3/5B2/8/PPP2PPP/1R1QK2R b Kkq - 0 12",
  "r5kr/1ppq1ppp/p7/3p1b2/3Bn3/4PQ2/PPP2PPP/1K1R1B1R b - - 0 15",
  "r2qkb1r/ppp3pp/2n1p3/8/2B1p3/1Q6/PPPPKPPP/R1B4R b kq - 0 13",
  "3rr1k1/1pp2pp1/p1q4p/4b3/4p2Q/P3P3/1PP1RPPP/R1B3K1 b - - 3 20",
];

