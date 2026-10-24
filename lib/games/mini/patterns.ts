/**
 * Black-square patterns: every 180°-symmetric layout that passes
 * shapeProblems (all entries >= 3 letters, every cell checked both ways,
 * connected), enumerated once. 5×5 uses 0–4 black squares; the Saturday 7×7
 * uses 4–8.
 */
import { BLACK, shapeProblems } from "./grid";

function enumerate(size: number, minBlack: number, maxBlack: number): string[][] {
  const n = size * size;
  const center = n % 2 === 1 ? (n - 1) / 2 : -1;
  // Symmetric pairs (i, n-1-i) with i below the center.
  const pairs: number[] = [];
  for (let i = 0; i < Math.floor(n / 2); i++) pairs.push(i);
  const out: string[][] = [];
  const seen = new Set<string>();
  const maxPairs = Math.floor(maxBlack / 2);

  const emit = (chosen: number[], withCenter: boolean) => {
    const cells = new Array<string>(n).fill(".");
    for (const i of chosen) {
      cells[i] = BLACK;
      cells[n - 1 - i] = BLACK;
    }
    if (withCenter) cells[center] = BLACK;
    const count = chosen.length * 2 + (withCenter ? 1 : 0);
    if (count < minBlack || count > maxBlack) return;
    const rows = Array.from({ length: size }, (_, r) => cells.slice(r * size, r * size + size).join(""));
    const key = rows.join("/");
    if (seen.has(key) || shapeProblems(rows).length) return;
    seen.add(key);
    out.push(rows);
  };

  const rec = (from: number, chosen: number[]) => {
    emit(chosen, false);
    if (center >= 0) emit(chosen, true);
    if (chosen.length === maxPairs) return;
    for (let k = from; k < pairs.length; k++) rec(k + 1, [...chosen, pairs[k]]);
  };
  rec(0, []);
  return out;
}

let cache5: string[][] | null = null;
let cache7: string[][] | null = null;

/** 5×5 patterns with 0–4 black squares. */
export function patterns5(): string[][] {
  return (cache5 ??= enumerate(5, 0, 4));
}

/** 7×7 patterns with 6–8 black squares and no entry longer than 6 letters... or 7. */
export function patterns7(): string[][] {
  return (cache7 ??= enumerate(7, 6, 8));
}

export const blackCount = (rows: string[]) => rows.join("").split(BLACK).length - 1;
