import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import {
  getAnswer,
  type CrosswordAnswerData,
  type CrosswordClue,
  type AnswerRow,
} from "@/lib/getAnswers";
import {
  isValidISODate,
  formatLongDate,
  shiftISODate,
  recentDates,
} from "@/lib/dates";

type Params = { date: string };

export const revalidate = 3600;

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
  return {
    title: `NYT Crossword Answers ${long} | Funzzle`,
    description: `Complete answers for the NYT Mini and Daily crossword on ${long}. Every clue solved and explained.`,
  };
}

export default async function CrosswordAnswersPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();

  const long = formatLongDate(date);
  const prev = shiftISODate(date, -1);
  const next = shiftISODate(date, 1);

  const [mini, daily] = await Promise.all([
    getAnswer<CrosswordAnswerData>(date, "nyt-mini"),
    getAnswer<CrosswordAnswerData>(date, "nyt-daily"),
  ]);

  return (
    <>
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          NYT Crossword Answers — {long}
        </h1>

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

        <AnswerSection
          title="NYT Mini Crossword Answers"
          row={mini}
        />

        <AdSlot slot="rectangle" className="my-10" />

        <AnswerSection
          title="NYT Daily Crossword Answers"
          row={daily}
        />

        {/* Play CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/play/mini"
            className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]"
          >
            Play Today&apos;s Free Mini →
          </Link>
        </div>

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

        <AdSlot slot="rectangle" className="mt-10" />
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
