import { CELLS, diagonalOf, isPath, spell, touchesOppositeSides } from "./grid";
import type { PlacedWord } from "./types";

/** Every problem with a laid-out grid: coverage, paths, spelling, crossings, the span word. */
export function tilingProblems(grid: string, words: PlacedWord[]): string[] {
  const out: string[] = [];
  const owner = new Array<number>(CELLS).fill(-1);
  const diag = new Map<number, number>();
  words.forEach((w, i) => {
    if (!isPath(w.path)) out.push(`${w.word}: not a path`);
    if (spell(grid, w.path) !== w.word) out.push(`${w.word}: spelled ${spell(grid, w.path)}`);
    for (const c of w.path) {
      if (owner[c] >= 0) out.push(`${w.word}: cell ${c} already used by ${words[owner[c]].word}`);
      owner[c] = i;
    }
    for (let k = 1; k < w.path.length; k++) {
      const d = diagonalOf(w.path[k - 1], w.path[k]);
      if (!d) continue;
      const other = diag.get(d[0]);
      if (other !== undefined && other !== d[1]) out.push(`${w.word}: crosses another word in block ${d[0]}`);
      diag.set(d[0], d[1]);
    }
  });
  if (owner.some((o) => o < 0)) out.push("not every cell is covered");
  const spans = words.filter((w) => w.span);
  if (spans.length !== 1) out.push(`${spans.length} span words`);
  else if (!touchesOppositeSides(spans[0].path)) out.push("the span word doesn't touch two opposite sides");
  return out;
}
