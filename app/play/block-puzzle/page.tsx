import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import BlockGame from "@/components/block/BlockGame";
import GameGuide from "@/components/seo/GameGuide";
import { dailyBlock, validSequence } from "@/lib/games/block";
import { getDailyBlock } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Block Puzzle — Free 8×8 Block Game with a Coach",
  description:
    "Play today's free Daily Block Puzzle: fit three pieces at a time on an 8×8 board, clear rows and columns for combo points, and compare your score with today's players. Same pieces for everyone, plus endless practice.",
  path: "/play/block-puzzle",
});

// Today's piece sequence: refreshed on demand at the UTC day change
// (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default async function BlockPuzzlePage() {
  const today = todayISO();
  const stored = await getDailyBlock(today);
  // A stored row without a usable sequence (written by an older build) falls
  // back to the same sequence regenerated from the seed.
  const daily = validSequence(stored.pieces) ? stored : dailyBlock(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <BlockGame date={today} daily={{ seed: daily.seed, pieces: daily.pieces }} />
      </div>
      <GameGuide slug="block-puzzle" path="/play/block-puzzle" />
    </>
  );
}
