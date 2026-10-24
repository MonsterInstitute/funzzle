import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import AdSlot from "@/components/ads/AdSlot";
import DailySetHero, { type DailyCardInfo } from "@/components/home/DailySetHero";
import GameGrid from "@/components/home/GameGrid";
import ProfileSection from "@/components/home/ProfileSection";
import StudioBand from "@/components/home/StudioBand";
import HintLadder from "@/components/kit/HintLadder";
import {
  getAnswer,
  type ConnectionsAnswerData,
  type CrosswordAnswerData,
  type WordleAnswerData,
} from "@/lib/getAnswers";
import { DIFFICULTY_LABEL, sudokuDifficultyFor } from "@/lib/games/dailySchedule";
import { connectionsHints, miniAnswer, miniHints, wordleHints } from "@/lib/nytHints";
import { todayISO } from "@/lib/dates";
import { organizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";
import QandA from "@/components/seo/QandA";
import { HOME_QA } from "@/lib/aeo";
import { SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Funzzle — The Daily Puzzle Playground",
  description: SITE_DESCRIPTION,
  path: "/",
  keywords: ["daily puzzles", "free sudoku", "free solitaire", "daily word game", "mini crossword", "free puzzle games"],
});

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

export default async function HomePage() {
  const today = todayISO();
  const [wordle, connections, mini] = await Promise.all([
    getAnswer<WordleAnswerData>(today, "wordle"),
    getAnswer<ConnectionsAnswerData>(today, "connections"),
    getAnswer<CrosswordAnswerData>(today, "nyt-mini"),
  ]);

  const day = new Date(`${today}T00:00:00Z`);
  const dateLabel = day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).replace(",", " ·");
  const shortDate = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const difficulty = DIFFICULTY_LABEL[sudokuDifficultyFor(today)];

  const cards: DailyCardInfo[] = [
    { slug: "sudoku", name: "Daily Sudoku", intro: `${difficulty} · one grid for everyone today, with a coach` },
    { slug: "solitaire", name: "Daily Solitaire", intro: "Klondike, draw 1 · today’s deal is verified winnable" },
    { slug: "word", name: "Daily Word", intro: "Six guesses, one five-letter word" },
    { slug: "mini-crossword", name: "Mini Crossword", intro: "Five by five. About a minute" },
  ];

  const answers = [
    wordle && {
      title: "NYT Wordle",
      hints: wordleHints(wordle.answer_data),
      answer: <strong className="font-mono tracking-[0.2em]">{wordle.answer_data.answer.toUpperCase()}</strong>,
      href: "/wordle-answer/today",
    },
    connections && connections.answer_data.groups?.length >= 4 && {
      title: "NYT Connections",
      hints: connectionsHints(connections.answer_data),
      answer: (
        <ul className="m-0 list-none space-y-1 p-0">
          {[...connections.answer_data.groups].sort((a, b) => a.level - b.level).map((g) => (
            <li key={g.title}>
              <strong>{g.title}:</strong> {g.words.join(", ")}
            </li>
          ))}
        </ul>
      ),
      href: `/connections-answers/${today}`,
    },
    mini && mini.answer_data.across?.length > 0 && {
      title: "NYT Mini Crossword",
      hints: miniHints(mini.answer_data),
      answer: miniAnswer(mini.answer_data),
      href: `/nyt-crossword-answers/${today}`,
    },
  ].filter(Boolean) as { title: string; hints: string[]; answer: React.ReactNode; href: string }[];

  return (
    <div data-kit className="flex min-h-full flex-col">
      <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
      <Header />
      <main className="flex-1">
        <DailySetHero dateLabel={dateLabel} cards={cards} />
        <StudioBand />
        <GameGrid />
        {/* Below the fold only: never in the hero or beside a game. */}
        <AdSlot slot="rectangle" className="mx-auto mb-12 px-4" />

        <section id="answers" className="scroll-mt-4 border-y border-line bg-soft">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-7 px-4 py-16 sm:px-8">
            <div className="flex max-w-[720px] flex-col gap-2">
              <h2 className="m-0 font-display text-[34px] font-extrabold tracking-[-0.03em] sm:text-[42px]">Stuck on today’s NYT puzzles?</h2>
              <p className="m-0 text-[17px] leading-[1.55] text-muted">Hints first, answer only when you ask. Nothing is spoiled by scrolling.</p>
            </div>
            {answers.length ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
                {answers.map((a) => (
                  <HintLadder key={a.title} title={a.title} tag={shortDate} hints={a.hints} answer={a.answer} moreHref={a.href} />
                ))}
              </div>
            ) : (
              <p className="m-0 text-muted">Today’s hints go up just after midnight UTC.</p>
            )}
            <p className="m-0 text-[13px] text-muted-2">Funzzle is independent and not affiliated with The New York Times.</p>
          </div>
        </section>

        <AdSlot slot="rectangle" className="mx-auto my-12 px-4" />
        <ProfileSection />

        <div className="mx-auto max-w-[880px] px-4 pb-16 sm:px-8">
          <QandA items={HOME_QA} title="Questions about Funzzle" className="[&_h2]:font-display [&_h2]:text-[28px] [&_h2]:font-extrabold" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
