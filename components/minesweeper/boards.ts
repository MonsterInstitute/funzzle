/**
 * Which board a game uses. Every board opens at its center cell (like the
 * daily), so a practice seed alone reproduces the board for a challenge.
 * Expert is 30 wide; on a portrait phone it is stood upright (16 × 30), the
 * same puzzle turned, so a challenge works across devices.
 */
import { centerCell, generateBoard, transposeBoard, type Board, type Difficulty } from "@/lib/games/minesweeper";
import type { MinesweeperLevel } from "@/lib/games/dailySchedule";

export const LEVELS: MinesweeperLevel[] = ["beginner", "intermediate", "expert"];

export const isLevel = (v: unknown): v is MinesweeperLevel => typeof v === "string" && (LEVELS as string[]).includes(v);

export const levelOf = (d: Difficulty): MinesweeperLevel => (d === "expert-mobile" ? "expert" : d);

export function practiceBoard(seed: string, level: MinesweeperLevel, portrait: boolean): Board {
  const board = generateBoard(seed, level, centerCell(level));
  return level === "expert" && portrait ? transposeBoard(board, "expert-mobile") : board;
}

/** A narrow screen, where Expert should stand upright. */
export function isPortraitScreen(): boolean {
  try {
    return window.innerWidth < 640 && window.innerHeight >= window.innerWidth;
  } catch {
    return false;
  }
}
