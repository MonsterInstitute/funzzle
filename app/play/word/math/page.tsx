import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import WordGame from "@/components/word/WordGame";
import { getDailyWord } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Word Math — Guess the Daily Equation in Six (Free)",
  description:
    "Find today's hidden 8-character equation in six guesses using digits and + − × ÷ =. Every guess must be true; the tiles show what's in the right spot. Free, with a coach and unlimited practice.",
  path: "/play/word/math",
});

// Today's equation: refreshed on demand at the UTC day change (lib/revalidation.ts).
export const revalidate = 21600;

export default async function WordMathPage() {
  const today = todayISO();
  const daily = await getDailyWord(today, "math");
  return (
    <>
      <div className="relative">
        <GameRails />
        <WordGame mode="math" date={today} daily={daily.puzzle} />
      </div>
      <GameGuide slug="word-math" path="/play/word/math" />
    </>
  );
}
