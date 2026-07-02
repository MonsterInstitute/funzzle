import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import ConnectionsGame from "@/components/ConnectionsGame";
import { puzzleForDate } from "@/lib/connections";
import { pageMetadata } from "@/lib/seo";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = pageMetadata({
  title: "Play Free Connections — Group the Words",
  description:
    "Play a free Connections clone on Funzzle. Find four groups of four, four mistakes allowed. New puzzle daily, no account required.",
  path: "/play/connections",
});

export const revalidate = 3600;

export default function ConnectionsPlayPage() {
  const today = todayISO();
  const puzzle = puzzleForDate(today);

  return (
    <>
      <Header />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
          Funzzle Connections
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {formatLongDate(today)} · Group 16 words into 4 hidden categories
        </p>

        <ConnectionsGame puzzle={puzzle} date={today} />

        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
