import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { SITE_NAME, AFFILIATE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "About Funzzle",
  description:
    "Funzzle is a free, ad-supported alternative to NYT Games — Wordle, the Mini Crossword, Connections, and Spelling Bee, with no paywall and no account.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          About {SITE_NAME}
        </h1>

        <div className="prose prose-sm mt-6 text-gray-700">
          <p>
            {SITE_NAME} is a free daily puzzle site. We build clean, fast,
            no-nonsense versions of the word and logic games people love to play
            every morning — a 5×5 Mini Crossword, an unlimited Wordle, a daily
            Connections, and a Spelling Bee — and we keep every one of them free.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">Why we exist</h2>
          <p>
            In 2025, most of the best-known daily puzzles moved behind a paywall.
            We think a five-minute daily brain teaser is a small, healthy habit
            that shouldn&apos;t require a subscription or a login. So we made
            {" "}
            {SITE_NAME}: open a game and start playing instantly — no account, no
            credit card, no free-article limit. It is the free alternative for
            people who just want to solve today&apos;s puzzle.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            How we keep it free
          </h2>
          <p>
            {SITE_NAME} is supported by display advertising. Ads let us run the
            servers, publish new puzzles every day, and keep the games free for
            everyone. That is the entire business model — there is no premium
            tier and nothing to unlock. If you&apos;d like to support the site,
            simply playing (and not blocking ads) is enough.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            What you can play
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <Link href="/play/mini" className="text-[#16a34a] hover:underline">
                Mini Crossword
              </Link>{" "}
              — a quick 5×5 grid, solvable in about a minute.
            </li>
            <li>
              <Link href="/play/wordle" className="text-[#16a34a] hover:underline">
                Wordle
              </Link>{" "}
              — six guesses to find the five-letter word, unlimited replays.
            </li>
            <li>
              <Link
                href="/play/connections"
                className="text-[#16a34a] hover:underline"
              >
                Connections
              </Link>{" "}
              — sort sixteen words into four hidden groups.
            </li>
            <li>
              <Link
                href="/play/spelling-bee"
                className="text-[#16a34a] hover:underline"
              >
                Spelling Bee
              </Link>{" "}
              — build words from seven letters and chase the Genius rank.
            </li>
          </ul>
          <p className="mt-3">
            We also publish free daily{" "}
            <Link
              href="/wordle-answer/today"
              className="text-[#16a34a] hover:underline"
            >
              answers and hints
            </Link>{" "}
            and a growing library of{" "}
            <Link href="/clue" className="text-[#16a34a] hover:underline">
              crossword clue explanations
            </Link>
            .
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            Not affiliated with The New York Times
          </h2>
          <p>
            {SITE_NAME} is an independent project. We are not affiliated with,
            endorsed by, or connected to The New York Times Company or its Games
            products. &ldquo;Wordle,&rdquo; &ldquo;The Mini,&rdquo;
            &ldquo;Connections,&rdquo; and &ldquo;Spelling Bee&rdquo; are names
            used by their respective owners; we reference them only to describe
            the style of game you&apos;ll find here. If you want the original,
            you can{" "}
            <a
              href={AFFILIATE.nytGames}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-[#16a34a] hover:underline"
            >
              subscribe to NYT Games
            </a>
            .
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">Get in touch</h2>
          <p>
            Found a bug, have a puzzle idea, or spotted a wrong answer? Email us
            at{" "}
            <a
              href="mailto:hello@funzzle.com"
              className="text-[#16a34a] hover:underline"
            >
              hello@funzzle.com
            </a>
            . We read everything and fix issues quickly.
          </p>
          <p>
            See also our{" "}
            <Link href="/privacy" className="text-[#16a34a] hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="text-[#16a34a] hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </div>

        <AdSlot slot="in-content" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
