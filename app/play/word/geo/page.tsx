import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import GameGuide from "@/components/seo/GameGuide";
import GeoGame from "@/components/word/GeoGame";
import { getDailyWord } from "@/lib/games/dailyPuzzles";
import { GEO_COUNTRIES } from "@/lib/games/word/geoData";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Word Geo — Guess the Country from Its Shape (Free Daily)",
  description:
    "Name today's country from its silhouette in six guesses. Each guess shows the distance, a direction arrow and how close you are. Free, the same country for everyone, with a geography coach and practice.",
  path: "/play/word/geo",
});

// Today's country: refreshed on demand at the UTC day change (lib/revalidation.ts).
export const revalidate = 21600;

export default async function WordGeoPage() {
  const today = todayISO();
  const daily = await getDailyWord(today, "geo");
  if (daily.puzzle.mode !== "geo") throw new Error(`word/geo ${today}: stored row is not a geo puzzle`);
  return (
    <>
      <div className="relative">
        <GameRails />
        <GeoGame date={today} daily={daily.puzzle} countries={GEO_COUNTRIES} />
      </div>
      <GameGuide slug="word-geo" path="/play/word/geo" />
    </>
  );
}
