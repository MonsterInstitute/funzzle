import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import T2048Game from "@/components/t2048/T2048Game";
import { getDaily2048 } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily 2048 — Free, the Same Tiles for Everyone, with a Coach",
  description:
    "Play today's free Daily 2048: slide and merge on a 4×4 board with the same new tiles for everyone, a coach that suggests the best move and explains why, and your score ranked against today's players. Unlimited practice games.",
  path: "/play/2048",
});

// Today's seed: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function Page2048() {
  const today = todayISO();
  const daily = await getDaily2048(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <T2048Game date={today} daily={daily} />
      </div>
      <GameGuide slug="2048" path="/play/2048" />
    </>
  );
}
