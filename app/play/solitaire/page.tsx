import type { Metadata } from "next";
import GameGuide from "@/components/seo/GameGuide";
import SolitaireGame from "@/components/solitaire/SolitaireGame";
import { getDailySolitaire } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Solitaire — Free Klondike, Every Deal Winnable",
  description:
    "Play today's free Daily Solitaire (Klondike, draw 1 or 3): one deal for everyone, verified winnable by our solver, with a coach that shows the best move. Unlimited practice deals.",
  path: "/play/solitaire",
});

// Today's deals: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function SolitairePage() {
  const today = todayISO();
  const [daily1, daily3] = await Promise.all([getDailySolitaire(today, 1), getDailySolitaire(today, 3)]);
  return (
    <>
      <SolitaireGame date={today} daily1={daily1} daily3={daily3} />
      <GameGuide slug="solitaire" path="/play/solitaire" />
    </>
  );
}
