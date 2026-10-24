import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import FreeCellGame from "@/components/freecell/FreeCellGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyFreeCell } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily FreeCell — Free FreeCell, Every Deal Solver-Verified",
  description:
    "Play today's free Daily FreeCell: one deal for everyone, verified winnable by our solver, with supermoves, safe auto-moves and a coach that shows the best move. Unlimited practice deals.",
  path: "/play/freecell",
});

// Today's deal: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function FreeCellPage() {
  const today = todayISO();
  const daily = await getDailyFreeCell(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <FreeCellGame date={today} daily={daily} />
      </div>
      <GameGuide slug="freecell" path="/play/freecell" />
    </>
  );
}
