import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DailyAnswerPage from "@/components/answers/DailyAnswerPage";
import { getAnswer, type WorldleAnswerData } from "@/lib/getAnswers";
import { COUNTRIES } from "@/lib/content/countries";
import { worldleAnswerCopy } from "@/lib/aeo";
import { worldleHints } from "@/lib/nytHints";
import { pageMetadata } from "@/lib/seo";
import { FIRST_ANSWER_DATE, formatLongDate, isServedAnswerDate, recentAnswerDates } from "@/lib/dates";

type Params = { date: string };

// The real Worldle country, stored by the answers cron (lib/cron/answers.ts).
// Static once written; refreshed on demand (lib/revalidation.ts), not on a timer.
export const revalidate = false;

export function generateStaticParams() {
  return recentAnswerDates(30).map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { date } = await params;
  if (!isServedAnswerDate(date)) return { title: "Worldle Answer" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `Worldle Answer ${long} — Hints & Country`,
    description: `Today's Worldle hints and answer for ${long}: two graded hints, then the country or territory.`,
    path: `/worldle-answer/${date}`,
    keywords: [`worldle answer ${long}`, "worldle answer today", "worldle country today"],
  });
}

const byName = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));

export default async function WorldleAnswerPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isServedAnswerDate(date)) notFound();
  const long = formatLongDate(date);
  const row = await getAnswer<WorldleAnswerData>(date, "worldle");
  const data = row?.answer_data;
  const copy = worldleAnswerCopy(long, data);
  const info = data ? byName.get(data.country.toLowerCase()) : undefined;

  return (
    <DailyAnswerPage
      game="worldle"
      label="Worldle"
      title={`Worldle Answer — ${long}`}
      basePath="/worldle-answer"
      date={date}
      firstDate={FIRST_ANSWER_DATE}
      summary={copy.summary}
      hints={data ? worldleHints(data) : null}
      hintsTitle="Worldle hints"
      answer={
        data && (
          <>
            <strong>{data.country}</strong>
            {info && (
              <>
                {" "}
                — capital {info.capital}, in {info.region}.{" "}
                <Link href={`/country/${info.slug}`} className="text-[#0369a1] hover:underline">
                  More about {info.name} →
                </Link>
              </>
            )}
          </>
        )
      }
      pendingText="Today's Worldle answer will be posted soon. Check back later!"
      source="The daily Worldle at worldle.teuteuf.fr; the answer comes from the game's own daily data."
      play={{ href: "/play/word/geo", label: "Play Word · Geo, free →" }}
      howTo={{
        title: "How to play Worldle",
        body: (
          <p className="mt-3">
            Worldle shows the silhouette of a country or territory. You have six guesses; after each one the game tells
            you how far away the answer is, in which direction, and how close you are as a percentage. Start with a
            large, central country to narrow the region down fast.
          </p>
        ),
      }}
      qa={copy.qa}
    />
  );
}
