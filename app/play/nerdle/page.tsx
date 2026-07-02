import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import NerdleGame from "@/components/NerdleGame";
import { equationForDate } from "@/lib/nerdle";
import { pageMetadata } from "@/lib/seo";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = pageMetadata({
  title: "Play Free Nerdle — Math Equation Puzzle",
  description:
    "Play a free Nerdle clone on Funzzle. Guess the hidden 8-character math equation in six tries. New puzzle daily, no account required.",
  path: "/play/nerdle",
});

export const revalidate = 3600;

export default function NerdlePlayPage() {
  const today = todayISO();
  const answer = equationForDate(today);

  return (
    <>
      <Header />
      <AdSlot slot="mobile-banner" className="py-3" />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
          Funzzle Nerdle
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {formatLongDate(today)} · Guess the math equation in 6 tries
        </p>
        <NerdleGame answer={answer} date={today} />
        <AdSlot slot="rectangle" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
