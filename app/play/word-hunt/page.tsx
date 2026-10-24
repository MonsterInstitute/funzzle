import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import WordHuntGame from "@/components/wordhunt/WordHuntGame";
import { getDailyWordHunt } from "@/lib/games/dailyPuzzles";
import { BANK } from "@/lib/games/wordhunt/bank";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Word Hunt — Free Daily Themed Word Search",
  description:
    "Play today's free Word Hunt: trace the theme words through a 6×8 grid of letters, find the span word that crosses the board, and earn hints with bonus words. A new theme every day, plus practice and the archive.",
  path: "/play/word-hunt",
});

// Today's theme: refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default async function WordHuntPage() {
  const today = todayISO();
  const daily = await getDailyWordHunt(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <WordHuntGame date={today} daily={daily.puzzle} practiceIds={BANK.map((t) => t.id)} />
      </div>
      <GameGuide slug="word-hunt" path="/play/word-hunt" />
    </>
  );
}
