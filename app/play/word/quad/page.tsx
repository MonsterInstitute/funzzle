import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import WordGame from "@/components/word/WordGame";
import { getDailyWord } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Word Quad — Four Words at Once, Nine Guesses (Free Daily)",
  description:
    "Solve four five-letter words at once in nine guesses: every guess plays on all four boards. A free daily puzzle with a coach that finds the guess that splits the boards best, plus unlimited practice.",
  path: "/play/word/quad",
});

// Today's four words: refreshed on demand at the UTC day change (lib/revalidation.ts).
export const revalidate = 21600;

export default async function WordQuadPage() {
  const today = todayISO();
  const daily = await getDailyWord(today, "quad");
  return (
    <>
      <div className="relative">
        <GameRails />
        <WordGame mode="quad" date={today} daily={daily.puzzle} />
      </div>
      <GameGuide slug="word-quad" path="/play/word/quad" />
    </>
  );
}
