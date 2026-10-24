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
  title: "Free NYT Mini Crossword — Play Online Daily",
  description:
    "Play a free NYT-style Mini Crossword online every day. No subscription, no account — a quick 5×5 solve with instant answers on Funzzle.",
  path: "/nyt-mini-crossword-free",
  keywords: [
    "free nyt mini crossword",
    "mini crossword online free",
    "daily mini crossword",
    "5x5 crossword free",
  ],
});

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default async function MiniFreePage() {
  const today = todayISO();
  const puzzle = fromDailyMini(await getDailyMini(today));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Free NYT Mini Crossword", path: "/nyt-mini-crossword-free" },
        ])}
      />
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          Free NYT Mini Crossword — Play Online Daily
        </h1>

        <div className="prose prose-sm mt-4 text-gray-700">
          <p>
            The Mini Crossword is the perfect coffee-break puzzle: a compact 5×5
            grid you can usually finish in about a minute. Funzzle gives you a
            brand-new Mini every single day, completely free — no NYT
            subscription, no account, and no limit on how many you can play.
          </p>
          <p>
            Our Mini plays exactly the way you expect. Tap a square to start,
            read the highlighted clue, and type your answer; the cursor
            auto-advances across or down. Use the arrow keys or tap a clue to
            jump around, and hit <strong>Check</strong> any time to see whether
            your letters are right. Stuck? <strong>Reveal</strong> fills the
            solution so you can learn the tricky entries for next time.
          </p>
        </div>

        {/* Embedded game */}
        <div className="mt-8 rounded-xl border border-[#e5e7eb] p-4">
          <h2 className="mb-4 text-center text-lg font-bold text-[#111827]">
            Today&apos;s free Mini Crossword
          </h2>
          <MiniCrossword puzzle={puzzle} date={today} />
        </div>


        <div className="prose prose-sm text-gray-700">
          <h2 className="text-xl font-bold text-[#111827]">
            Why play the Mini on Funzzle?
          </h2>
          <p className="mt-2">
            Because it is genuinely free and genuinely daily. A short crossword
            is one of the best small habits you can build — it wakes up your
            vocabulary, sharpens pattern recognition, and gives you a tidy little
            win to start the day. Keeping it free means you can make it a routine
            without a recurring charge.
          </p>
          <p>
            Want to see how today&apos;s puzzle shakes out, or review one you
            missed? Our{" "}
            <Link
              href={`/nyt-crossword-answers/${today}`}
              className="text-[#16a34a] hover:underline"
            >
              NYT Crossword answers
            </Link>{" "}
            page publishes every clue with a short explanation, and the archive
            covers the last 30 days. You can also browse individual{" "}
            <Link href="/clue" className="text-[#16a34a] hover:underline">
              crossword clue answers
            </Link>{" "}
            when a single entry has you stumped. Prefer a word game instead? Try
            our{" "}
            <Link
              href="/play/wordle"
              className="text-[#16a34a] hover:underline"
            >
              free unlimited Wordle
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
