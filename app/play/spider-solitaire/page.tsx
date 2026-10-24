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
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function SpiderSolitairePage() {
  const today = todayISO();
  // 1 suit falls back to generating from the seed (~60 ms). 2 and 4 suits
  // never do (up to ~250 MB / ~1 GB, over a Worker's 128 MB): they come from
  // scripts/pregenerate-spider.ts, and a mode without a stored deal is hidden.
  const [daily1, daily2, daily4] = await Promise.all([
    getDailySpider(today),
    getStoredDailySpider(today, 2),
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
