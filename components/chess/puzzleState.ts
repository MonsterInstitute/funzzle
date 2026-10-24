/**
 * Puzzle play rules for the chess screen: which moves count as correct, the
 * three-rung coach ladder for the next move, and short labels. Pure, so it
 * is unit-tested (tests/unit/chess-puzzle.test.ts).
 */
import { PIECE_NAME, replay, squareLabel, THEME_INFO, type ChessPuzzle, type Theme } from "@/lib/games/chess";

const sq = (name: string) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
const fromOf = (uci: string) => sq(uci.slice(0, 2));
const toOf = (uci: string) => sq(uci.slice(2, 4));

export const solverMoves = (p: ChessPuzzle) => Math.ceil(p.solution.length / 2);
export const solverColor = (p: ChessPuzzle): "w" | "b" => (p.fen.split(" ")[1] === "b" ? "b" : "w");

/**
 * Is `uci` right at ply `step`? The solution move always is; on the last
 * move of a mate puzzle any other mate counts too.
 */
export function isCorrect(p: ChessPuzzle, step: number, uci: string): boolean {
  if (p.solution[step] === uci) return true;
  if (p.kind !== "mate" || step !== p.solution.length - 1) return false;
  try {
    const pos = replay(p.fen, [...p.solution.slice(0, step), uci]);
    return pos.inCheck() && !pos.hasLegalMove();
  } catch {
    return false;
  }
}

/** "Mate in 2" / "Win material". */
export function goalLabel(p: ChessPuzzle): string {
  return p.kind === "mate" ? `Mate in ${p.mate}` : "Win material";
}

/** The theme the coach talks about: the tactic, else the mate, else material. */
export function mainTheme(p: ChessPuzzle): Theme {
  const tactic = p.themes.find((t) => !t.startsWith("mate-in") && t !== "win-material");
  return tactic ?? p.themes.find((t) => t.startsWith("mate-in")) ?? "win-material";
}

export interface PuzzleHint {
  text: string;
  /** Squares to light up: the piece (rung 1–2), and its target (rung 3). */
  squares: { from: number; to?: number };
}

/** Coach ladder for the solver's move at `step`: 1 = which piece, 2 = the idea, 3 = the move. */
export function puzzleHint(p: ChessPuzzle, step: number, rung: 1 | 2 | 3): PuzzleHint {
  const uci = p.solution[step];
  const san = p.san[step];
  const pos = replay(p.fen, p.solution.slice(0, step));
  const from = fromOf(uci);
  const piece = PIECE_NAME[pos.board[(from >> 3) * 16 + (from & 7)] & 7];
  const where = squareLabel(from);
  if (rung === 1) return { text: `Look at your ${piece} on ${where}.`, squares: { from } };
  if (rung === 2) {
    const left = solverMoves(p) - step / 2;
    const kind = san.includes("#") ? "It’s checkmate." : san.includes("+") ? "It’s a check." : san.includes("x") ? "It’s a capture." : "It’s a quiet move, not a check or capture.";
    const idea =
      p.kind === "mate"
        ? left > 1
          ? `There’s a forced mate in ${left}. Every move has to be forcing.`
          : "One move ends the game."
        : THEME_INFO[mainTheme(p)].tip;
    return { text: `${idea} ${kind} The ${piece} on ${where} makes it.`, squares: { from } };
  }
  return { text: `Play ${san}: your ${piece} from ${where} to ${squareLabel(toOf(uci))}.`, squares: { from, to: toOf(uci) } };
}

/** Squares (0–63) of a UCI move. */
export function moveSquares(uci: string): { from: number; to: number } {
  return { from: fromOf(uci), to: toOf(uci) };
}
