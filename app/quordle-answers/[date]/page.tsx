import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import RevealBox from "@/components/RevealBox";
import { wordsForDate } from "@/lib/quordle";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { isValidISODate, formatLongDate, recentDates } from "@/lib/dates";

type Params = { date: string };
export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return recentDates(90).map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { date } = await params;
  if (!isValidISODate(date)) return { title: "Quordle Answers" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `Quordle Answers ${long} — All 4 Words`,
    description: `All four Quordle answers for ${long}, revealed. Plus play unlimited free Quordle on Funzzle.`,
    path: `/quordle-answers/${date}`,
  });
}

export default async function QuordleAnswersPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();
  const long = formatLongDate(date);
  const words = wordsForDate(date);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Quordle Answers", path: `/quordle-answers/${date}` }])} />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Quordle Answers — {long}
        </h1>
        <p className="mt-3 text-gray-600">
          All four words for the {long} Quordle. Tap a card to reveal each answer.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {words.map((w, i) => (
            <div key={i}>
              <p className="mb-1 text-sm font-semibold text-gray-500">Word {i + 1}</p>
              <RevealBox answer={w} />
            </div>
          ))}
        </div>

        <p className="mt-6 text-gray-700">
          Quordle asks you to solve four five-letter words at once with nine
          guesses. A vowel-rich opener like AUDIO or RAISE, followed by a
          consonant-heavy second guess, is the fastest way to narrow all four
          boards at the same time.
        </p>

        <div className="mt-8 text-center">
          <Link href="/play/quordle" className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]">
            Play free Quordle →
          </Link>
        </div>
        <AdSlot slot="rectangle" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
