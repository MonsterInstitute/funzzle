import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import GameCard from "@/components/GameCard";
import { getAnswer, type WordleAnswerData } from "@/lib/getAnswers";
import { todayISO, formatLongDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Funzzle — Free NYT Games, No Paywall",
  description:
    "Play free crossword puzzles, Wordle, and more. No subscription, no account. The free alternative to NYT Games.",
};

// Revalidate hourly so freshly published answers show up.
export const revalidate = 3600;

export default async function HomePage() {
  const today = todayISO();
  const [mini, wordle] = await Promise.all([
    getAnswer(today, "nyt-mini"),
    getAnswer<WordleAnswerData>(today, "wordle"),
  ]);

  return (
    <>
      <Header />

      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#111827] sm:text-5xl">
            Free NYT Games — No Paywall Ever
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            The crossword, Wordle, and more. Always free.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/play/mini"
              className="w-full rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d] sm:w-auto"
            >
              Play Mini Crossword
            </Link>
            <Link
              href={`/nyt-crossword-answers/${today}`}
              className="w-full rounded-lg border border-[#e5e7eb] px-6 py-3 font-semibold text-[#111827] transition-colors hover:border-[#16a34a] hover:text-[#16a34a] sm:w-auto"
            >
              See Today&apos;s Answers
            </Link>
          </div>
        </section>

        {/* Today's Answers strip */}
        <section className="mx-auto max-w-5xl px-4 pb-12">
          <h2 className="mb-4 text-xl font-bold text-[#111827]">
            Today&apos;s Answers
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <AnswerStripCard
              title="NYT Mini Answers"
              href={`/nyt-crossword-answers/${today}`}
              available={!!mini}
              detail={
                mini
                  ? `Solved · ${formatLongDate(today)}`
                  : "Coming soon — check back today"
              }
            />
            <AnswerStripCard
              title="Wordle Answer"
              href="/wordle-answer/today"
              available={!!wordle}
              detail={
                wordle
                  ? `Revealed · ${formatLongDate(today)}`
                  : "Coming soon — check back today"
              }
            />
          </div>
        </section>

        {/* Games */}
        <section className="mx-auto max-w-5xl px-4 pb-12">
          <h2 className="mb-4 text-xl font-bold text-[#111827]">Games</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GameCard
              title="Mini Crossword"
              description="5×5 · ~1 min"
              emoji="🧩"
              href="/play/mini"
              badgeText="FREE FOREVER"
            />
            <GameCard
              title="Wordle Clone"
              description="Guess the 5-letter word"
              emoji="🟩"
              href="/play/wordle"
              badgeText="FREE FOREVER"
            />
            <GameCard
              title="Connections"
              description="Group the words into four sets"
              emoji="🔗"
              href="#"
              badgeText="SOON"
              disabled
            />
            <GameCard
              title="Spelling Bee"
              description="Make words from seven letters"
              emoji="🐝"
              href="#"
              badgeText="SOON"
              disabled
            />
          </div>
        </section>

        {/* Why Funzzle */}
        <section className="border-y border-[#e5e7eb] bg-gray-50">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:grid-cols-3">
            <Feature
              emoji="🔓"
              title="Always Free"
              body="No paywall, no account needed"
            />
            <Feature
              emoji="🎯"
              title="Daily Puzzles"
              body="New challenges every day"
            />
            <Feature
              emoji="🏆"
              title="Play with Friends"
              body="Free leaderboard for everyone"
            />
          </div>
        </section>

        <AdSlot slot="rectangle" className="py-12" />
      </main>

      <Footer />
    </>
  );
}

function AnswerStripCard({
  title,
  href,
  detail,
  available,
}: {
  title: string;
  href: string;
  detail: string;
  available: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white p-5 transition-shadow hover:shadow-lg"
    >
      <div>
        <p className="font-bold text-[#111827]">{title}</p>
        <p
          className={`mt-1 text-sm ${
            available ? "text-[#16a34a]" : "text-gray-400"
          }`}
        >
          {detail}
        </p>
      </div>
      <span className="text-[#16a34a] transition-transform group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

function Feature({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-3xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="mt-2 font-bold text-[#111827]">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
    </div>
  );
}
