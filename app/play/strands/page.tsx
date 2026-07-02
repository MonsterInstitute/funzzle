import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
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

export const revalidate = 3600;

export default function StrandsPlayPage() {
  const today = todayISO();
  const puzzle = puzzleForDate(today);

  return (
    <>
      <Header />
      <AdSlot slot="mobile-banner" className="py-3" />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
          Funzzle Strands
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {formatLongDate(today)} · Find the themed words and the spangram
        </p>
        <StrandsGame puzzle={puzzle} date={today} />
        <AdSlot slot="rectangle" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
