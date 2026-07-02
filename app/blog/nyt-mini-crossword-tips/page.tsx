import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo";
import { getPost } from "@/lib/blog";
import { formatLongDate } from "@/lib/dates";

const SLUG = "nyt-mini-crossword-tips";
const post = getPost(SLUG)!;

export const metadata: Metadata = pageMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${SLUG}`,
  ogType: "article",
});

export default function Post() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${SLUG}` },
          ]),
          articleJsonLd({
            title: post.title,
            description: post.description,
            path: `/blog/${SLUG}`,
            datePublished: post.datePublished,
          }),
        ]}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-xs uppercase tracking-wide text-gray-400">
          {formatLongDate(post.datePublished)}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          {post.title}
        </h1>

        <article className="prose prose-sm mt-6 max-w-none text-gray-700">
          <p>
            The Mini Crossword is small, but shaving seconds off your solve is
            genuinely satisfying — and surprisingly learnable. The grid is only
            5×5, so a handful of habits can turn a two-minute solve into a
            thirty-second one. Here are the tips that help the most.
          </p>
          <p>
            First, always start with the answer you are most sure of, and let it
            do the work. In a Mini, every across shares letters with several
            downs, so one confident entry immediately gives you starting letters
            for four or five other clues. Do not solve top-to-bottom in order —
            solve outward from your strongest foothold.
          </p>
          <p>
            Second, read all the short clues first. Three-letter answers are the
            backbone of the Mini, and they are usually the easiest to guess
            outright. Fill every gimme you can, then use those crossings to crack
            the longer, trickier entries.
          </p>

          <AdSlot slot="rectangle" className="my-8" />

          <h2 className="text-xl font-bold text-[#111827]">
            Learn the common clue patterns
          </h2>
          <p>
            The Mini reuses a small vocabulary of crossword-friendly words —
            short entries packed with vowels and common letters. Learn to
            recognize these patterns:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Fill-in-the-blank</strong> (&ldquo;___ and cheese&rdquo;)
              clues are often the fastest points on the board.
            </li>
            <li>
              <strong>Abbreviation cues</strong> — a clue with an abbreviation or
              &ldquo;briefly&rdquo; wants a short-form answer.
            </li>
            <li>
              <strong>Question marks</strong> signal wordplay or a pun, not a
              literal definition.
            </li>
            <li>
              <strong>Plurals and tenses</strong> — if the clue is plural, the
              answer almost certainly ends in S.
            </li>
          </ul>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            Build a daily routine
          </h2>
          <p>
            Speed comes from repetition. Solving one Mini a day trains your eye
            to spot recurring answers like ERA, OREO, ARIA, and ALOE almost
            instantly. Practice on our free{" "}
            <Link href="/play/mini" className="text-[#16a34a] hover:underline">
              Mini Crossword
            </Link>{" "}
            — it tracks your time so you can watch yourself improve, and you can
            replay to beat your record.
          </p>
          <p>
            When a clue stumps you, do not just move on — learn it. Our{" "}
            <Link href="/clue" className="text-[#16a34a] hover:underline">
              crossword clue answers
            </Link>{" "}
            pages explain individual clues in depth, and the daily{" "}
            <Link
              href="/nyt-crossword-answers/2026-07-01"
              className="text-[#16a34a] hover:underline"
            >
              answer archive
            </Link>{" "}
            walks through every clue with a short explanation. Reviewing yesterday
            is the fastest way to speed up tomorrow.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            The one-minute mindset
          </h2>
          <p>
            Finally, do not overthink it. The Mini rewards momentum: guess
            quickly, trust your crossings, and keep the pen moving. If a square
            is wrong, the crossing clue will tell you. Play a fresh Mini every
            day, warm up with a{" "}
            <Link
              href="/play/wordle"
              className="text-[#16a34a] hover:underline"
            >
              round of Wordle
            </Link>
            , and watch your times fall week over week.
          </p>
        </article>

        <div className="mt-10 text-center">
          <Link
            href="/play/mini"
            className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]"
          >
            Play the free Mini Crossword →
          </Link>
        </div>

        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
