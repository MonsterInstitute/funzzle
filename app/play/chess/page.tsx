import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import ChessGame from "@/components/chess/ChessGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyChess } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Free Chess vs Computer + Daily Chess Puzzle",
  description:
    "Play free chess against the computer at six levels, from Beginner to Strong, and solve today's Daily Chess Puzzle: one position for everyone with a single winning tactic. A coach explains the best move.",
  path: "/play/chess",
});

// Today's puzzle: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function ChessPage() {
  const today = todayISO();
  const daily = await getDailyChess(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <ChessGame date={today} daily={daily} />
      </div>
      <GameGuide slug="chess" path="/play/chess" />
    </>
  );
}
