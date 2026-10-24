import type { Metadata } from "next";
import Header from "@/components/Header";
import GameRails from "@/components/ads/GameRails";
import PassportStamp from "@/components/kit/PassportStamp";
import Footer from "@/components/Footer";
import LetterBoxedGame from "@/components/LetterBoxedGame";
import { puzzleForDate } from "@/lib/letterBoxed";
import { pageMetadata } from "@/lib/seo";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = pageMetadata({
  title: "Play Free Letter Boxed — Word Chain Puzzle",
  description:
    "Play a free Letter Boxed clone on Funzzle. Spell words around a square using all 12 letters — each word starts with the previous word's last letter. New puzzle daily.",
  path: "/play/letter-boxed",
});

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default function LetterBoxedPlayPage() {
  const today = todayISO();
  const puzzle = puzzleForDate(today);

  return (
    <>
      <Header />
      <div className="relative flex flex-1 flex-col">
        <PassportStamp game="letter-box" />
        <GameRails board={512} />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
            Funzzle Letter Boxed
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            {formatLongDate(today)} · Use all 12 letters; chain word to word
          </p>
          <LetterBoxedGame puzzle={puzzle} date={today} />
        </main>
      </div>
      <Footer />
    </>
  );
}
