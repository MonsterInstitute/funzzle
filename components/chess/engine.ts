"use client";

/**
 * Client for the chess engine Web Worker (lib/games/chess/worker.ts): search
 * runs off the main thread so the board never freezes. Where workers aren't
 * available it falls back to running the same handler inline.
 */
import type { EngineRequest } from "@/lib/games/chess/worker";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type Request = EngineRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("../../lib/games/chess/worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
  worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve(e.data.result);
  };
  worker.onerror = () => {
    for (const p of pending.values()) p.reject(new Error("chess engine crashed"));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function ask<T>(req: Request): Promise<T> {
  const w = getWorker();
  const id = ++seq;
  if (!w) return import("@/lib/games/chess/worker").then((m) => m.handle({ ...req, id } as EngineRequest) as T);
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ ...req, id });
  });
}

/** Abandon whatever the engine is thinking about (undo, new game). */
export function cancelEngine(): void {
  if (!worker) return;
  worker.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(new Error("cancelled"));
  pending.clear();
}
