/**
 * Generate Strands grids: place an 8-letter spangram + 6 theme words on
 * straight lines in an 8-row × 6-col grid, then fill the rest with letters.
 * Deterministic (seeded per puzzle index). Emits lib/content/strands.ts.
 *
 * Run:  node scripts/gen-strands.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "lib", "content", "strands.ts");

const ROWS = 8;
const COLS = 6;

const PUZZLES = [
  { theme: "Breakfast", spangram: "PANCAKES", words: ["TOAST", "BACON", "EGGS", "OATS", "JUICE", "CEREAL"] },
  { theme: "Ocean Life", spangram: "DOLPHINS", words: ["WHALE", "SHARK", "CORAL", "CRAB", "SEAL", "OTTER"] },
  { theme: "Weather", spangram: "SUNSHINE", words: ["STORM", "CLOUD", "SLEET", "FROST", "WIND", "RAIN"] },
  { theme: "Musical Instruments", spangram: "KEYBOARD", words: ["PIANO", "DRUMS", "FLUTE", "VIOLIN", "HARP", "BANJO"] },
  { theme: "Sports", spangram: "BASEBALL", words: ["SOCCER", "TENNIS", "GOLF", "RUGBY", "HOCKEY", "BOXING"] },
  { theme: "Outer Space", spangram: "ASTEROID", words: ["COMET", "PLANET", "MOON", "STAR", "ORBIT", "GALAXY"] },
  { theme: "In the Kitchen", spangram: "COOKWARE", words: ["WHISK", "LADLE", "TONGS", "KNIFE", "SPOON", "GRATER"] },
];

const DIRS = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tryPlace(grid, word, rnd) {
  const cellsAll = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cellsAll.push([r, c]);
  for (const [sr, sc] of shuffled(cellsAll, rnd)) {
    for (const [dr, dc] of shuffled(DIRS, rnd)) {
      const cells = [];
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const r = sr + dr * i;
        const c = sc + dc * i;
        if (r < 0 || c < 0 || r >= ROWS || c >= COLS) { ok = false; break; }
        const existing = grid[r][c];
        if (existing !== null && existing !== word[i]) { ok = false; break; }
        cells.push([r, c]);
      }
      if (ok) return cells;
    }
  }
  return null;
}

function build(puzzle, index) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rnd = mulberry32(1000 + index * 97 + attempt * 7);
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const placements = [];
    const all = [
      { word: puzzle.spangram, isSpangram: true },
      ...puzzle.words.map((w) => ({ word: w, isSpangram: false })),
    ];
    let ok = true;
    for (const { word, isSpangram } of all) {
      const cells = tryPlace(grid, word, rnd);
      if (!cells) { ok = false; break; }
      cells.forEach(([r, c], i) => (grid[r][c] = word[i]));
      placements.push({ word, isSpangram, cells });
    }
    if (!ok) continue;
    // Fill blanks with common letters.
    const FILL = "ETAOINSRHLDCUMFPGWYB";
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] === null) grid[r][c] = FILL[Math.floor(rnd() * FILL.length)];
    return {
      theme: puzzle.theme,
      spangram: puzzle.spangram,
      words: puzzle.words,
      grid: grid.map((row) => row.join("")),
      placements,
    };
  }
  throw new Error(`Failed to place puzzle ${index} (${puzzle.theme})`);
}

const built = PUZZLES.map(build);

const body = `// Auto-generated Strands puzzles (8 rows x 6 cols).
export interface StrandsPuzzle {
  theme: string;
  spangram: string;
  words: string[];
  grid: string[]; // 8 rows of 6 chars
  placements: { word: string; isSpangram: boolean; cells: number[][] }[];
}

export const STRANDS_PUZZLES: StrandsPuzzle[] = ${JSON.stringify(built, null, 1)};
`;

writeFileSync(OUT, body);
console.error(`Wrote ${built.length} strands puzzles.`);
for (const p of built) console.error(`${p.theme}: spangram ${p.spangram}, ${p.words.length} words`);
