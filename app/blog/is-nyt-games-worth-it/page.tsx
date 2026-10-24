import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-xs uppercase tracking-wide text-gray-400">
          {formatLongDate(post.datePublished)}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          {post.title}
        </h1>

        <article className="prose prose-sm mt-6 text-gray-700">
          <p>
            The New York Times Games app is the default home for daily puzzles —
            Wordle, the Mini and full Crossword, Connections, Spelling Bee,
            Tiles, Vertex, and Letter Boxed. But in 2026 almost all of it sits
            behind a subscription. So the honest question is: is NYT Games worth
            paying for, or can you get the same daily fix for free? Here&apos;s a
            detailed, up-to-date breakdown.
          </p>

          <h2 className="text-xl font-bold text-[#111827]">
            How much does NYT Games cost in 2026?
          </h2>
          <p>
            A standalone NYT Games subscription runs about {NYT_GAMES_PRICE} per
            month, or roughly $40 per year when billed annually — usually the
            better value if you play daily. Games is also included in the more
            expensive &ldquo;All Access&rdquo; bundle alongside News, Cooking,
            Wirecutter, and The Athletic. New subscribers are often offered an
            introductory rate for the first year that then renews at the standard
            price, so check what you&apos;ll actually pay on renewal.
          </p>
          <p>
            What&apos;s free without a subscription? Only the daily Wordle and a
            single daily Mini Crossword. Everything else — the full daily
            Crossword, the Crossword archive, the complete Spelling Bee, the
            Connections archive, and stat tracking — requires a paid plan.
          </p>

          <h2 className="text-xl font-bold text-[#111827]">
            NYT Games vs. Funzzle: feature comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-left">
                  <th className="py-2 pr-4 font-semibold">Feature</th>
                  <th className="py-2 pr-4 font-semibold">NYT Games</th>
                  <th className="py-2 font-semibold">Funzzle (free)</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[
                  ["Price", `~${NYT_GAMES_PRICE}/mo`, "Free (ad-supported)"],
                  ["Account required", "Yes", "No"],
                  ["Daily Wordle", "Free", "Free + unlimited replays"],
                  ["Daily Mini Crossword", "Free", "Free"],
                  ["Full daily Crossword", "Paid", "Not offered"],
                  ["Crossword archive", "Paid (decades)", "30-day answers, free"],
                  ["Connections", "Paid archive", "Free daily"],
                  ["Spelling Bee", "Paid (full)", "Free daily"],
                  ["Streak / stat tracking", "Yes", "Local only"],
                  ["Ads", "None", "Yes"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b border-[#f3f4f6]">
                    <td className="py-2 pr-4 font-medium text-[#111827]">{row[0]}</td>
                    <td className="py-2 pr-4">{row[1]}</td>
                    <td className="py-2">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdSlot slot="in-content" className="my-8" />

          <h2 className="text-xl font-bold text-[#111827]">What you&apos;re paying for</h2>
          <p>
            Open the NYT Games app and the value proposition is clear within a few
            screens. The home screen stacks each day&apos;s puzzles as cards with
            your current streak badges; tapping the Crossword opens a polished,
            responsive grid with autocheck, a reveal menu, and a timer. The
            archive screen is the real differentiator — a scrolling calendar
            stretching back years, every past Crossword and Spelling Bee a tap
            away. The stats screen shows win percentage, streak history, and
            guess distributions across devices.
          </p>

          <h3 className="text-lg font-bold text-[#111827]">The pros</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>A massive Crossword archive — thousands of past puzzles.</li>
            <li>Cross-device streaks and detailed solve statistics.</li>
            <li>The complete Spelling Bee, with the full word list and hints.</li>
            <li>Polished, ad-free native apps and a strong editorial voice.</li>
          </ul>

          <h3 className="mt-4 text-lg font-bold text-[#111827]">The cons</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>A recurring cost for what many treat as a five-minute daily habit.</li>
            <li>The two games most people play — Wordle and the Mini — are free formats you can get elsewhere.</li>
            <li>Another subscription to track, and an intro price that renews higher.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#111827]">
            Who should pay — and who shouldn&apos;t
          </h2>
          <p>
            If you solve the full daily Crossword, care about your streak history,
            or love a complete Spelling Bee, the subscription is a fair deal and
            probably worth it — the archive alone can justify the cost for a
            dedicated cruciverbalist. If you mostly play Wordle and the Mini, or
            you just want a casual daily puzzle without a recurring charge, you
            almost certainly do not need to pay.
          </p>
          <p>
            That&apos;s exactly why Funzzle exists. You can play a free{" "}
            <Link href="/play/word" className="text-[#16a34a] hover:underline">Funzzle Word</Link>,
            a daily{" "}
            <Link href="/play/mini" className="text-[#16a34a] hover:underline">Mini Crossword</Link>,{" "}
            <Link href="/play/groups" className="text-[#16a34a] hover:underline">Groups</Link>,{" "}
            <Link href="/play/spelling-hive" className="text-[#16a34a] hover:underline">Spelling Hive</Link>,
            and more here with no paywall and no account. See the full free lineup on our{" "}
            <Link href="/free-nyt-games-alternative" className="text-[#16a34a] hover:underline">
              free NYT Games alternative
            </Link>{" "}
            page, or read our{" "}
            <Link href="/blog/best-free-crossword-apps" className="text-[#16a34a] hover:underline">
              roundup of the best free crossword apps
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold text-[#111827]">The verdict</h2>
          <p>
            NYT Games is worth it for archive-hungry power solvers and streak
            keepers, and skippable for everyone else. Our advice: play the free
            version of your daily habit first. If you find yourself craving the
            deep archive and cross-device stats, you can always{" "}
            <AffiliateLink href={AFFILIATE.nytGames}>
              try NYT Games free for a few days
            </AffiliateLink>{" "}
            and decide from there.
          </p>
        </article>

        <AffiliateCTA />
        <AdSlot slot="in-content" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
