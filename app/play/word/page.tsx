import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import WordGame from "@/components/word/WordGame";
import { getDailyWord } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Funzzle Word — Free Daily 5-Letter Word Game with a Coach",
  description:
    "Guess today's five-letter word in six tries: the same word for everyone, hard mode, color-blind tiles, and a coach that shows what your guesses rule out. Plus Quad, Geo and Math modes and unlimited practice.",
  path: "/play/word",
});

// Today's word: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function WordPage() {
  const today = todayISO();
  const daily = await getDailyWord(today, "classic");
  return (
    <>
      <div className="relative">
        <GameRails />
        <WordGame mode="classic" date={today} daily={daily.puzzle} />
      </div>
      <GameGuide slug="word" path="/play/word" />
    </>
  );
}
