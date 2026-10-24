/**
 * Test helper: build a position from a picture, one string per row.
 *   *  hidden mine      F  flagged mine
 *   #  hidden safe      x  flag on a safe cell (a mistake)
 *   .  opened safe cell (its number comes from the mines)
 */

import type { GameState } from "./board";

export function position(rows: string[]): GameState {
  const width = rows[0].length;
  const cells = rows.join("").split("");
  const mines = cells.map((ch) => ch === "*" || ch === "F");
  return {
    width,
    height: rows.length,
    mineCount: mines.filter(Boolean).length,
    mines,
    revealed: cells.map((ch) => ch === "."),
    flagged: cells.map((ch) => ch === "F" || ch === "x"),
    exploded: null,
    status: "playing",
    moves: 0,
    beforeExplosion: null,
  };
}

export const at = (state: { width: number }, r: number, c: number) => r * state.width + c;
