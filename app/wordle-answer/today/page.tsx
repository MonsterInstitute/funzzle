import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import HintLadder from "@/components/kit/HintLadder";
import { wordleHints } from "@/lib/nytHints";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { getAnswer, type WordleAnswerData } from "@/lib/getAnswers";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { todayISO, formatLongDate } from "@/lib/dates";

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export async function generateMetadata(): Promise<Metadata> {
  const long = formatLongDate(todayISO());
  return pageMetadata({
    title: `Wordle Answer Today ${long}`,
    description:
      "Today's Wordle answer revealed with a hint. Plus play unlimited free Wordle on Funzzle.",
    path: "/wordle-answer/today",
    keywords: ["wordle answer today", "todays wordle", "wordle hint"],
  });
}

export default async function WordleAnswerPage() {
  const today = todayISO();
  const long = formatLongDate(today);
  const row = await getAnswer<WordleAnswerData>(today, "wordle");
  const data = row?.answer_data;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Wordle Answer Today", path: "/wordle-answer/today" },
        ])}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          Today&apos;s Wordle Answer — {long}
        </h1>

        {data ? (
          <div className="mt-6">
            <HintLadder
              headingLevel={2}
              title="Today’s Wordle hints"
              tag={long}
              hints={wordleHints(data)}
              answer={
                <>
                  <strong className="font-mono text-2xl tracking-[0.25em]">{data.answer.toUpperCase()}</strong>
                  {row?.summary && <span className="mt-2 block text-gray-700">{row.summary}</span>}
                </>
              }
            />
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-[#e5e7eb] bg-gray-50 p-6 text-center text-gray-500">
            Today&apos;s answer will be posted soon. Check back later!
          </p>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/play/wordle"
            className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]"
          >
            Play Free Unlimited Wordle →
          </Link>
        </div>

        <AdSlot slot="rectangle" className="my-10" />

        {/* SEO content */}
        <section className="prose prose-sm mt-4 text-gray-700">
          <h2 className="text-xl font-bold text-[#111827]">
            How to Play Wordle
          </h2>
          <p className="mt-3">
            Wordle is a daily word game where you have six tries to guess a
            hidden five-letter word. After each guess, the tiles change color to
            show how close you were.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              <span className="font-semibold text-[#16a34a]">Green</span> — the
              letter is correct and in the right spot.
            </li>
            <li>
              <span className="font-semibold text-yellow-600">Yellow</span> — the
              letter is in the word but in the wrong spot.
            </li>
            <li>
              <span className="font-semibold text-gray-500">Gray</span> — the
              letter is not in the word at all.
            </li>
          </ul>
          <p className="mt-3">
            A strong opening word uses common letters and multiple vowels — try
            CRANE, SLATE, or RAISE. On Funzzle you can play a new puzzle every
            day, completely free and with no account required.
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
