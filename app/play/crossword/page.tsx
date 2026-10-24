import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import CrosswordGame from "@/components/crossword/CrosswordGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyCrossword } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Crossword — Free Puzzle, 11×11 to 15×15",
  description:
    "Play today's free Daily Crossword: an American-style grid that grows from 11×11 on Monday to 15×15 on the weekend, with check, reveal, pencil mode and a coach that points you to the easiest clue.",
  path: "/play/crossword",
});

// Today's grid: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function CrosswordPage() {
  const today = todayISO();
  const daily = await getDailyCrossword(today);
  return (
    <>
      <div className="relative">
        {/* The crossword column widens to 1000 px on desktop (grid + clue lists). */}
        <GameRails board={1000} />
        <CrosswordGame date={today} daily={{ title: daily.title, size: daily.size, grid: daily.grid, clues: daily.clues }} />
      </div>
      <GameGuide slug="crossword" path="/play/crossword" />
    </>
  );
}
