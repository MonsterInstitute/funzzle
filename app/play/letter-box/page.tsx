import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import LetterBoxGame from "@/components/letterbox/LetterBoxGame";
import GameGuide from "@/components/seo/GameGuide";
import { getDailyLetterBox } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Letter Box — Free Daily Word Chain Puzzle",
  description:
    "Play today's free Letter Box: chain words around a square of twelve letters until every letter is used. Every box has a two-word solution, a coach when you're stuck, and your result ranked against today's players.",
  path: "/play/letter-box",
});

// Today's box: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function LetterBoxPage() {
  const today = todayISO();
  const { date: _date, ...daily } = await getDailyLetterBox(today);
  void _date;
  return (
    <>
      <div className="relative">
        <GameRails />
        <LetterBoxGame date={today} daily={daily} />
      </div>
      <GameGuide slug="letter-box" path="/play/letter-box" />
    </>
  );
}
