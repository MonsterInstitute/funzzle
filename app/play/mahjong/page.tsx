import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import MahjongGame from "@/components/mahjong/MahjongGame";
import { MAHJONG_BOARD_MAX } from "@/components/mahjong/board";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyMahjong } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Mahjong Solitaire — Free Tile Matching, Every Deal Solvable",
  description:
    "Play today's free Mahjong Solitaire: one 144-tile Turtle deal for everyone, built so it can be cleared, with a coach that shows a match and explains why. Unlimited practice on five layouts, including a small board for phones.",
  path: "/play/mahjong",
});

// Today's deal: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function MahjongPage() {
  const today = todayISO();
  const daily = await getDailyMahjong(today);
  return (
    <>
      <div className="relative">
        <GameRails board={MAHJONG_BOARD_MAX} />
        <MahjongGame date={today} daily={daily} />
      </div>
      <GameGuide slug="mahjong" path="/play/mahjong" />
    </>
  );
}
