import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import SpiderGame from "@/components/spider/SpiderGame";
import { getDailySpider, getStoredDailySpider } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Spider Solitaire — Free Daily Deal in 1, 2 or 4 Suits",
  description:
    "Play free Spider Solitaire: a daily deal in one, two or four suits that our solver has verified winnable, unlimited undo, and a coach that shows the best move. Unlimited practice deals.",
  path: "/play/spider-solitaire",
});

// Today's deals: refreshed on demand at the UTC day change (lib/revalidation.ts)
// and when the answers cron stores a late 4-suit deal; the 6h window is only a fallback.
export const revalidate = 21600;

export default async function SpiderSolitairePage() {
  const today = todayISO();
  // 1 and 2 suits fall back to generating from the seed (≤ ~2 s); 4 suits never
  // does (up to ~16 s and ~1 GB), so it's offered only once the cron stored it.
  const [daily1, daily2, daily4] = await Promise.all([
    getDailySpider(today, 1),
    getDailySpider(today, 2),
    getStoredDailySpider(today, 4),
  ]);
  return (
    <>
      <div className="relative">
        <GameRails />
        <SpiderGame date={today} daily1={daily1} daily2={daily2} daily4={daily4} />
      </div>
      <GameGuide slug="spider-solitaire" path="/play/spider-solitaire" />
    </>
  );
}
