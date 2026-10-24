/**
 * Computer opponent levels 1–6, from "beginner" (one-move lookahead and
 * frequent blunders) to "strong" (about 1.5 s of full search, depth 5+).
 * Weak levels score every root move and pick with noise; the rest play the
 * search's best move. Randomness comes from a seeded RNG so a game can be
 * replayed, and a Web Worker runs it in the browser (./worker.ts).
 */
import { createRng, type Rng } from "@/lib/games/kit/rng";
import { Position } from "./position";
import { MATE_BOUND, Searcher, type SearchResult } from "./search";

export type Level = 1 | 2 | 3 | 4 | 5 | 6;
export const LEVELS: Level[] = [1, 2, 3, 4, 5, 6];

export interface LevelInfo {
  name: string;
  blurb: string;
}

export const LEVEL_INFO: Record<Level, LevelInfo> = {
  1: { name: "Beginner", blurb: "Looks one move ahead and often blunders" },
  2: { name: "Novice", blurb: "Spots simple captures, still drops pieces" },
  3: { name: "Casual", blurb: "Three moves deep, the odd slip" },
  4: { name: "Club", blurb: "Solid four-move search, no gifts" },
  5: { name: "Advanced", blurb: "Five moves deep with quiescence" },
  6: { name: "Strong", blurb: "Thinks for 1.5 s, depth 5 and beyond" },
};

interface Weak {
  depth: number;
  /** Chance of a random legal move instead of a considered one. */
  blunder: number;
  /** Score noise, centipawns (± half). */
  noise: number;
}
const WEAK: Partial<Record<Level, Weak>> = {
  1: { depth: 1, blunder: 0.3, noise: 300 },
  2: { depth: 2, blunder: 0.12, noise: 160 },
  3: { depth: 3, blunder: 0.04, noise: 60 },
};
const STRONG: Partial<Record<Level, { depth: number; timeMs: number; minDepth?: number }>> = {
  4: { depth: 4, timeMs: 700 },
  5: { depth: 5, timeMs: 1200, minDepth: 4 },
  6: { depth: 64, timeMs: 1500, minDepth: 5 },
};

let shared: Searcher | null = null;
const searcher = () => (shared ??= new Searcher());

/** The engine's move for `pos` at `level` (0 if the game is over). */
export function chooseMove(pos: Position, level: Level, rng: Rng = createRng(pos.toFen())): number {
  const legal = pos.legalMoves();
  if (!legal.length) return 0;
  if (legal.length === 1) return legal[0];
  const weak = WEAK[level];
  if (weak) {
    if (rng.next() < weak.blunder) return legal[rng.int(legal.length)];
    const scored = searcher().scoreMoves(pos, weak.depth);
    let best = scored[0];
    let bestVal = -Infinity;
    for (const s of scored) {
      // Never "miss" a mate in one with noise, even at level 1.
      const v = s.score > MATE_BOUND ? s.score : s.score + (rng.next() - 0.5) * weak.noise;
      if (v > bestVal) {
        bestVal = v;
        best = s;
      }
    }
    return best.move;
  }
  const opts = STRONG[level]!;
  return searcher().search(pos, { depth: opts.depth, timeMs: opts.timeMs, minDepth: opts.minDepth }).move;
}

/** Best move for hints: a solid, bounded search independent of the opponent's level. */
export function analyse(pos: Position, timeMs = 900): SearchResult {
  return searcher().search(pos, { depth: 64, timeMs, minDepth: 4 });
}
