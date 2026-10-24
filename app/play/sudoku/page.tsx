import type { Metadata } from "next";
import GameGuide from "@/components/seo/GameGuide";
import SudokuGame from "@/components/sudoku/SudokuGame";
import { getDailySudoku } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Sudoku with a Coach — Free, Easy to Expert",
  description:
    "Play today's free Daily Sudoku: the same grid for everyone, a coach that explains the next logical step, and your rank against today's players. Unlimited practice from easy to expert.",
  path: "/play/sudoku",
});

// Today's grid: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function SudokuPage() {
  const today = todayISO();
  const daily = await getDailySudoku(today);
  return (
    <>
      <SudokuGame date={today} daily={{ difficulty: daily.difficulty, puzzle: daily.puzzle, solution: daily.solution }} />
      <GameGuide slug="sudoku" path="/play/sudoku" />
    </>
  );
}
