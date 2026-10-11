import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import WordleGame from "@/components/WordleGame";
import AffiliateCTA from "@/components/AffiliateCTA";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { todayISO } from "@/lib/dates";
import { wordForDate } from "@/lib/wordleWords";

export const metadata: Metadata = pageMetadata({
  title: "Free Unlimited Wordle — Play Anytime",
  description:
    "Play free unlimited Wordle online. No subscription, no account, no one-a-day limit — guess the 5-letter word as many times as you like on Funzzle.",
  path: "/wordle-free",
  keywords: [
    "free wordle",
    "unlimited wordle",
    "wordle no subscription",
    "play wordle online free",
  ],
});

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default function WordleFreePage() {
  const today = todayISO();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Free Wordle", path: "/wordle-free" },
        ])}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          Free Unlimited Wordle — Play Anytime
        </h1>

        <div className="prose prose-sm mt-4 text-gray-700">
          <p>
            Wordle is the five-letter guessing game that took over the world:
            six tries to find the hidden word, with color hints after every
            guess. Funzzle&apos;s version is free and unlimited. There is no
            paywall, no account, and no once-a-day cap — if you lose, you can
            jump straight into another round.
          </p>
          <p>
            The rules are simple. Type any five-letter word and press enter. A{" "}
            <strong className="text-[#16a34a]">green</strong> tile means the
            letter is correct and in the right spot,{" "}
            <strong className="text-yellow-600">yellow</strong> means it is in
            the word but somewhere else, and{" "}
            <strong className="text-gray-500">gray</strong> means it is not in
            the word at all. Good openers use common letters and multiple
            vowels — CRANE, SLATE, and RAISE are all strong first guesses.
          </p>
        </div>

        {/* Embedded game */}
        <div className="mt-8 rounded-xl border border-[#e5e7eb] p-4">
          <h2 className="mb-4 text-center text-lg font-bold text-[#111827]">
            Play free Wordle now
          </h2>
          <WordleGame answer={wordForDate(today)} date={today} />
        </div>

        <AdSlot slot="rectangle" className="my-10" />

        <div className="prose prose-sm text-gray-700">
          <h2 className="text-xl font-bold text-[#111827]">
            Tips to win more often
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Open with a vowel-rich word to map the board quickly.</li>
            <li>Spend your second guess on new letters, not confirmed ones.</li>
            <li>Watch for repeated letters — words like CHESS trip people up.</li>
            <li>Save trickier consonants (J, Q, X, Z) for when the pattern narrows.</li>
          </ul>
          <p className="mt-4">
            Curious what today&apos;s official answer is? We publish it — with a
            gentle hint and a spoiler-safe reveal — on the{" "}
            <Link
              href="/wordle-answer/today"
              className="text-[#16a34a] hover:underline"
            >
              Wordle answer today
            </Link>{" "}
            page. And if you like a good crossword too, the free{" "}
            <Link href="/play/mini" className="text-[#16a34a] hover:underline">
              Mini Crossword
            </Link>{" "}
            is a great one-minute follow-up.
          </p>
        </div>

        <AffiliateCTA />
        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
