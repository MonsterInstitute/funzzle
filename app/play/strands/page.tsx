import type { Metadata } from "next";
import Header from "@/components/Header";
import GameRails from "@/components/ads/GameRails";
import Footer from "@/components/Footer";
import StrandsGame from "@/components/StrandsGame";
import { puzzleForDate } from "@/lib/strands";
import { pageMetadata } from "@/lib/seo";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = pageMetadata({
  title: "Play Free Strands — Themed Word Search",
  description:
    "Play a free Strands clone on Funzzle. Find the themed words hidden in the grid plus the spangram that spans it. New theme daily, three hints per game.",
  path: "/play/strands",
});

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default function StrandsPlayPage() {
  const today = todayISO();
  const puzzle = puzzleForDate(today);

  return (
    <>
      <Header />
      <div className="relative flex flex-1 flex-col">
        <GameRails board={512} />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
            Funzzle Strands
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            {formatLongDate(today)} · Find the themed words and the spangram
          </p>
          <StrandsGame puzzle={puzzle} date={today} />
        </main>
      </div>
      <Footer />
    </>
  );
}
