/**
 * Seeded nonogram generation. A puzzle is a pure function of (seed, size):
 * the daily one uses seed "nonogram:YYYY-MM-DD", so the server, the browser
 * and the generation script all agree.
 *
 * The image is either one of Funzzle's hand-drawn pictures (pictures.ts,
 * possibly mirrored) or a seeded pattern: smoothed random blobs, usually
 * mirrored into a symmetric motif. Every candidate must be finished by line
 * logic alone (the exact line solver, no guessing and no contradiction
 * probing), which proves its solution is unique; otherwise it is rejected and
 * the next seed is tried.
 */
import { createRng, type Rng } from "@/lib/games/kit/rng";
import { PICTURES } from "./pictures";
import { cluesOf, lineSolvable, solveLogically, techniqueLevel, type Clues, type Technique } from "./solver";

export type Size = 5 | 10 | 15;
export const SIZES: Size[] = [5, 10, 15];

export interface NonogramPuzzle {
  seed: string;
  size: Size;
  /** Row-major, 1 = filled, 0 = empty. */
  solution: number[];
  clues: Clues;
  /** "a heart" for hand-drawn pictures; null for generated patterns. */
  name: string | null;
  hardest: Technique;
  /** Logical steps the solve takes (a rough effort measure). */
  steps: number;
}

const MAX_ATTEMPTS = 400;
/** Share of daily / practice puzzles drawn from the hand-made pictures. */
const PICTURE_SHARE = 0.4;

type Symmetry = "mirror" | "quad" | "rotate" | "none";

function blobs(rng: Rng, n: number): number[] {
  const density = n === 5 ? 0.55 + rng.next() * 0.15 : 0.48 + rng.next() * 0.14;
  let g = Array.from({ length: n * n }, () => (rng.next() < density ? 1 : 0));
  const passes = n === 5 ? 0 : 1 + rng.int(2);
  for (let p = 0; p < passes; p++) {
    const next = g.slice();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let on = 0;
        let all = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
            all++;
            on += g[rr * n + cc];
          }
        }
        // Majority of the 3×3 neighbourhood; ties keep the cell.
        if (on * 2 > all) next[r * n + c] = 1;
        else if (on * 2 < all) next[r * n + c] = 0;
      }
    }
    g = next;
  }
  return g;
}

function symmetrize(g: number[], n: number, s: Symmetry): number[] {
  const out = g.slice();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let src = r * n + c;
      if (s === "mirror" && c >= Math.ceil(n / 2)) src = r * n + (n - 1 - c);
      if (s === "quad") src = (r < Math.ceil(n / 2) ? r : n - 1 - r) * n + (c < Math.ceil(n / 2) ? c : n - 1 - c);
      if (s === "rotate" && r * n + c > (n * n - 1) / 2) src = (n - 1 - r) * n + (n - 1 - c);
      out[r * n + c] = g[src];
    }
  }
  return out;
}

/** Pleasant enough to paint: not too sparse or dense, and few blank lines. */
function looksGood(g: number[], n: number): boolean {
  const filled = g.reduce((a, b) => a + b, 0) / g.length;
  if (filled < 0.4 || filled > 0.75) return false;
  let blank = 0;
  for (let i = 0; i < n; i++) {
    let row = 0;
    let col = 0;
    for (let j = 0; j < n; j++) {
      row += g[i * n + j];
      col += g[j * n + i];
    }
    if (!row) blank++;
    if (!col) blank++;
  }
  return blank <= Math.floor(n / 5) - 1;
}

function pattern(rng: Rng, n: number): number[] {
  const kinds: Symmetry[] = ["mirror", "mirror", "quad", "rotate", "none"];
  return symmetrize(blobs(rng, n), n, kinds[rng.int(kinds.length)]);
}

function picture(rng: Rng, n: Size): { grid: number[]; name: string } {
  const pics = PICTURES[n];
  const p = pics[rng.int(pics.length)];
  const flip = rng.next() < 0.5;
  const grid: number[] = [];
  for (const row of p.rows) {
    const cells = row.split("").map((ch) => (ch === "#" ? 1 : 0));
    grid.push(...(flip ? cells.reverse() : cells));
  }
  return { grid, name: p.name };
}

/** Deterministic per (seed, size): attempt 0 uses the seed itself, then `${seed}#${n}`. */
export function generateNonogram(seed: string, size: Size): NonogramPuzzle {
  const pick = createRng(`${seed}|${size}|pick`);
  if (pick.next() < PICTURE_SHARE) {
    const { grid, name } = picture(pick, size);
    return toPuzzle(seed, size, grid, name);
  }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(attempt === 0 ? `${seed}|${size}` : `${seed}|${size}#${attempt}`);
    const grid = pattern(rng, size);
    if (!looksGood(grid, size)) continue;
    if (!lineSolvable(cluesOf(grid, size), size)) continue;
    return toPuzzle(seed, size, grid, null);
  }
  // Practically unreachable; a hand-drawn picture is always a valid fallback.
  const { grid, name } = picture(pick, size);
  return toPuzzle(seed, size, grid, name);
}

function toPuzzle(seed: string, size: Size, solution: number[], name: string | null): NonogramPuzzle {
  const clues = cluesOf(solution, size);
  const result = solveLogically(clues, size);
  return { seed, size, solution, clues, name, hardest: result.hardest ?? "simple-boxes", steps: result.steps.length };
}

/** The distinct techniques a puzzle's solve path needs (the skill tree's input). */
export function skillsOf(p: { clues: Clues; size: number }): Technique[] {
  const used = new Set(solveLogically(p.clues, p.size).steps.map((s) => s.technique));
  return [...used].sort((a, b) => techniqueLevel(a) - techniqueLevel(b));
}
