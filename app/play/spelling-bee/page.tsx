import type { Metadata } from "next";
import Header from "@/components/Header";
import GameRails from "@/components/ads/GameRails";
import Footer from "@/components/Footer";
import SpellingBeeGame from "@/components/SpellingBeeGame";
import { beePuzzleForDate } from "@/lib/spellingBee";
import { pageMetadata } from "@/lib/seo";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = pageMetadata({
  title: "Play Free Spelling Bee — Make Words from 7 Letters",
  description:
    "Play a free Spelling Bee clone on Funzzle. Make words using the seven letters, always including the center. New puzzle daily, no account required.",
  path: "/play/spelling-bee",
});

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default function SpellingBeePlayPage() {
  const today = todayISO();
  const puzzle = beePuzzleForDate(today);

  return (
    <>
      <Header />

      <div className="relative flex flex-1 flex-col">
        <GameRails board={672} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
            Funzzle Spelling Bee
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            {formatLongDate(today)} · Make words (4+ letters) that include the
            center letter
          </p>

          <SpellingBeeGame puzzle={puzzle} date={today} />
        </main>
      </div>

      <Footer />
    </>
  );
}
