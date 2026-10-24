/**
 * Web Worker for the chess engine, so search never blocks the UI thread.
 * Messages: {id, type: "move" | "hint" | "puzzle", …}; replies {id, result}
 * or {id, error}. See components/chess/engine.ts for the client side.
 */
import { analyse, chooseMove, type Level } from "./ai";
import { explainMove, reviewGame } from "./coach";
import { replay } from "./game";
import { createRng } from "@/lib/games/kit/rng";
import { moveToUci } from "./position";
import { generatePuzzle } from "./puzzle";
import { Searcher } from "./search";

export type EngineRequest =
  | { id: number; type: "move"; fen: string; moves: string[]; level: Level; seed: string }
  | { id: number; type: "hint"; fen: string; moves: string[]; timeMs?: number }
  | { id: number; type: "puzzle"; seed: string }
  | { id: number; type: "review"; fen: string; moves: string[]; color: 0 | 1 };

const explainSearcher = new Searcher();

export function handle(req: EngineRequest): unknown {
  switch (req.type) {
    case "move": {
      const pos = replay(req.fen, req.moves);
      const m = chooseMove(pos, req.level, createRng(`${req.seed}:${req.moves.length}`));
      return m ? moveToUci(m) : null;
    }
    case "hint": {
      const pos = replay(req.fen, req.moves);
      const r = analyse(pos, req.timeMs ?? 900);
      return r.move ? explainMove(pos, r.move, r.score, explainSearcher) : null;
    }
    case "puzzle":
      return generatePuzzle(req.seed);
    case "review":
      return reviewGame(req.fen, req.moves, req.color, explainSearcher);
  }
}

interface WorkerScope {
  onmessage: ((e: MessageEvent<EngineRequest>) => void) | null;
  postMessage(msg: unknown): void;
}

// Only wire up the message loop inside a worker (tests import handle()).
if (typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== "undefined") {
  const scope = self as unknown as WorkerScope;
  scope.onmessage = (e) => {
    const req = e.data;
    try {
      scope.postMessage({ id: req.id, result: handle(req) });
    } catch (err) {
      scope.postMessage({ id: req.id, error: (err as Error).message });
    }
  };
}
