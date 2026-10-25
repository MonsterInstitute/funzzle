import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DailyAnswerPage from "@/components/answers/DailyAnswerPage";
import { getAnswer, type QuordleAnswerData } from "@/lib/getAnswers";
import { quordleAnswerCopy } from "@/lib/aeo";
import { quordleHints } from "@/lib/nytHints";
import { pageMetadata } from "@/lib/seo";
import { FIRST_ANSWER_DATE, formatLongDate, isServedAnswerDate, recentAnswerDates } from "@/lib/dates";

type Params = { date: string };

// The real Quordle daily words, stored by the answers cron (lib/cron/answers.ts).
// Static once written; refreshed on demand (lib/revalidation.ts), not on a timer.
export const revalidate = false;

export function generateStaticParams() {
  return recentAnswerDates(30).map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { date } = await params;
  if (!isServedAnswerDate(date)) return { title: "Quordle Answers" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `Quordle Answers ${long} — Hints & All Four Words`,
    description: `Today's Quordle hints and answers for ${long}: graded hints for the daily Quordle, then all four words.`,
    path: `/quordle-answers/${date}`,
    keywords: [`quordle answers ${long}`, "quordle answers today", "quordle hints"],
  });
}

export default async function QuordleAnswersPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isServedAnswerDate(date)) notFound();
  const long = formatLongDate(date);
  const row = await getAnswer<QuordleAnswerData>(date, "quordle");
  const data = row?.answer_data;
  const copy = quordleAnswerCopy(long, data);

  return (
    <DailyAnswerPage
      game="quordle"
      label="Quordle"
      title={`Quordle Answers — ${long}`}
      basePath="/quordle-answers"
      date={date}
      firstDate={FIRST_ANSWER_DATE}
      summary={copy.summary}
      hints={data ? quordleHints(data) : null}
      hintsTitle="Quordle hints"
      answer={data && <strong>{data.words.join(", ")}</strong>}
      pendingText="Today's Quordle answers will be posted soon. Check back later!"
      source={
        data && (
          <>
            Daily Quordle #{data.number} (Merriam-Webster), boards top left, top right, bottom left, bottom right. The
            words are worked out exactly as the official game does, from its own word list.
          </>
        )
      }
      play={{ href: "/play/word/quad", label: "Play Word · Quad, free →" }}
      howTo={{
        title: "How to play Quordle",
        body: (
          <p className="mt-3">
            Quordle is four Wordles at once. Each guess is entered on all four boards, and the tiles turn green for the
            right letter in the right spot and yellow for a letter in the wrong spot. You have nine guesses to solve all
            four five-letter words, so pick early guesses that cover many common letters.
          </p>
        ),
      }}
      qa={copy.qa}
    />
  );
}
