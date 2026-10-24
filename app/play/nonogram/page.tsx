import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import NonogramGame from "@/components/nonogram/NonogramGame";
import { getDailyNonogram } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Nonogram with a Coach — Free Picture Logic Puzzle",
  description:
    "Play today's free Daily Nonogram: one 10×10 picture puzzle for everyone, solvable line by line with no guessing, a coach that names the next technique, and your rank against today's players. Unlimited 5×5 to 15×15 practice.",
  path: "/play/nonogram",
});

// Today's puzzle: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function NonogramPage() {
  const today = todayISO();
  const daily = await getDailyNonogram(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <NonogramGame date={today} daily={{ solution: daily.solution, clues: daily.clues, name: daily.name }} />
      </div>
      <GameGuide slug="nonogram" path="/play/nonogram" />
    </>
  );
}
