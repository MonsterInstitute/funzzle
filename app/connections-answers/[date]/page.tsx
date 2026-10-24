import type { Metadata } from "next";
import Link from "next/link";
import QandA, { Summary } from "@/components/seo/QandA";
import { connectionsAnswerCopy } from "@/lib/aeo";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import HintLadder from "@/components/kit/HintLadder";
import { connectionsHints } from "@/lib/nytHints";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import ConnectionsReveal from "@/components/ConnectionsReveal";
import { getAnswer, type ConnectionsAnswerData } from "@/lib/getAnswers";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { gameColor } from "@/lib/gameColors";
import {
  isValidISODate,
  isServedAnswerDate,
  formatLongDate,
  shiftISODate,
  recentDates,
} from "@/lib/dates";

type Params = { date: string };

const C = gameColor("connections");

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
  if (!isValidISODate(date)) return { title: "Connections Answers" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `NYT Connections Answers ${long}`,
    description: `Today's NYT Connections answer for ${long} — all four groups revealed, from the easy yellow group to the tricky purple one, with hints.`,
    path: `/connections-answers/${date}`,
    keywords: [
      `connections answers ${long}`,
      "nyt connections today",
      "connections hint",
      "connections groups today",
    ],
  });
}

export default async function ConnectionsAnswersPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { date } = await params;
  if (!isServedAnswerDate(date)) notFound();

  const long = formatLongDate(date);
  const prev = shiftISODate(date, -1);
  const next = shiftISODate(date, 1);

  const row = await getAnswer<ConnectionsAnswerData>(date, "connections");
  const groups = row?.answer_data?.groups ?? [];
  const copy = connectionsAnswerCopy(long, row?.answer_data);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Connections Answers", path: `/connections-answers/${date}` },
          { name: long, path: `/connections-answers/${date}` },
        ])}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <span
          className="inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: C.tint, color: C.text }}
        >
          Connections
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          NYT Connections Answers — {long}
        </h1>
        <Summary className="text-gray-700">{copy.summary}</Summary>

        {/* Breadcrumb */}
        <nav className="mt-3 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:underline" style={{ color: C.text }}>
            Home
          </Link>
          <span className="mx-2">→</span>
          <span className="text-[#111827]">{long}</span>
        </nav>

        {groups.length >= 4 && (
          <div className="mt-6">
            <HintLadder
              headingLevel={2}
              title="Connections hints"
              tag={long}
              hints={connectionsHints({ groups })}
              answer={
                <>
                  <ul className="m-0 list-none space-y-1 p-0">
                    {[...groups].sort((a, b) => a.level - b.level).map((g) => (
                      <li key={g.title}>
                        <strong>{g.title}:</strong> {g.words.join(", ")}
                      </li>
                    ))}
                  </ul>
                  {row?.summary && <span className="mt-2 block text-gray-700">{row.summary}</span>}
                </>
              }
            />
          </div>
        )}

        {groups.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-xl font-bold text-[#111827]">Today&apos;s four groups</h2>
            <p className="mt-1 text-sm text-gray-500">
              Answers are hidden below — tap to reveal them, easiest (yellow) to
              trickiest (purple).
            </p>
            <ConnectionsReveal groups={groups} />
          </section>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-[#e5e7eb] bg-gray-50 p-6 text-center text-gray-500">
            Today&apos;s Connections answer will be posted soon. Check back later!
          </p>
        )}

        <AdSlot slot="rectangle" className="my-10" />

        {/* Play CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/play/connections"
            className="inline-flex rounded-lg px-6 py-3 font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: C.primary, color: C.onPrimary }}
          >
            Play Free Connections →
          </Link>
        </div>

        {/* How to play */}
        <section className="prose prose-sm mt-10 text-gray-700">
          <h2 className="text-xl font-bold text-[#111827]">How to Play Connections</h2>
          <p className="mt-3">
            Connections gives you a grid of 16 words. Your job is to sort them
            into four hidden groups of four that share something in common —
            without using more than four mistakes. Groups are color-coded by
            difficulty: yellow is the most straightforward, then green, blue, and
            finally the purple group, which usually hides a wordplay twist.
          </p>
          <p className="mt-3">
            Watch out for words that look like they fit multiple groups — the
            puzzle is designed so the obvious grouping is often a trap. Solve the
            three easier groups first and the last four words fall into place.
          </p>
        </section>

        <QandA items={copy.qa} className="text-[#111827]" />

        {/* Prev / Next nav */}
        <nav className="mt-10 flex items-center justify-between border-t border-[#e5e7eb] pt-6 text-sm font-medium">
          <Link href={`/connections-answers/${prev}`} className="hover:underline" style={{ color: C.text }}>
            ← {formatLongDate(prev)}
          </Link>
          <Link href={`/connections-answers/${next}`} className="hover:underline" style={{ color: C.text }}>
            {formatLongDate(next)} →
          </Link>
        </nav>

        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
