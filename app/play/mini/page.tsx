import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import MiniCrossword from "@/components/MiniCrossword";
import { SAMPLE_MINI } from "@/lib/miniCrossword";
import { getMiniPuzzle } from "@/lib/getPuzzle";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Free Mini Crossword",
  description:
    "Play a free 5×5 mini crossword on Funzzle. Quick daily solve, no account required.",
};

// Pick up a freshly published daily puzzle within the hour.
export const revalidate = 3600;

export default async function MiniPlayPage() {
  const today = todayISO();
  // Use today's published puzzle from Supabase when available; otherwise fall
  // back to the built-in sample so the page is always playable.
  const puzzle = (await getMiniPuzzle(today)) ?? SAMPLE_MINI;

  return (
    <>
      <Header />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
          {puzzle.title}
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {formatLongDate(today)} · 5×5 · Fill every square to win
        </p>

        <MiniCrossword puzzle={puzzle} date={today} />

        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
