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
  title: "Free NYT Games Alternative — No Paywall",
  description:
    "Funzzle is the free NYT Games alternative: play Wordle, the Mini Crossword, and Connections online with no subscription and no account. All free, forever.",
  path: "/free-nyt-games-alternative",
  keywords: [
    "free nyt games alternative",
    "nyt games free",
    "wordle without subscription",
    "free puzzle games",
  ],
});

export const revalidate = 3600;

export default function FreeAlternativePage() {
  const today = todayISO();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Free NYT Games Alternative", path: "/free-nyt-games-alternative" },
        ])}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          Free NYT Games Alternative — No Paywall
        </h1>

        <div className="prose prose-sm mt-4 text-gray-700">
          <p>
            In 2025 the best-loved word games — Wordle, the Mini Crossword,
            Connections, and Spelling Bee — sit behind the New York Times Games
            paywall. Funzzle is the free alternative. Every game here is playable
            instantly, with no subscription, no free-article limit, and no
            account to create. If you just want to solve a quick puzzle on your
            break, you should not have to pull out a credit card first.
          </p>
          <p>
            Funzzle is supported by unobtrusive display ads instead of
            subscriptions. That single decision keeps the entire site free: the{" "}
            <Link href="/play/mini" className="text-[#16a34a] hover:underline">
              Mini Crossword
            </Link>
            , our{" "}
            <Link href="/play/wordle" className="text-[#16a34a] hover:underline">
              unlimited Wordle
            </Link>
            , and daily{" "}
            <Link
              href="/play/connections"
              className="text-[#16a34a] hover:underline"
            >
              Connections
            </Link>{" "}
            are all here at no cost. New puzzles arrive every day, and a 30-day
            answer archive means you can always catch up on the ones you missed.
          </p>
        </div>

        {/* Embedded game */}
        <div className="mt-8 rounded-xl border border-[#e5e7eb] p-4">
          <h2 className="mb-4 text-center text-lg font-bold text-[#111827]">
            Try it now — today&apos;s free Wordle
          </h2>
          <WordleGame answer={wordForDate(today)} date={today} />
        </div>

        <AdSlot slot="rectangle" className="my-10" />

        <div className="prose prose-sm text-gray-700">
          <h2 className="text-xl font-bold text-[#111827]">
            What you get with Funzzle
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Unlimited Wordle — play as many rounds as you like, not just one.</li>
            <li>A fresh 5×5 Mini Crossword every day, solvable in about a minute.</li>
            <li>Daily Connections with the same four-groups-of-four format you know.</li>
            <li>Free daily answers and explanations for the NYT Mini and Wordle.</li>
            <li>No login, no email, no paywall — ever.</li>
          </ul>
          <p className="mt-4">
            Funzzle is not affiliated with The New York Times. We simply believe
            a daily puzzle habit should be free for everyone. Bookmark the site,
            play your favorites, and share your results with friends — the
            classic emoji grid works here too.
          </p>
          <p>
            Looking for today&apos;s solutions instead? Head to our{" "}
            <Link
              href={`/nyt-crossword-answers/${today}`}
              className="text-[#16a34a] hover:underline"
            >
              NYT Crossword answers
            </Link>{" "}
            page or the{" "}
            <Link
              href="/wordle-answer/today"
              className="text-[#16a34a] hover:underline"
            >
              Wordle answer today
            </Link>{" "}
            page.
          </p>
        </div>

        <AffiliateCTA />
        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
