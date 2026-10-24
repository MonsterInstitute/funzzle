import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Header from "@/components/Header";
import GameRails from "@/components/ads/GameRails";
import PassportStamp from "@/components/kit/PassportStamp";
import Footer from "@/components/Footer";
import WordleGame from "@/components/WordleGame";
import { todayISO, formatLongDate } from "@/lib/dates";
import { wordForDate } from "@/lib/wordleWords";

export const metadata: Metadata = pageMetadata({
  title: "Play Free Wordle",
  description:
    "Play a free daily Wordle clone on Funzzle. Six guesses, one five-letter word, no account required.",
  path: "/play/wordle",
});

// New word each day.
// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default function WordlePlayPage() {
  const today = todayISO();
  const answer = wordForDate(today);

  return (
    <>
      <Header />

      <div className="relative flex flex-1 flex-col">
        <PassportStamp game="word" />
        <GameRails board={512} />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
          <h1 className="mb-2 text-center text-2xl font-extrabold tracking-tight text-[#111827]">
            Funzzle Wordle
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            {formatLongDate(today)} · Guess the 5-letter word in 6 tries
          </p>

          <WordleGame answer={answer} date={today} />
        </main>
      </div>

      <Footer />
    </>
  );
}
