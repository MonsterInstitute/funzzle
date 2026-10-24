import type { Metadata } from "next";
import Link from "next/link";
import QandA, { Summary } from "@/components/seo/QandA";
import { miniAnswerCopy } from "@/lib/aeo";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import HintLadder from "@/components/kit/HintLadder";
import { miniAnswer, miniHints } from "@/lib/nytHints";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import {
  getAnswer,
  type CrosswordAnswerData,
  type CrosswordClue,
  type AnswerRow,
} from "@/lib/getAnswers";
import { getCluesForDate, type ClueRecord } from "@/lib/getClues";
import { answerIntro, answerFacts, SOLVING_TIPS } from "@/lib/answerContent";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import {
  isValidISODate,
  isServedAnswerDate,
  formatLongDate,
  shiftISODate,
  recentDates,
} from "@/lib/dates";

type Params = { date: string };

// A day's answers never change once written; new rows are picked up through
// on-demand revalidation (app/api/revalidate), not a timer.
export const revalidate = false;

export async function generateStaticParams() {
  return recentDates(30).map((date) => ({ date }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidISODate(date)) return { title: "Crossword Answers" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `NYT Mini Crossword Answers for ${long}: All Clues Solved`,
    description: `Every across and down answer for the NYT Mini on ${long}, each with a short explanation. Check one clue or the whole grid.`,
    path: `/nyt-crossword-answers/${date}`,
    keywords: [
      `nyt crossword answers ${long}`,
      "nyt mini answers",
      "crossword answers today",
    ],
  });
}

export default async function CrosswordAnswersPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { date } = await params;
  if (!isServedAnswerDate(date)) notFound();

  const long = formatLongDate(date);
  const prev = shiftISODate(date, -1);
  const next = shiftISODate(date, 1);

  const [mini, clues] = await Promise.all([
    getAnswer<CrosswordAnswerData>(date, "nyt-mini"),
    getCluesForDate(date, 3),
  ]);

  const miniClues: CrosswordClue[] = mini
    ? [...(mini.answer_data?.across ?? []), ...(mini.answer_data?.down ?? [])]
    : [];
  const intro = miniClues.length
    ? answerIntro(long, mini?.summary ?? null, miniClues)
    : null;
  const facts = answerFacts(miniClues);
  const copy = miniAnswerCopy(long, mini?.answer_data);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Answers", path: `/nyt-crossword-answers/${date}` },
          { name: long, path: `/nyt-crossword-answers/${date}` },
        ])}
      />
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          NYT Mini Crossword Answers — {long}
        </h1>
        <Summary className="text-gray-700">{copy.summary}</Summary>

        {/* Breadcrumb */}
        <nav className="mt-3 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-[#16a34a]">
            Home
          </Link>
          <span className="mx-2">→</span>
          <Link href="/wordle-answer/today" className="hover:text-[#16a34a]">
            Answers
          </Link>
          <span className="mx-2">→</span>
          <span className="text-[#111827]">{long}</span>
        </nav>


        {mini && (mini.answer_data?.across?.length ?? 0) > 0 && (
          <div className="mt-6">
            <HintLadder headingLevel={2} title="NYT Mini hints" tag={long} hints={miniHints(mini.answer_data)} answer={miniAnswer(mini.answer_data)} />
          </div>
        )}

        {/* Every answer, behind one tap: in the HTML for search, never spoiled by scrolling. */}
        <details className="group mt-8 rounded-[22px] border border-[#e6e6ec] p-4 open:pb-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#111111] [&::-webkit-details-marker]:hidden">
            Show every answer and explanation
            <span aria-hidden="true" className="rounded-full bg-[#111111] px-3 py-1 text-sm text-white group-open:hidden">Spoilers</span>
          </summary>
          {intro && <p className="mt-4 leading-relaxed text-gray-700">{intro}</p>}
        <AnswerSection
          title="NYT Mini Crossword Answers"
          row={mini}
        />

        {facts.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-[#111827]">
              Every answer explained
            </h2>
            <div className="mt-3 space-y-4">
              {facts.map((f) => (
                <div
                  key={f.answer}
                  className="rounded-xl border border-[#e5e7eb] p-4"
                >
                  <p className="font-bold uppercase text-[#16a34a]">
                    {f.answer}
                  </p>
                  <p className="text-sm text-gray-500">Clue: {f.clue}</p>
                  <p className="mt-1 leading-relaxed text-gray-700">{f.fact}</p>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* Explore individual clues */}
        {clues.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-[#111827]">
              Explore clues from this puzzle
            </h2>
            <ul className="mt-3 space-y-2">
              {clues.map((c: ClueRecord) => (
                <li key={c.slug}>
                  <Link
                    href={`/clue/${c.slug}`}
                    className="text-[#16a34a] hover:underline"
                  >
                    {c.clue_text} → {c.answer}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        </details>

        <AdSlot slot="in-content" className="my-10" />

        {/* Tips for solving */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-[#111827]">Tips for solving</h2>
          <ul className="mt-3 space-y-2">
            {SOLVING_TIPS.map((tip, i) => (
              <li key={i} className="flex gap-3 text-gray-700">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Play CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/play/mini"
            className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]"
          >
            Play Today&apos;s Free Mini →
          </Link>
        </div>

        <QandA items={copy.qa} className="text-[#111827]" />

        {/* Prev / Next nav */}
        <nav className="mt-10 flex items-center justify-between border-t border-[#e5e7eb] pt-6 text-sm font-medium">
          <Link
            href={`/nyt-crossword-answers/${prev}`}
            className="text-[#16a34a] hover:underline"
          >
            ← {formatLongDate(prev)}
          </Link>
          <Link
            href={`/nyt-crossword-answers/${next}`}
            className="text-[#16a34a] hover:underline"
          >
            {formatLongDate(next)} →
          </Link>
        </nav>

        <AdSlot slot="in-content" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}

function AnswerSection({
  title,
  row,
}: {
  title: string;
  row: AnswerRow<CrosswordAnswerData> | null;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold text-[#111827]">{title}</h2>

      {row?.summary && (
        <p className="mt-2 text-gray-600">{row.summary}</p>
      )}

      {row ? (
        <div className="mt-4 space-y-8">
          <ClueTable heading="Across" clues={row.answer_data?.across ?? []} />
          <ClueTable heading="Down" clues={row.answer_data?.down ?? []} />
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#e5e7eb] bg-gray-50 p-6 text-center text-gray-500">
          Answers will be posted daily. Check back soon!
        </p>
      )}
    </section>
  );
}

function ClueTable({
  heading,
  clues,
}: {
  heading: string;
  clues: CrosswordClue[];
}) {
  if (clues.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {heading}
      </h3>
      <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Clue</th>
              <th className="px-4 py-2 font-medium">Answer</th>
              <th className="px-4 py-2 font-medium">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {clues.map((c) => (
              <tr
                key={`${heading}-${c.number}`}
                className="border-t border-[#e5e7eb] align-top"
              >
                <td className="px-4 py-3 text-[#111827]">
                  <span className="font-semibold">{c.number}.</span> {c.clue}
                </td>
                <td className="px-4 py-3 font-mono font-bold uppercase text-[#16a34a]">
                  {c.answer}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c.explanation ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
