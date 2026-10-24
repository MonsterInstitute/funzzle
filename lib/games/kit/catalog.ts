/**
 * The 20 Funzzle games (design/Main.dc.html). Names are Funzzle's own, never
 * NYT game names. `href` is null until the game ships; games that exist today
 * keep their current URLs until the Phase 4 renames (/play/wordle → /play/word …).
 */

export type GameCategory = "Cards" | "Logic" | "Words" | "Casual" | "Strategy";

export interface GameInfo {
  slug: string;
  name: string;
  category: GameCategory;
  description: string;
  /** Signature color; text on it is always ink #111111. */
  color: string;
  /** Light tint of the signature color for game page headers. */
  tint: string;
  /** 48×48 stroke glyph path. */
  glyph: string;
  href: string | null;
}

const G = {
  sudoku: "M8 8h32v32H8zM8 18.7h32M8 29.3h32M18.7 8v32M29.3 8v32",
  solitaire: "M14 7h20a3 3 0 0 1 3 3v28a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3zM24 17l6 7-6 7-6-7z",
  spider: "M18 6h18a3 3 0 0 1 3 3v24M11 12h18a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3zM20 22v10M15 27h10",
  freecell: "M6 8h8v11H6zM20 8h8v11h-8zM34 8h8v11h-8zM10 25h28v16H10z",
  mines: "M24 15a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4",
  mahjong: "M13 11h19a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V14a3 3 0 0 1 3-3zM16 7h19a3 3 0 0 1 3 3v24M16 20h13M16 26h13M16 32h13",
  t2048: "M8 8h14v14H8zM26 8h14v14H26zM8 26h14v14H8zM26 26h14v14H26z",
  block: "M8 28h10v10H8zM18 28h10v10H18zM18 18h10v10H18zM28 28h10v10H28zM28 8h10v10H28z",
  search: "M21 9a12 12 0 1 0 0 24a12 12 0 1 0 0-24zM30 30l10 10M15 21h12",
  cross: "M8 8h32v32H8zM8 16h32M8 24h32M8 32h32M16 8v32M24 8v32M32 8v32",
  mini: "M12 12h24v24H12zM12 20h24M12 28h24M20 12v24M28 12v24",
  word: "M5 18h8v12H5zM15 18h8v12h-8zM25 18h8v12h-8zM35 18h8v12h-8z",
  groups: "M9 9h13v13H9zM26 9h13v13H26zM9 26h13v13H9zM26 26h13v13H26z",
  hive: "M24 6l15 9v18l-15 9-15-9V15zM24 18l6 3.5v7L24 32l-6-3.5v-7z",
  hunt: "M10 10a3 3 0 1 0 0 .1M10 10h12v12h12v12M34 34a3 3 0 1 0 0 .1",
  box: "M10 10h28v28H10zM18 10V6M30 10V6M38 18h4M38 30h4M18 38v4M10 24H6M18 10l20 20",
  nonogram: "M16 16h24v24H16zM16 24h24M16 32h24M24 16v24M32 16v24M7 20h5M7 28h5M7 36h5M20 7v5M28 7v5M36 7v5",
  kakuro: "M8 8h32v32H8zM8 8l16 16M24 8v32M8 24h32",
  jigsaw: "M10 15h9a4 4 0 1 1 8 0h9v9a4 4 0 1 1 0 8v9h-9a4 4 0 1 0-8 0h-9z",
  chess: "M16 41h18M18 37h14M20 37l1-12-6-3 4-9 7-4 7 7v21",
};

type Row = [slug: string, name: string, category: GameCategory, description: string, color: string, tint: string, glyph: keyof typeof G, href: string | null];

const ROWS: Row[] = [
  ["solitaire", "Solitaire", "Cards", "Klondike, draw 1 or 3. Every daily deal is winnable.", "#7FD6A0", "#E9F7EE", "solitaire", "/play/solitaire"],
  ["sudoku", "Sudoku", "Logic", "Easy to expert, with a coach that explains every step.", "#9DB4FF", "#EAF0FF", "sudoku", "/play/sudoku"],
  ["mahjong", "Mahjong", "Casual", "Match free tiles across hundreds of layouts.", "#F6A6A1", "#FDEDEC", "mahjong", null],
  ["minesweeper", "Minesweeper", "Logic", "No-guess boards: always solvable by logic.", "#8FE3CF", "#E8F9F4", "mines", null],
  ["spider-solitaire", "Spider Solitaire", "Cards", "One, two or four suits. Unlimited undo.", "#A7E07A", "#EFF9E6", "spider", null],
  ["freecell", "FreeCell", "Cards", "Pure skill. Every deal is solvable.", "#6FD0E8", "#E5F6FB", "freecell", null],
  ["word-search", "Word Search", "Words", "A themed grid every day, or make your own.", "#FFE066", "#FFF8DB", "search", null],
  ["crossword", "Crossword", "Words", "A fresh full-size crossword every day.", "#D9DCE6", "#F3F4F8", "cross", null],
  ["mini-crossword", "Mini Crossword", "Words", "Five by five. About a minute.", "#FFD6A5", "#FFF4E6", "mini", "/play/mini"],
  ["word", "Funzzle Word", "Words", "Guess the word in six. Quad, Geo and Math modes.", "#B5E48C", "#F0F9E6", "word", "/play/wordle"],
  ["groups", "Groups", "Words", "Find four groups of four.", "#C9B8E8", "#F3EFFA", "groups", "/play/connections"],
  ["spelling-hive", "Spelling Hive", "Words", "Seven letters. How many words can you make?", "#FFD23F", "#FFF6D6", "hive", "/play/spelling-hive"],
  ["word-hunt", "Word Hunt", "Words", "A themed hunt with one word that spans the board.", "#9EE6E0", "#E9F8F7", "hunt", "/play/strands"],
  ["letter-box", "Letter Box", "Words", "Chain words around the square to use every letter.", "#FF9E9E", "#FFECEC", "box", "/play/letter-box"],
  ["2048", "2048", "Logic", "Slide, merge, and chase the big tile.", "#FFC857", "#FFF4DD", "t2048", null],
  ["block-puzzle", "Block Puzzle", "Logic", "Fit the pieces, clear the lines.", "#FFA978", "#FFEFE6", "block", null],
  ["nonogram", "Nonogram", "Logic", "Paint by numbers to reveal the picture.", "#D8B4FE", "#F6EEFF", "nonogram", null],
  ["kakuro", "Kakuro", "Logic", "A crossword made of sums.", "#FFB8DA", "#FFEEF6", "kakuro", null],
  ["jigsaw", "Jigsaw", "Casual", "A daily photo, from 24 to 500 pieces.", "#A9CBFF", "#ECF3FF", "jigsaw", null],
  ["chess", "Chess", "Strategy", "Beginner to master, plus a daily puzzle.", "#DCCDB2", "#F7F3EC", "chess", null],
];

export const GAMES: GameInfo[] = ROWS.map(([slug, name, category, description, color, tint, glyph, href]) => ({
  slug,
  name,
  category,
  description,
  color,
  tint,
  glyph: G[glyph],
  href,
}));

export const GAME_BY_SLUG: Record<string, GameInfo> = Object.fromEntries(GAMES.map((g) => [g.slug, g]));

export const CATEGORIES: GameCategory[] = ["Cards", "Logic", "Words", "Casual", "Strategy"];
