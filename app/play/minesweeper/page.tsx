import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import MinesweeperGame from "@/components/minesweeper/MinesweeperGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyMinesweeper } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Minesweeper, No Guessing — Free with a Coach",
  description:
    "Play today's free Daily Minesweeper: one no-guess 16×16 board for everyone, solvable by logic alone, a coach that explains the next safe cell, and your rank against today's players. Unlimited Beginner to Expert practice.",
  path: "/play/minesweeper",
});

// Today's board: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function MinesweeperPage() {
  const today = todayISO();
  const { date: _date, ...board } = await getDailyMinesweeper(today);
  void _date;
  return (
    <>
      <div className="relative">
        <GameRails />
        <MinesweeperGame date={today} daily={board} />
      </div>
      <GameGuide slug="minesweeper" path="/play/minesweeper" />
    </>
  );
}
