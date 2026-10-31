import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import VariantGuide from "@/components/seo/VariantGuide";
import SudokuGame from "@/components/sudoku/SudokuGame";
import { getDailySudoku } from "@/lib/games/dailyPuzzles";
import { generateSudoku, type Difficulty } from "@/lib/games/sudoku";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";
import { VARIANTS, variant, variantPath } from "@/lib/seo/variants";

export const dynamicParams = false;
export function generateStaticParams() {
  return VARIANTS.sudoku.map((v) => ({ variant: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ variant: string }> }): Promise<Metadata> {
  const v = variant("sudoku", (await params).variant);
  return pageMetadata({ title: v.title, description: v.description, path: variantPath(v) });
}

// Today's grid: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function SudokuLevelPage({ params }: { params: Promise<{ variant: string }> }) {
  const v = variant("sudoku", (await params).variant);
  const level = v.slug as Difficulty;
  const today = todayISO();
  const daily = await getDailySudoku(today);
  // On the day the Daily Sudoku is this level, this page plays it (ranked).
  // Otherwise: today's grid at this level from the same seed, generated here
  // (≤ ~250 ms for expert, once per day per page) and played unranked.
  const own =
    daily.difficulty === level ? undefined : (({ difficulty, puzzle, solution }) => ({ difficulty, puzzle, solution }))(generateSudoku(`sudoku:${today}`, level));
  return (
    <>
      <div className="relative">
        <GameRails />
        <SudokuGame date={today} daily={{ difficulty: daily.difficulty, puzzle: daily.puzzle, solution: daily.solution }} level={own} />
      </div>
      <VariantGuide v={v} />
    </>
  );
}
