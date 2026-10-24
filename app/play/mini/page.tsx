import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import MiniGame from "@/components/mini/MiniGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyMini } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Mini Crossword — Free Daily 5×5 Crossword",
  description:
    "Play today's free Mini Crossword: a quick 5×5 grid that's the same for everyone, with check, reveal and a hint coach, your rank against today's players, and unlimited practice minis.",
  path: "/play/mini",
});

// Today's grid: refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default async function MiniPage() {
  const today = todayISO();
  const daily = await getDailyMini(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <MiniGame date={today} daily={{ size: daily.size, rows: daily.rows, clues: daily.clues, bankId: daily.bankId }} />
      </div>
      <GameGuide slug="mini-crossword" path="/play/mini" />
    </>
  );
}
