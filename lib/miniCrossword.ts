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
