import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DailyAnswerPage from "@/components/answers/DailyAnswerPage";
import { getAnswer, type LetterBoxedAnswerData } from "@/lib/getAnswers";
import { letterBoxedAnswerCopy } from "@/lib/aeo";
import { letterBoxedHints } from "@/lib/nytHints";
import { pageMetadata } from "@/lib/seo";
import { FIRST_LETTER_BOXED_DATE, formatLongDate, isServedAnswerDate, recentAnswerDates } from "@/lib/dates";

type Params = { date: string };

// NYT's own Letter Boxed solution, stored by the answers cron
// (lib/cron/answers.ts) from the puzzle page. Static once written; refreshed
// on demand (lib/revalidation.ts), not on a timer.
export const revalidate = false;

export function generateStaticParams() {
  return recentAnswerDates(30, FIRST_LETTER_BOXED_DATE).map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { date } = await params;
  if (!isServedAnswerDate(date, FIRST_LETTER_BOXED_DATE)) return { title: "Letter Boxed Answers" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `NYT Letter Boxed Answers ${long} — Hints & Solution`,
    description: `Today's NYT Letter Boxed hints and NYT's own solution for ${long}: the four sides, graded hints, then the word chain.`,
    path: `/letter-boxed-answers/${date}`,
    keywords: [`letter boxed answer ${long}`, "letter boxed solution today", "letter boxed hint"],
  });
}

export default async function LetterBoxedAnswersPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isServedAnswerDate(date, FIRST_LETTER_BOXED_DATE)) notFound();
  const long = formatLongDate(date);
  const row = await getAnswer<LetterBoxedAnswerData>(date, "letter-boxed");
  const data = row?.answer_data;
  const copy = letterBoxedAnswerCopy(long, data);

  return (
    <DailyAnswerPage
      game="letter-boxed"
      label="Letter Boxed"
      title={`NYT Letter Boxed Answers — ${long}`}
      basePath="/letter-boxed-answers"
      date={date}
      firstDate={FIRST_LETTER_BOXED_DATE}
      summary={copy.summary}
      hints={data ? letterBoxedHints(data) : null}
      hintsTitle="Letter Boxed hints"
      answer={data && <strong>{data.solution.join(" → ")}</strong>}
      pendingText="Today's Letter Boxed solution will be posted once the day's box is live (3 a.m. Eastern). Check back later!"
      source={
        data && (
          <>
            NYT Letter Boxed{data.puzzle_id ? ` #${data.puzzle_id}` : ""}
            {data.editor ? `, edited by ${data.editor}` : ""}. The solution is NYT&apos;s own, from its puzzle page;
            any chain that uses all twelve letters also counts.
          </>
        )
      }
      play={{ href: "/play/letter-box", label: "Play Letter Box, free →" }}
      howTo={{
        title: "How to play Letter Boxed",
        body: (
          <p className="mt-3">
            Twelve letters sit three to a side of a square. Spell words by connecting letters, never using two letters
            from the same side in a row. Each word must start with the last letter of the word before it, and the goal
            is to use every letter in as few words as possible — par is usually four or five.
          </p>
        ),
      }}
      qa={copy.qa}
    >
      {data && (
        <section className="mt-6">
          <h2 className="text-xl font-bold text-[#111827]">Today&apos;s box</h2>
          <ul className="mt-2 grid grid-cols-2 gap-2 font-mono text-lg font-bold tracking-[0.3em] text-[#111827] sm:grid-cols-4">
            {data.sides.map((s) => (
              <li key={s} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-center">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}
    </DailyAnswerPage>
  );
}
