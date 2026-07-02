import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import AffiliateLink from "@/components/AffiliateLink";
import AffiliateCTA from "@/components/AffiliateCTA";
import { pageMetadata, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo";
import { getPost } from "@/lib/blog";
import { formatLongDate } from "@/lib/dates";
import { AFFILIATE, NYT_GAMES_PRICE } from "@/lib/site";

const SLUG = "is-nyt-games-worth-it";
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
            The New York Times Games app has become the default home for daily
            puzzles — Wordle, the Mini and full Crossword, Connections, Spelling
            Bee, and more. But in 2026 almost all of it sits behind a
            subscription. So the honest question is: is NYT Games actually worth
            paying for, or can you get the same daily fix for free?
          </p>
          <p>
            Let&apos;s start with price. A standalone NYT Games subscription
            runs about {NYT_GAMES_PRICE} per month (often cheaper on an annual
            plan, and sometimes bundled with News or Cooking). For a few dollars
            a month you unlock the full Crossword archive going back decades, the
            complete Spelling Bee with Bee-atrice hints, the Connections archive,
            and stat tracking with streaks across every game.
          </p>
          <p>
            What you are really paying for is <em>depth</em>: the enormous
            back-catalog, polished apps, and airtight streak tracking. If you are
            a serious cruciverbalist who solves the full daily Crossword and
            wants every historical puzzle, that archive alone can justify the
            cost. The editorial quality of the flagship Crossword is genuinely
            excellent, and Spelling Bee&apos;s word list is hard to replicate.
          </p>

          <AdSlot slot="rectangle" className="my-8" />

          <h2 className="text-xl font-bold text-[#111827]">The pros</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Full crossword archive — thousands of past puzzles.</li>
            <li>Cross-device streaks and detailed solve stats.</li>
            <li>Complete Spelling Bee and Connections archives.</li>
            <li>Polished, ad-free native apps.</li>
          </ul>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">The cons</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              It is a recurring cost for what many people treat as a five-minute
              daily habit.
            </li>
            <li>
              Wordle and the Mini — the two games most people actually play — are
              simple formats you can get free elsewhere.
            </li>
            <li>Yet another subscription to manage and remember to cancel.</li>
          </ul>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            Who should pay — and who shouldn&apos;t
          </h2>
          <p>
            If you solve the full daily Crossword, care about your streak
            history, or love a complete Spelling Bee, the subscription is a fair
            deal and probably worth it. If you mostly play Wordle and the Mini,
            or you just want a casual daily puzzle without a recurring charge,
            you almost certainly do not need to pay.
          </p>
          <p>
            That is exactly why Funzzle exists. You can play a free{" "}
            <Link href="/play/wordle" className="text-[#16a34a] hover:underline">
              unlimited Wordle
            </Link>
            , a daily{" "}
            <Link href="/play/mini" className="text-[#16a34a] hover:underline">
              Mini Crossword
            </Link>
            , and{" "}
            <Link
              href="/play/connections"
              className="text-[#16a34a] hover:underline"
            >
              Connections
            </Link>{" "}
            here with no paywall and no account. If your habit is a quick daily
            solve, the free route covers it completely — see our{" "}
            <Link
              href="/free-nyt-games-alternative"
              className="text-[#16a34a] hover:underline"
            >
              free NYT Games alternative
            </Link>{" "}
            page for the full lineup.
          </p>
          <p>
            The verdict: NYT Games is worth it for archive-hungry power solvers,
            and skippable for everyone else. Try the free version of your daily
            habit first — if you find yourself craving the deep archive, you can
            always{" "}
            <AffiliateLink href={AFFILIATE.nytGames}>
              try NYT Games free for a few days
            </AffiliateLink>{" "}
            and decide from there.
          </p>
        </article>

        <AffiliateCTA />
        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
