import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import HiveGame from "@/components/hive/HiveGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyHive } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Spelling Hive — Free Daily Seven-Letter Word Puzzle",
  description:
    "Play today's free Spelling Hive: make words from seven letters around a center letter, find the pangram, climb from Beginner to Genius and Hive Master, and see how your score ranks against today's players.",
  path: "/play/spelling-hive",
});

// Today's hive: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function SpellingHivePage() {
  const today = todayISO();
  const { date: _date, ...daily } = await getDailyHive(today);
  void _date;
  return (
    <>
      <div className="relative">
        <GameRails />
        <HiveGame date={today} daily={daily} />
      </div>
      <GameGuide slug="spelling-hive" path="/play/spelling-hive" />
    </>
  );
}
