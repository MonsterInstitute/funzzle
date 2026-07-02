import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import WorldleGame from "@/components/WorldleGame";
import { countryForDate } from "@/lib/worldle";
import { COUNTRIES } from "@/lib/content/countries";
import { pageMetadata } from "@/lib/seo";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = pageMetadata({
  title: "Play Free Worldle — Guess the Country",
  description:
    "Play a free Worldle clone on Funzzle. Guess the country from its silhouette in six tries, with distance and direction hints. New country daily.",
  path: "/play/worldle",
});

export const revalidate = 3600;

export default function WorldlePlayPage() {
  const today = todayISO();
  const answer = countryForDate(today);
  const guessList = COUNTRIES.map((c) => ({
    name: c.name,
    lat: c.lat,
    lng: c.lng,
  }));

  return (
    <>
      <Header />
      <AdSlot slot="mobile-banner" className="py-3" />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#111827]">
          Funzzle Worldle
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {formatLongDate(today)} · Guess the country from its shape
        </p>
        <WorldleGame answer={answer} countries={guessList} date={today} />
        <AdSlot slot="rectangle" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
