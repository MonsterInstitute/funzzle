import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import JigsawGame from "@/components/jigsaw/JigsawGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyJigsaw } from "@/lib/games/dailyPuzzles";
import { dailyJigsaw, isPieceCount, SIZES } from "@/lib/games/jigsaw";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Jigsaw Puzzle — Free, a New Picture Every Day",
  description:
    "Play today's free Daily Jigsaw: a new original picture cut into 24 classic pieces, the same for everyone, with an edge filter, a preview and a coach that shows where a piece goes. Practice from 12 to 96 pieces.",
  path: "/play/jigsaw",
});

// Today's puzzle: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function JigsawPage() {
  const today = todayISO();
  const stored = await getDailyJigsaw(today);
  // The stored row's seed and size win; anything missing falls back to today's defaults.
  const fallback = dailyJigsaw(today);
  const daily = isPieceCount(stored.pieces) ? { ...fallback, ...stored, ...SIZES[stored.pieces] } : { ...fallback, seed: stored.seed || fallback.seed };
  return (
    <>
      <div className="relative">
        <GameRails />
        <JigsawGame date={today} daily={daily} />
      </div>
      <GameGuide slug="jigsaw" path="/play/jigsaw" />
    </>
  );
}
