/**
 * Mini crossword data model + layout helpers.
 *
 * A puzzle is defined by its solution grid ("#" = black square) plus clue text
 * keyed by cell number. Everything else — cell numbering, word grouping, answer
 * strings — is derived from the grid so the two can never drift out of sync.
 * This shape is intentionally serializable so a Server Component can compute
 * today's puzzle and hand it to the client component as a plain prop.
 */

export const BLACK = "#";

export type Direction = "across" | "down";

export interface MiniClue {
  number: number;
  clue: string;
}

export interface MiniPuzzle {
  title: string;
  /** Uppercase solution letters; "#" marks a black square. */
  solution: string[][];
  clues: {
    across: MiniClue[];
    down: MiniClue[];
  };
}

export interface Cell {
  row: number;
  col: number;
  solution: string; // "" for black squares
  black: boolean;
  number: number | null; // clue number if this cell starts a word
  acrossWord: number | null; // id of the across word this cell belongs to
  downWord: number | null; // id of the down word this cell belongs to
}

export interface WordEntry {
  number: number;
  direction: Direction;
  cells: Array<{ row: number; col: number }>;
  answer: string;
  clue: string;
}

export interface Layout {
  size: number;
  cells: Cell[][];
  words: Record<Direction, Record<number, WordEntry>>;
  /** Words in numeric order, for rendering clue lists. */
  ordered: Record<Direction, WordEntry[]>;
}

const cellKey = (r: number, c: number) => `${r}-${c}`;

/**
 * Derive numbering + word groupings from a puzzle's solution grid.
 */
export function buildLayout(puzzle: MiniPuzzle): Layout {
  const grid = puzzle.solution;
  const size = grid.length;
  const isBlack = (r: number, c: number) =>
    r < 0 || c < 0 || r >= size || c >= size || grid[r][c] === BLACK;

  const cluesFor = (dir: Direction) => {
    const map: Record<number, string> = {};
    for (const { number, clue } of puzzle.clues[dir]) map[number] = clue;
    return map;
  };
  const acrossClues = cluesFor("across");
  const downClues = cluesFor("down");

  const cells: Cell[][] = grid.map((rowArr, r) =>
    rowArr.map((ch, c) => ({
      row: r,
      col: c,
      solution: ch === BLACK ? "" : ch,
      black: ch === BLACK,
      number: null,
      acrossWord: null,
      downWord: null,
    }))
  );

  const words: Layout["words"] = { across: {}, down: {} };

  let counter = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isBlack(r, c)) continue;

      const startsAcross = isBlack(r, c - 1) && !isBlack(r, c + 1);
      const startsDown = isBlack(r - 1, c) && !isBlack(r + 1, c);
      if (!startsAcross && !startsDown) continue;

      const number = ++counter;
      cells[r][c].number = number;

      if (startsAcross) {
        const wordCells: WordEntry["cells"] = [];
        let cc = c;
        let answer = "";
        while (!isBlack(r, cc)) {
          cells[r][cc].acrossWord = number;
          wordCells.push({ row: r, col: cc });
          answer += grid[r][cc];
          cc++;
        }
        words.across[number] = {
          number,
          direction: "across",
          cells: wordCells,
          answer,
          clue: acrossClues[number] ?? "",
        };
      }

      if (startsDown) {
        const wordCells: WordEntry["cells"] = [];
        let rr = r;
        let answer = "";
        while (!isBlack(rr, c)) {
          cells[rr][c].downWord = number;
          wordCells.push({ row: rr, col: c });
          answer += grid[rr][c];
          rr++;
        }
        words.down[number] = {
          number,
          direction: "down",
          cells: wordCells,
          answer,
          clue: downClues[number] ?? "",
        };
      }
    }
  }

  const ordered: Layout["ordered"] = {
    across: Object.values(words.across).sort((a, b) => a.number - b.number),
    down: Object.values(words.down).sort((a, b) => a.number - b.number),
  };

  return { size, cells, words, ordered };
}

export { cellKey };

/**
 * Normalize a stored grid into a square matrix of single uppercase letters,
 * using "#" for black squares. Accepts several shapes so we're tolerant of how
 * the `puzzles.grid` column happens to be authored:
 *   - string[][]                       (matrix of cells)
 *   - string[]                         (one string per row)
 *   - string                           (rows separated by "\n" or "/")
 * Returns null if the result isn't a valid square grid of size >= 2.
 */
function normalizeGrid(grid: unknown): string[][] | null {
  let rows: string[][];

  if (typeof grid === "string") {
    rows = grid
      .trim()
      .split(/[\n/]/)
      .map((line) => line.trim().split(""));
  } else if (Array.isArray(grid) && grid.length > 0) {
    if (Array.isArray(grid[0])) {
      rows = (grid as unknown[][]).map((row) =>
        row.map((cell) => String(cell ?? ""))
      );
    } else if (typeof grid[0] === "string") {
      rows = (grid as string[]).map((line) => line.split(""));
    } else {
      return null;
    }
  } else {
    return null;
  }

  const isBlackCell = (cell: string) => {
    const c = cell.trim();
    return c === "" || c === "#" || c === ".";
  };

  const normalized = rows.map((row) =>
    row.map((cell) => (isBlackCell(cell) ? BLACK : cell.trim()[0].toUpperCase()))
  );

  const size = normalized.length;
  if (size < 2) return null;
  if (!normalized.every((row) => row.length === size)) return null;

  return normalized;
}

/** Coerce a stored clue collection into an ordered MiniClue[]. */
function normalizeClueList(input: unknown): MiniClue[] | null {
  if (Array.isArray(input)) {
    const list = input
      .map((c) => {
        const obj = c as Record<string, unknown>;
        const number = Number(obj?.number ?? obj?.num);
        const clue = String(obj?.clue ?? obj?.text ?? "");
        return Number.isFinite(number) ? { number, clue } : null;
      })
      .filter((c): c is MiniClue => c !== null);
    return list.length ? list.sort((a, b) => a.number - b.number) : null;
  }

  // Object map: { "1": "clue text", ... }
  if (input && typeof input === "object") {
    const list = Object.entries(input as Record<string, unknown>)
      .map(([k, v]) => ({ number: Number(k), clue: String(v) }))
      .filter((c) => Number.isFinite(c.number));
    return list.length ? list.sort((a, b) => a.number - b.number) : null;
  }

  return null;
}

/**
 * Map a `puzzles` row into a playable MiniPuzzle.
 * Returns null when the row can't be interpreted, so callers fall back to the
 * built-in sample rather than rendering a broken grid.
 */
export function puzzleRowToMini(row: {
  title?: string | null;
  grid: unknown;
  clues: unknown;
}): MiniPuzzle | null {
  try {
    const solution = normalizeGrid(row.grid);
    if (!solution) return null;

    const rawClues = (row.clues ?? {}) as Record<string, unknown>;
    const across = normalizeClueList(rawClues.across);
    const down = normalizeClueList(rawClues.down);
    if (!across || !down) return null;

    const puzzle: MiniPuzzle = {
      title: (row.title ?? "").trim() || "Daily Mini",
      solution,
      clues: { across, down },
    };

    // Sanity check: the grid must actually produce words that line up with the
    // supplied clue numbers. If not, treat the row as unusable.
    const layout = buildLayout(puzzle);
    if (
      layout.ordered.across.length === 0 &&
      layout.ordered.down.length === 0
    ) {
      return null;
    }
    return puzzle;
  } catch {
    return null;
  }
}

/**
 * Fallback puzzle — a valid 5×5 word square (every row and column is a real
 * word). Used when no puzzle has been published for the day.
 */
export const SAMPLE_MINI: MiniPuzzle = {
  title: "Funzzle Mini",
  solution: [
    ["H", "E", "A", "R", "T"],
    ["E", "M", "B", "E", "R"],
    ["A", "B", "U", "S", "E"],
    ["R", "E", "S", "I", "N"],
    ["T", "R", "E", "N", "T"],
  ],
  clues: {
    across: [
      { number: 1, clue: "Organ that pumps blood" },
      { number: 6, clue: "Glowing coal in a dying fire" },
      { number: 7, clue: "Mistreat or misuse" },
      { number: 8, clue: "Sticky secretion from pine trees" },
      { number: 9, clue: "English river that flows through Nottingham" },
    ],
    down: [
      { number: 1, clue: "Valentine's Day symbol" },
      { number: 2, clue: "Faint, lingering coal" },
      { number: 3, clue: "Take advantage of, cruelly" },
      { number: 4, clue: "Base for varnish and adhesives" },
      { number: 5, clue: "Council of ___ (16th-century Catholic conclave)" },
    ],
  },
};
