import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import MiniCrossword from "@/components/MiniCrossword";
import AffiliateCTA from "@/components/AffiliateCTA";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { todayISO } from "@/lib/dates";
import { getDailyMini } from "@/lib/games/dailyPuzzles";
import { fromDailyMini } from "@/lib/miniCrossword";

export const metadata: Metadata = pageMetadata({
  title: "Free Daily Crossword Puzzle — No Subscription",
  description:
    "A free daily crossword puzzle you can play online with no subscription and no account. Fresh grid every day plus answers on Funzzle.",
  path: "/free-crossword-puzzle-daily",
  keywords: [
    "free daily crossword",
    "free crossword puzzle",
    "crossword no subscription",
    "online crossword free",
  ],
});

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default async function FreeCrosswordDailyPage() {
  const today = todayISO();
  const puzzle = fromDailyMini(await getDailyMini(today));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          {
            name: "Free Daily Crossword",
            path: "/free-crossword-puzzle-daily",
          },
        ])}
      />
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          Free Daily Crossword Puzzle — No Subscription
        </h1>

        <div className="prose prose-sm mt-4 text-gray-700">
          <p>
            A daily crossword is one of the healthiest little habits you can
            keep: a few minutes of focused wordplay that flexes your vocabulary
            and memory. Funzzle makes it effortless with a fresh puzzle every
            day that is completely free — no subscription, no account, and no
            trial that quietly expires.
          </p>
          <p>
            Most big-name crosswords now require a paid plan to play the full
            archive. We took the opposite approach: run lightweight ads, keep
            the puzzles free, and let anyone solve as many as they want. Whether
            you are a daily solver or just here to kill five minutes, you never
            hit a paywall.
          </p>
        </div>

        {/* Embedded game */}
        <div className="mt-8 rounded-xl border border-[#e5e7eb] p-4">
          <h2 className="mb-4 text-center text-lg font-bold text-[#111827]">
            Solve today&apos;s free crossword
          </h2>
          <MiniCrossword puzzle={puzzle} date={today} />
        </div>


        <div className="prose prose-sm text-gray-700">
          <h2 className="text-xl font-bold text-[#111827]">
            How our free crossword works
          </h2>
          <p className="mt-2">
            Each puzzle is a quick 5×5 grid — the same bite-sized format that
            made the Mini so popular. Tap a square, read the clue that lights up,
            and type. You can check your progress at any point, reveal the answer
            when you are stuck, and reset to try again for a faster time. Because
            it is small, it is beatable: most solvers finish in a minute or two.
          </p>
          <p>
            When you finish, compare notes on our{" "}
            <Link
              href={`/nyt-crossword-answers/${today}`}
              className="text-[#16a34a] hover:underline"
            >
              daily crossword answers
            </Link>{" "}
            page, where every clue comes with a short explanation. You can also
            dig into a single tricky entry on our{" "}
            <Link href="/clue" className="text-[#16a34a] hover:underline">
              crossword clue
            </Link>{" "}
            pages, or switch things up with free{" "}
            <Link
              href="/play/connections"
              className="text-[#16a34a] hover:underline"
            >
              Connections
            </Link>{" "}
            and{" "}
            <Link
              href="/play/wordle"
              className="text-[#16a34a] hover:underline"
            >
              Wordle
            </Link>
            .
          </p>
        </div>

        <AffiliateCTA />
        <AdSlot slot="in-content" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
