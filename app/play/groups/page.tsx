import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GroupsGame from "@/components/groups/GroupsGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyGroups } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Groups — Free Daily Word Grouping Puzzle",
  description:
    "Play today's free Groups puzzle: sort 16 words into four hidden groups of four, with four mistakes allowed, a coach for hints and your rank against today's players. Unlimited practice boards.",
  path: "/play/groups",
});

// Today's board: refreshed on demand at the UTC day change and after the
// daily content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default async function GroupsPage() {
  const today = todayISO();
  const daily = await getDailyGroups(today);
  return (
    <>
      <div className="relative">
        <GameRails />
        <GroupsGame date={today} daily={daily.puzzle} />
      </div>
      <GameGuide slug="groups" path="/play/groups" />
    </>
  );
}
