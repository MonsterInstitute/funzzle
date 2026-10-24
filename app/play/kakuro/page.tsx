import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import KakuroGame from "@/components/kakuro/KakuroGame";
import { getDailyKakuro } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Kakuro with a Coach — Free Cross-Sum Number Puzzle",
  description:
    "Play today's free Daily Kakuro: one 8×8 cross-sum grid for everyone with exactly one solution, a coach that explains unique sums and combinations step by step, and your rank against today's players. Easy to hard practice grids.",
  path: "/play/kakuro",
});

// Today's grid: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function KakuroPage() {
  const today = todayISO();
  const daily = await getDailyKakuro(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <KakuroGame
          date={today}
          daily={{ difficulty: daily.difficulty, size: daily.size, layout: daily.layout, across: daily.across, down: daily.down, solution: daily.solution }}
        />
      </div>
      <GameGuide slug="kakuro" path="/play/kakuro" />
    </>
  );
}
