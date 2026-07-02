import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import WordleGame from "@/components/WordleGame";
import { todayISO, formatLongDate } from "@/lib/dates";
import { wordForDate } from "@/lib/wordleWords";

export const metadata: Metadata = {
  title: "Play Free Wordle",
  description:
    "Play a free daily Wordle clone on Funzzle. Six guesses, one five-letter word, no account required.",
};

// New word each day.
export const revalidate = 3600;

export default function WordlePlayPage() {
  const today = todayISO();
  const answer = wordForDate(today);

  return (
    <>
      <Header />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <h1 className="mb-2 text-center text-2xl font-extrabold tracking-tight text-[#111827]">
          Funzzle Wordle
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {formatLongDate(today)} · Guess the 5-letter word in 6 tries
        </p>

        <WordleGame answer={answer} date={today} />

        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
