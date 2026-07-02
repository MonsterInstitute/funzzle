import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import QuordleGame from "@/components/QuordleGame";
import { wordsForDate } from "@/lib/quordle";
import { pageMetadata } from "@/lib/seo";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = pageMetadata({
  title: "Play Free Quordle — Four Wordles at Once",
  description:
    "Play a free Quordle clone on Funzzle. Solve four five-letter words at once in nine guesses. Daily puzzle plus unlimited practice mode.",
  path: "/play/quordle",
});

export const revalidate = 3600;

export default function QuordlePlayPage() {
  const today = todayISO();
  const answers = wordsForDate(today);

  return (
    <>
      <Header />
      <AdSlot slot="mobile-banner" className="py-3" />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
          Funzzle Quordle
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {formatLongDate(today)} · Guess four words in nine tries
        </p>
        <QuordleGame dailyAnswers={answers} date={today} />
        <AdSlot slot="rectangle" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
