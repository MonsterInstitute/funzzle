import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import GameCard from "@/components/GameCard";
import JsonLd from "@/components/JsonLd";
import { getAnswer, type WordleAnswerData } from "@/lib/getAnswers";
import { todayISO, formatLongDate } from "@/lib/dates";
import { pageMetadata, websiteJsonLd, faqJsonLd } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Funzzle — Free NYT Games, No Paywall",
  description:
    "Play free crossword puzzles, Wordle, Connections, and more. No subscription, no account. The free alternative to NYT Games.",
  path: "/",
  keywords: [
    "free nyt games",
    "free wordle",
    "free mini crossword",
    "free connections",
    "nyt games alternative",
    "no paywall puzzles",
  ],
});

export const revalidate = 3600;

const FAQS = [
  {
    q: "Is Funzzle really free?",
    a: "Yes — Funzzle is always free. Every game and answer page is supported by ads, so there is no subscription and no paywall.",
  },
  {
    q: "Do I need an account?",
    a: "No account is needed. Just open a game and start playing instantly — nothing to sign up for.",
  },
  {
    q: "Is this the same as NYT Mini?",
    a: "Funzzle uses a similar format to the NYT Mini and other NYT Games, but it is an independent, free alternative that is never behind a paywall.",
  },
  {
    q: "How often are new puzzles added?",
    a: "New puzzles are added every day, so there is always a fresh Mini Crossword, Wordle, and Connections to play.",
  },
  {
    q: "Can I play old puzzles?",
    a: "Yes — our answer archive covers the last 30 days for free, so you can catch up on puzzles and answers any time.",
  },
];

export default async function HomePage() {
  const today = todayISO();
  const [mini, wordle] = await Promise.all([
    getAnswer(today, "nyt-mini"),
    getAnswer<WordleAnswerData>(today, "wordle"),
  ]);

  return (
    <>
      <JsonLd data={[websiteJsonLd(), faqJsonLd(FAQS)]} />
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
            The crossword, Wordle, Connections, and more. Always free.
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
        <section id="games" className="mx-auto max-w-5xl px-4 pb-8">
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
              description="Group 16 words into 4 sets"
              emoji="🔗"
              href="/play/connections"
              badgeText="FREE FOREVER"
            />
            <GameCard
              title="Spelling Bee"
              description="Make words from seven letters"
              emoji="🐝"
              href="/play/spelling-bee"
              badgeText="FREE FOREVER"
            />
            <GameCard
              title="Strands"
              description="Themed word search + spangram"
              emoji="🔤"
              href="/play/strands"
              badgeText="FREE FOREVER"
            />
            <GameCard
              title="Letter Boxed"
              description="Use all 12 letters in a word chain"
              emoji="🔲"
              href="/play/letter-boxed"
              badgeText="FREE FOREVER"
            />
            <GameCard
              title="Quordle"
              description="Four Wordles at once"
              emoji="🟩"
              href="/play/quordle"
              badgeText="FREE FOREVER"
            />
            <GameCard
              title="Worldle"
              description="Guess the country from its shape"
              emoji="🌍"
              href="/play/worldle"
              badgeText="FREE FOREVER"
            />
            <GameCard
              title="Nerdle"
              description="Guess the math equation"
              emoji="🔢"
              href="/play/nerdle"
              badgeText="FREE FOREVER"
            />
          </div>
        </section>

        {/* Stats bar */}
        <section className="mx-auto max-w-5xl px-4 pb-12">
          <div className="grid gap-2 rounded-xl border border-[#e5e7eb] bg-gray-50 p-4 text-center text-sm font-semibold text-[#111827] sm:grid-cols-3">
            <span>🎮 Playing daily</span>
            <span>💯 100% free</span>
            <span>🚫 No account needed</span>
          </div>
        </section>

        {/* How to play */}
        <section className="border-y border-[#e5e7eb] bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="mb-8 text-center text-2xl font-bold text-[#111827]">
              How to Play
            </h2>
            <div className="grid gap-10 md:grid-cols-2">
              <HowTo
                emoji="🧩"
                title="Mini Crossword"
                steps={[
                  "Tap a square and read the highlighted clue.",
                  "Type your answer — it auto-advances across or down.",
                  "Fill every square correctly to beat the clock.",
                ]}
              />
              <HowTo
                emoji="🟩"
                title="Wordle"
                steps={[
                  "Guess any 5-letter word to start.",
                  "Green = right spot, yellow = wrong spot, gray = not in word.",
                  "Use the clues to solve it within six tries.",
                ]}
              />
            </div>
          </div>
        </section>

        {/* Why Funzzle */}
        <section className="bg-gray-50">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:grid-cols-3">
            <Feature emoji="🔓" title="Always Free" body="No paywall, no account needed" />
            <Feature emoji="🎯" title="Daily Puzzles" body="New challenges every day" />
            <Feature emoji="🏆" title="Play with Friends" body="Free leaderboard for everyone" />
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-6 text-center text-2xl font-bold text-[#111827]">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-[#e5e7eb] p-4"
              >
                <summary className="cursor-pointer list-none font-semibold text-[#111827]">
                  <span className="mr-2 text-[#16a34a] group-open:hidden">+</span>
                  <span className="mr-2 hidden text-[#16a34a] group-open:inline">
                    −
                  </span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-5 text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <AdSlot slot="rectangle" className="pb-14" />
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

function HowTo({
  emoji,
  title,
  steps,
}: {
  emoji: string;
  title: string;
  steps: string[];
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-lg font-bold text-[#111827]">
        <span aria-hidden>{emoji}</span> {title}
      </h3>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-sm text-gray-700">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
