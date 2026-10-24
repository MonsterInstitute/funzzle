import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import WordSearchGame from "@/components/wordsearch/WordSearchGame";
import { getDailyWordSearch } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Word Search — Free Themed Puzzle with Hints",
  description:
    "Play today's free Daily Word Search: a themed 12×12 grid with words hidden in all 8 directions, the same for everyone, a coach that shows where to look, and unlimited practice grids.",
  path: "/play/word-search",
});

// Today's grid: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function WordSearchPage() {
  const today = todayISO();
  const daily = await getDailyWordSearch(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <WordSearchGame date={today} daily={{ title: daily.title, size: daily.size, grid: daily.grid, words: daily.words }} />
      </div>
      <GameGuide slug="word-search" path="/play/word-search" />
    </>
  );
}
