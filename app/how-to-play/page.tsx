import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import QandA from "@/components/seo/QandA";
import { HOW_TO_QA } from "@/lib/aeo";

export const metadata: Metadata = pageMetadata({
  title: "How to Play — Rules, Strategies & Tips for Every Game",
  description:
    "Complete how-to-play guide for Funzzle's free games: Mini Crossword, Word, Groups, Spelling Hive, Word Hunt, Letter Box, and Word · Quad, Geo and Math. Rules, strategies, and tips.",
  path: "/how-to-play",
});

interface Guide {
  title: string;
  href: string;
  how: string;
  strategy: string[];
}

const GUIDES: Guide[] = [
  {
    title: "Mini Crossword",
    href: "/play/mini",
    how: "The Mini is a compact 5×5 crossword. Tap a square to select it, read the highlighted clue, and type your answer; the cursor auto-advances across or down. Fill every white square correctly to finish. Because the grid is so small, each letter belongs to both an across and a down answer.",
    strategy: [
      "Start with the short three-letter clues and any fill-in-the-blanks — they're the fastest points.",
      "Solve outward from your most confident answer; one entry gives you crossing letters for several others.",
      "Use the Check button to confirm progress, and Reveal only when you're truly stuck.",
    ],
  },
  {
    title: "Funzzle Word",
    href: "/play/word",
    how: "You have six guesses to find a hidden five-letter word. After each guess, tiles turn green (right letter, right spot), yellow (right letter, wrong spot), or gray (not in the word).",
    strategy: [
      "Open with a vowel-rich word like CRANE, SLATE, or AUDIO to map the board quickly.",
      "Spend your second guess on brand-new letters rather than re-testing confirmed ones.",
      "Watch for repeated letters — words like CHESS trip up solvers who assume five distinct letters.",
    ],
  },
  {
    title: "Groups",
    href: "/play/groups",
    how: "Sixteen words hide four groups of four. Select four words you think share a category and submit. You get four mistakes before the game ends; solved groups lock in, color-coded from level 1 (easiest) to level 4 (trickiest).",
    strategy: [
      "Look for the trickiest group first — the obvious grouping is often a trap with an overlapping word.",
      "If you're one away, swap a single word rather than rebuilding the whole guess.",
      "Level 4 is usually wordplay (hidden words, ___ blanks), so save it for last.",
    ],
  },
  {
    title: "Spelling Hive",
    href: "/play/spelling-hive",
    how: "Build words of four or more letters using the seven letters shown, and every word must include the center letter. Letters can repeat. Using all seven letters in one word is a pangram and scores bonus points. Climb the ranks from Beginner to Genius.",
    strategy: [
      "Always test the center letter with common prefixes and suffixes (-ING, -ED, RE-, UN-).",
      "Hunt for the pangram early — it's worth a big bonus and often reveals other words.",
      "Shuffle the outer letters when you're stuck; a new arrangement sparks new words.",
    ],
  },
  {
    title: "Word Hunt",
    href: "/play/word-hunt",
    how: "Every word in the grid connects to a daily theme. Find all the theme words plus the spangram — a longer word that spans the board and captures the theme. Tap the first and last letter of a word to select it; theme words highlight blue and the spangram highlights yellow.",
    strategy: [
      "Read the theme first and brainstorm words that fit before touching the grid.",
      "Find the spangram early; it uses many letters and shrinks the search space.",
      "Use your three hints on the hardest words, not the ones you'd find anyway.",
    ],
  },
  {
    title: "Letter Box",
    href: "/play/letter-box",
    how: "Twelve letters sit around a square, three per side. Spell words of three or more letters, but you can never use two letters from the same side in a row. Each new word must begin with the previous word's last letter. Use all twelve letters to win.",
    strategy: [
      "Aim to use rare letters (J, Q, X, Z) early so they don't strand you at the end.",
      "Try to solve in as few words as possible — two-word solutions are the gold standard.",
      "End words on letters that begin many other words (A, E, R, S, T) to keep your options open.",
    ],
  },
  {
    title: "Funzzle Word · Quad",
    href: "/play/word/quad",
    how: "It's four Wordles at once. Each guess is applied to all four boards simultaneously, and you have nine guesses to solve all four five-letter words. The shared keyboard shows the best-known status of each letter across every board.",
    strategy: [
      "Burn your first two or three guesses on fixed, letter-diverse words to gather information on all four boards.",
      "Fully solve one board at a time once you have enough letters, rather than spreading guesses thin.",
      "Track which board each yellow belongs to — a letter can be green on one board and absent on another.",
    ],
  },
  {
    title: "Funzzle Word · Geo",
    href: "/play/word/geo",
    how: "Guess the mystery country from its silhouette in six tries. After each wrong guess you'll see the distance to the target, an arrow pointing toward it, and a proximity percentage.",
    strategy: [
      "Note the shape's size and orientation — coastlines and peninsulas are big giveaways.",
      "Use the distance and direction to triangulate: if you're 2,000 km northeast, guess a country southwest.",
      "A high proximity percentage means you're in the right neighborhood, so guess a bordering country next.",
    ],
  },
  {
    title: "Funzzle Word · Math",
    href: "/play/word/math",
    how: "Guess a hidden eight-character math equation in six tries — for example 3+5*2=13. Tiles turn green, purple, or gray for each digit and operator, just like Wordle. Your guess must be a valid equation, and standard order of operations applies (× and ÷ before + and −).",
    strategy: [
      "Open with a guess that uses a range of digits and at least two operators to test many characters at once.",
      "Remember the equals sign has a fixed-ish position — once you place it, the layout narrows fast.",
      "The right side is often a single number or a small sum, so use the left side to do the heavy lifting.",
    ],
  },
];

export default function HowToPlayPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "How to Play", path: "/how-to-play" },
        ])}
      />
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          How to Play Every Funzzle Game
        </h1>
        <p className="mt-3 leading-relaxed text-gray-700">
          Every Funzzle game is free and plays in your browser: pick a game
          below for its rules, a quick example and the strategies that help
          most. New puzzles arrive every day at midnight UTC.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2">
          {GUIDES.map((g) => (
            <a
              key={g.title}
              href={`#${g.href.split("/").pop()}`}
              className="rounded-full border border-[#e5e7eb] px-3 py-1 text-sm text-[#16a34a] hover:border-[#16a34a]"
            >
              {g.title}
            </a>
          ))}
        </nav>

        <AdSlot slot="in-content" className="my-8" />

        {GUIDES.map((g) => (
          <section key={g.title} id={g.href.split("/").pop()} className="mt-10">
            <h2 className="text-2xl font-bold text-[#111827]">{g.title}</h2>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              How to play
            </h3>
            <p className="mt-1 leading-relaxed text-gray-700">{g.how}</p>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Strategy &amp; tips
            </h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed text-gray-700">
              {g.strategy.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <p className="mt-3">
              <Link href={g.href} className="font-semibold text-[#16a34a] hover:underline">
                Play {g.title} free →
              </Link>
            </p>
          </section>
        ))}

        <AdSlot slot="in-content" className="mt-12" />
        <QandA items={HOW_TO_QA} className="text-[#111827]" />
      </main>

      <Footer />
    </>
  );
}
