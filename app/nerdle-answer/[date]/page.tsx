import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DailyAnswerPage from "@/components/answers/DailyAnswerPage";
import { getAnswer, type NerdleAnswerData } from "@/lib/getAnswers";
import { nerdleAnswerCopy } from "@/lib/aeo";
import { nerdleHints } from "@/lib/nytHints";
import { pageMetadata } from "@/lib/seo";
import { FIRST_ANSWER_DATE, formatLongDate, isServedAnswerDate, recentAnswerDates } from "@/lib/dates";

type Params = { date: string };

// The real classic Nerdle answer, stored by the answers cron (lib/cron/answers.ts).
// Static once written; refreshed on demand (lib/revalidation.ts), not on a timer.
export const revalidate = false;

export function generateStaticParams() {
  return recentAnswerDates(30).map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { date } = await params;
  if (!isServedAnswerDate(date)) return { title: "Nerdle Answer" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `Nerdle Answer ${long} — Hints & Equation`,
    description: `Today's classic Nerdle hints and answer for ${long}: two graded hints, then the full equation.`,
    path: `/nerdle-answer/${date}`,
    keywords: [`nerdle answer ${long}`, "nerdle answer today", "nerdle hint"],
  });
}

export default async function NerdleAnswerPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isServedAnswerDate(date)) notFound();
  const long = formatLongDate(date);
  const row = await getAnswer<NerdleAnswerData>(date, "nerdle");
  const data = row?.answer_data;
  const copy = nerdleAnswerCopy(long, data);

  return (
    <DailyAnswerPage
      game="nerdle"
      label="Nerdle"
      title={`Nerdle Answer — ${long}`}
      basePath="/nerdle-answer"
      date={date}
      firstDate={FIRST_ANSWER_DATE}
      summary={copy.summary}
      hints={data ? nerdleHints(data) : null}
      hintsTitle="Nerdle hints"
      answer={data && <strong className="font-mono text-lg tracking-[0.2em]">{data.equation}</strong>}
      pendingText="Today's Nerdle answer will be posted soon. Check back later!"
      source={
        data && (
          <>
            Classic Nerdle{data.number ? ` #${data.number}` : ""}; the answer comes from nerdlegame.com&apos;s official
            answer archive.
          </>
        )
      }
      play={{ href: "/play/word/math", label: "Play Word · Math, free →" }}
      howTo={{
        title: "How to play Nerdle",
        body: (
          <p className="mt-3">
            Nerdle is a maths version of Wordle: guess an eight-character equation, such as 12+35=47, in six tries.
            Green means the right character in the right place, purple means it belongs elsewhere, and black means it
            isn&apos;t in the answer. Multiplication and division are worked out before addition and subtraction.
          </p>
        ),
      }}
      qa={copy.qa}
    />
  );
}
