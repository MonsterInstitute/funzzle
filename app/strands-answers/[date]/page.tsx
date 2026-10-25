import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DailyAnswerPage from "@/components/answers/DailyAnswerPage";
import { getAnswer, type StrandsAnswerData } from "@/lib/getAnswers";
import { strandsAnswerCopy } from "@/lib/aeo";
import { strandsHints } from "@/lib/nytHints";
import { pageMetadata } from "@/lib/seo";
import { FIRST_ANSWER_DATE, formatLongDate, isServedAnswerDate, recentAnswerDates } from "@/lib/dates";

type Params = { date: string };

// The real NYT Strands answers, stored by the answers cron (lib/cron/answers.ts).
// A day's answers never change once written; new rows are picked up through
// on-demand revalidation (lib/revalidation.ts), not a timer.
export const revalidate = false;

export function generateStaticParams() {
  return recentAnswerDates(30).map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { date } = await params;
  if (!isServedAnswerDate(date)) return { title: "Strands Answers" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `NYT Strands Answers ${long} — Hints & Spangram`,
    description: `Today's NYT Strands hints and answers for ${long}: the theme clue, graded hints, the spangram and every theme word.`,
    path: `/strands-answers/${date}`,
    keywords: [`strands answers ${long}`, "strands hint today", "strands spangram today"],
  });
}

export default async function StrandsAnswersPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isServedAnswerDate(date)) notFound();
  const long = formatLongDate(date);
  const row = await getAnswer<StrandsAnswerData>(date, "strands");
  const data = row?.answer_data;
  const copy = strandsAnswerCopy(long, data);

  return (
    <DailyAnswerPage
      game="strands"
      label="Strands"
      title={`NYT Strands Answers — ${long}`}
      basePath="/strands-answers"
      date={date}
      firstDate={FIRST_ANSWER_DATE}
      summary={copy.summary}
      hints={data ? strandsHints(data) : null}
      hintsTitle="Strands hints"
      answer={
        data && (
          <>
            <strong>Spangram:</strong> {data.spangram}
            <br />
            <strong>Theme words:</strong> {data.words.join(", ")}
          </>
        )
      }
      pendingText="Today's Strands answers will be posted soon. Check back later!"
      source={
        data && (
          <>
            NYT Strands{data.puzzle_id ? ` #${data.puzzle_id}` : ""}, theme “{data.clue}”
            {data.constructors ? `, by ${data.constructors}` : ""}
            {data.editor ? `, edited by ${data.editor}` : ""}. Answers from The New York Times&apos; own puzzle data.
          </>
        )
      }
      play={{ href: "/play/word-hunt", label: "Play Word Hunt, free →" }}
      howTo={{
        title: "How to play Strands",
        body: (
          <p className="mt-3">
            Strands hides a set of theme words in a 6×8 grid of letters. Words are traced through adjacent letters in
            any direction, every letter is used exactly once, and the spangram — the word or phrase that names the
            theme — runs between two opposite sides of the board. Finding three non-theme words earns a hint.
          </p>
        ),
      }}
      qa={copy.qa}
    />
  );
}
