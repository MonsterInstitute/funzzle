import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-xs uppercase tracking-wide text-gray-400">
          {formatLongDate(post.datePublished)}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          {post.title}
        </h1>

        <article className="prose prose-sm mt-6 text-gray-700">
          <p>
            The Mini Crossword is small, but shaving seconds off your solve is
            genuinely satisfying — and surprisingly learnable. The grid is only
            5×5, so a handful of habits can turn a two-minute solve into a
            thirty-second one. Here are the strategies that help the most, from
            first-glance tactics to the clue patterns worth memorizing.
          </p>

          <h2 className="text-xl font-bold text-[#111827]">
            Start where the points are cheapest
          </h2>
          <p>
            Always begin with the answer you&apos;re most sure of, and let it do
            the work. In a Mini, every across shares letters with several downs,
            so one confident entry immediately hands you starting letters for
            four or five other clues. Don&apos;t solve top-to-bottom in order —
            solve outward from your strongest foothold.
          </p>
          <p>
            Read all the short clues first. Three-letter answers are the backbone
            of the Mini, and they&apos;re usually the easiest to guess outright.
            Fill every gimme you can, then use those crossings to crack the
            longer, trickier entries.
          </p>

          <h2 className="text-xl font-bold text-[#111827]">
            Learn to read clue types
          </h2>
          <p>
            The Mini reuses a small vocabulary of crossword conventions. Learning
            to recognize the clue&apos;s <em>type</em> often tells you the shape
            of the answer before you know the answer itself.
          </p>
          <h3 className="text-lg font-bold text-[#111827]">Fill-in-the-blank</h3>
          <p>
            Clues like &ldquo;___ and cheese&rdquo; are the fastest points on the
            board. They&apos;re unambiguous and usually short — always scan for
            them first.
          </p>
          <h3 className="text-lg font-bold text-[#111827]">Abbreviation cues</h3>
          <p>
            If a clue contains an abbreviation or the word &ldquo;briefly,&rdquo;
            the answer is a short form (e.g., &ldquo;Hosp. areas&rdquo; → ERS).
            The clue and answer always match in formality.
          </p>
          <h3 className="text-lg font-bold text-[#111827]">Question marks</h3>
          <p>
            A trailing question mark signals wordplay or a pun, not a literal
            definition. Don&apos;t take these clues at face value.
          </p>
          <h3 className="text-lg font-bold text-[#111827]">Plurals and tense</h3>
          <p>
            If the clue is plural, the answer almost certainly ends in S — pencil
            that last letter in early. Likewise, a past-tense clue usually means
            an -ED ending.
          </p>

          <AdSlot slot="in-content" className="my-8" />

          <h2 className="text-xl font-bold text-[#111827]">
            A 60-second solving routine
          </h2>
          <p>
            Here&apos;s a repeatable routine that works on almost any Mini: (1)
            read every across clue quickly and fill only the ones you&apos;re
            certain of; (2) do the same for the downs; (3) return to the crossings
            of your filled squares, where you now have one or two letters to work
            with; (4) resolve any remaining square by trusting the crossing clue
            rather than guessing. Momentum matters — keep the pen moving and let
            wrong squares reveal themselves through their crossings.
          </p>

          <h2 className="text-xl font-bold text-[#111827]">
            Memorize the common short answers
          </h2>
          <p>
            Speed comes from repetition. Solving one Mini a day trains your eye to
            spot recurring answers — ERA, OREO, ARIA, ALOE, ETNA, ELI, EWE, and
            OBOE turn up constantly because their vowel-heavy letters interlock so
            well. The more of these you know cold, the fewer squares you have to
            actually think about. Our{" "}
            <Link href="/clue" className="text-[#16a34a] hover:underline">
              crossword clue library
            </Link>{" "}
            explains hundreds of these common entries in depth.
          </p>

          <h2 className="text-xl font-bold text-[#111827]">
            Review yesterday to speed up tomorrow
          </h2>
          <p>
            When a clue stumps you, don&apos;t just move on — learn it. Our daily{" "}
            <Link
              href="/nyt-crossword-answers/2026-07-01"
              className="text-[#16a34a] hover:underline"
            >
              answer archive
            </Link>{" "}
            walks through every clue with a short explanation, and reviewing the
            entries you missed is the fastest way to build the pattern-recognition
            that makes future solves quicker.
          </p>

          <h2 className="text-xl font-bold text-[#111827]">The one-minute mindset</h2>
          <p>
            Finally, don&apos;t overthink it. The Mini rewards momentum: guess
            quickly, trust your crossings, and keep moving. If a square is wrong,
            the crossing clue will tell you. Play a fresh Mini every day, warm up
            with a{" "}
            <Link href="/play/word" className="text-[#16a34a] hover:underline">
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

        <AdSlot slot="in-content" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
