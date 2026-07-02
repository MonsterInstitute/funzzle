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

interface App {
  name: string;
  desc: string;
  pros: string[];
  cons: string[];
  internal?: boolean;
  affiliate?: boolean;
}

const APPS: App[] = [
  {
    name: "Funzzle",
    desc: "Our pick for #1. Funzzle bundles a free Mini Crossword, unlimited Wordle, Connections, Spelling Bee, Strands, Letter Boxed, Quordle, Worldle, and Nerdle into one fast, mobile-friendly site — with no paywall and no account. It also posts daily answers and hints and a large library of clue explanations.",
    pros: ["Nine games in one place, all free", "No login or subscription", "Daily answers + how-to guides"],
    cons: ["Ad-supported", "No cross-device streak sync yet"],
    internal: true,
  },
  {
    name: "The Guardian Quick Crossword",
    desc: "A long-running free daily quick crossword with a friendly difficulty curve and a clean browser player. The Guardian also offers a cryptic for more advanced solvers.",
    pros: ["Genuinely free daily puzzle", "Approachable clues", "Trusted publisher"],
    cons: ["UK-centric references", "No themed variety games"],
  },
  {
    name: "USA Today Crossword",
    desc: "A free daily themed crossword that's especially welcoming to beginners, playable in the browser. Themes rotate daily and the clue difficulty stays gentle.",
    pros: ["Beginner-friendly", "Daily themes", "Free in-browser play"],
    cons: ["Heavy ads", "Interface feels dated"],
  },
  {
    name: "Los Angeles Times Crossword",
    desc: "The classic LA Times daily is free to play online and steps up nicely in difficulty across the week, from an easy Monday to a tougher Saturday — a great way to build solving stamina.",
    pros: ["Difficulty ramps across the week", "Strong construction quality", "Free online"],
    cons: ["Ad-supported", "No mobile app parity"],
  },
  {
    name: "Puzzmo",
    desc: "A modern puzzle site with a generous free tier and a fresh, design-forward take on the daily crossword plus original games. Great if you want something that feels new.",
    pros: ["Beautiful, modern design", "Original games beyond crosswords", "Generous free tier"],
    cons: ["Some features need an account", "Smaller archive"],
  },
  {
    name: "Crossword Nexus / open solvers",
    desc: "A free, open solver and puzzle host popular with indie constructors. It's the place to discover new grids from the wider crossword community and play .puz files.",
    pros: ["Indie and community puzzles", "Open file support (.puz)", "No paywall"],
    cons: ["Less polished", "Variable puzzle quality"],
  },
  {
    name: "Printable puzzle books",
    desc: "Sometimes paper wins. A cheap puzzle book gives you hundreds of grids with zero screens, ads, or batteries — ideal for travel or screen-free evenings.",
    pros: ["No screens or ads", "Hundreds of puzzles for a few dollars", "Great offline"],
    cons: ["Not daily/fresh", "No autocheck or hints"],
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
            options remain. We tested the most popular crossword apps and sites of
            2026 and ranked the seven best you can play without a paywall, with
            honest pros and cons for each.
          </p>

          <h2 className="text-xl font-bold text-[#111827]">How we judged them</h2>
          <p>
            Our criteria were simple. Is it actually free — not a three-puzzle
            trial that expires? Is there a fresh puzzle every day? Does it play
            well on a phone browser without nagging you to sign up? And is the
            difficulty reasonable for everyday solvers, not just experts? One
            theme stood out: the sites that stay free tend to be ad-supported
            rather than subscription-gated, and for a five-minute daily habit
            that trade-off is well worth it.
          </p>

          <AdSlot slot="rectangle" className="my-8" />

          <h2 className="text-xl font-bold text-[#111827]">The 7 best free crossword apps</h2>
          {APPS.map((app, i) => (
            <div key={app.name} className="mt-6">
              <h3 className="text-lg font-bold text-[#111827]">
                {i + 1}. {app.name}
              </h3>
              <p className="mt-1">{app.desc}</p>
              <p className="mt-2 text-sm">
                <strong className="text-[#16a34a]">Pros:</strong> {app.pros.join("; ")}.
              </p>
              <p className="text-sm">
                <strong className="text-gray-500">Cons:</strong> {app.cons.join("; ")}.
              </p>
              {app.internal && (
                <p className="mt-1 text-sm">
                  Play now:{" "}
                  <Link href="/play/mini" className="text-[#16a34a] hover:underline">Mini</Link>,{" "}
                  <Link href="/play/wordle" className="text-[#16a34a] hover:underline">Wordle</Link>,{" "}
                  <Link href="/play/connections" className="text-[#16a34a] hover:underline">Connections</Link>.
                </p>
              )}
              {app.affiliate && (
                <p className="mt-1 text-sm">
                  <AffiliateLink href={AFFILIATE.amazonPuzzleBooks}>
                    Browse crossword puzzle books on Amazon
                  </AffiliateLink>
                </p>
              )}
            </div>
          ))}

          <h2 className="mt-8 text-xl font-bold text-[#111827]">
            Which should you choose?
          </h2>
          <p>
            If you want everything in one free place, start with Funzzle — it
            covers the games most people play daily and posts{" "}
            <Link href="/wordle-answer/today" className="text-[#16a34a] hover:underline">
              today&apos;s answers
            </Link>{" "}
            when you get stuck. Rotate in the Guardian or LA Times when you want a
            bigger grid, try Puzzmo for something fresh, and keep a{" "}
            <AffiliateLink href={AFFILIATE.amazonPuzzleBooks}>puzzle book</AffiliateLink>{" "}
            around for screen-free solving. However you mix them, you never have
            to pay for a daily crossword in 2026. Still curious whether the
            original is worth it? Read our honest take in{" "}
            <Link href="/blog/is-nyt-games-worth-it" className="text-[#16a34a] hover:underline">
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
