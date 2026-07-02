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
import { AFFILIATE } from "@/lib/site";

const SLUG = "best-free-crossword-apps";
const post = getPost(SLUG)!;

export const metadata: Metadata = pageMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${SLUG}`,
  ogType: "article",
});

const APPS = [
  {
    name: "Funzzle",
    blurb:
      "Our pick for #1: a free Mini Crossword, unlimited Wordle, and daily Connections with no paywall and no account. Answers and explanations posted daily.",
    internal: true,
  },
  {
    name: "The Guardian Quick Crossword",
    blurb:
      "A long-running free daily quick crossword with a friendly difficulty curve and a clean web player.",
  },
  {
    name: "USA Today Crossword",
    blurb:
      "A free daily themed crossword that is approachable for beginners, playable in the browser with ads.",
  },
  {
    name: "Crossword Nexus",
    blurb:
      "A free open solver and puzzle host popular with indie constructors — great for discovering new grids.",
  },
  {
    name: "Los Angeles Times Crossword",
    blurb:
      "The classic LA Times daily is free to play online and steps up nicely in difficulty across the week.",
  },
  {
    name: "Puzzmo",
    blurb:
      "A modern puzzle site with a generous free tier and a fresh take on the daily crossword format.",
  },
  {
    name: "Printable crossword books",
    blurb:
      "Sometimes paper wins. A cheap puzzle book gives you hundreds of grids with zero screens or ads.",
    affiliate: true,
  },
];

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
            Crosswords are having a moment, but a lot of the best-known ones now
            hide behind subscriptions. The good news: plenty of genuinely free
            options remain. We tested the most popular crossword apps and sites
            of 2026 and ranked the seven best that you can play without a
            paywall.
          </p>
          <p>
            Our criteria were simple. Is it actually free — not a three-puzzle
            trial that expires? Is there a fresh puzzle every day? Does it play
            well on a phone browser without nagging you to sign up? And is the
            difficulty reasonable for everyday solvers, not just experts?
          </p>
          <p>
            One theme stood out: the sites that stay free tend to be ad-supported
            rather than subscription-gated, and that trade-off is well worth it
            for a five-minute daily habit. Here is the ranked list.
          </p>

          <AdSlot slot="rectangle" className="my-8" />

          <ol className="mt-2 space-y-5 pl-0">
            {APPS.map((app, i) => (
              <li key={app.name} className="list-none">
                <h2 className="text-lg font-bold text-[#111827]">
                  {i + 1}. {app.name}
                </h2>
                <p className="mt-1">{app.blurb}</p>
                {app.internal && (
                  <p className="mt-1">
                    Play now:{" "}
                    <Link
                      href="/play/mini"
                      className="text-[#16a34a] hover:underline"
                    >
                      Mini Crossword
                    </Link>
                    ,{" "}
                    <Link
                      href="/play/wordle"
                      className="text-[#16a34a] hover:underline"
                    >
                      Wordle
                    </Link>
                    , and{" "}
                    <Link
                      href="/play/connections"
                      className="text-[#16a34a] hover:underline"
                    >
                      Connections
                    </Link>
                    .
                  </p>
                )}
                {app.affiliate && (
                  <p className="mt-1">
                    <AffiliateLink href={AFFILIATE.amazonPuzzleBooks}>
                      Browse crossword puzzle books on Amazon
                    </AffiliateLink>
                  </p>
                )}
              </li>
            ))}
          </ol>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            Which should you choose?
          </h2>
          <p>
            If you want everything in one free place, start with Funzzle — it
            covers the three games most people play daily and posts{" "}
            <Link
              href="/wordle-answer/today"
              className="text-[#16a34a] hover:underline"
            >
              today&apos;s answers
            </Link>{" "}
            if you get stuck. Rotate in the Guardian or LA Times when you want a
            bigger grid, and keep a{" "}
            <AffiliateLink href={AFFILIATE.amazonPuzzleBooks}>
              puzzle book
            </AffiliateLink>{" "}
            around for screen-free solving. However you mix them, you never have
            to pay for a daily crossword in 2026.
          </p>
          <p>
            Want the deeper archive and streak tracking of the original? See our
            honest take in{" "}
            <Link
              href="/blog/is-nyt-games-worth-it"
              className="text-[#16a34a] hover:underline"
            >
              Is NYT Games Worth It in 2026?
            </Link>
          </p>
        </article>

        <AffiliateCTA />
        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
