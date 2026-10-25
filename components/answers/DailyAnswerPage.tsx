import Link from "next/link";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import HintLadder from "@/components/kit/HintLadder";
import QandA, { Summary, type QA } from "@/components/seo/QandA";
import { breadcrumbJsonLd } from "@/lib/seo";
import { gameColor, type GameKey } from "@/lib/gameColors";
import { formatLongDate, shiftISODate } from "@/lib/dates";

/**
 * Shared layout for the date pages of other publishers' daily puzzles
 * (Strands, Letter Boxed, Quordle, Worldle, Nerdle). Every page shows the
 * REAL answer stored by the answers cron; with no row yet it says so, and
 * never substitutes one of Funzzle's own puzzles.
 */
export default function DailyAnswerPage({
  game,
  label,
  title,
  basePath,
  date,
  firstDate,
  summary,
  hints,
  hintsTitle,
  answer,
  children,
  pendingText,
  source,
  play,
  howTo,
  qa,
}: {
  game: GameKey;
  /** Short game name for the badge and breadcrumb, e.g. "Strands". */
  label: string;
  title: string;
  basePath: string;
  date: string;
  firstDate: string;
  summary: string;
  /** null when the day's answer isn't stored yet. */
  hints: string[] | null;
  hintsTitle: string;
  answer: ReactNode;
  /** The full reveal section (rendered only when there is an answer). */
  children?: ReactNode;
  pendingText: string;
  /** Where the answer comes from, shown under the answers. */
  source: ReactNode;
  play: { href: string; label: string };
  howTo: { title: string; body: ReactNode };
  qa: QA[];
}) {
  const C = gameColor(game);
  const long = formatLongDate(date);
  const prev = shiftISODate(date, -1);
  const next = shiftISODate(date, 1);
  const path = `${basePath}/${date}`;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: `${label} Answers`, path },
          { name: long, path },
        ])}
      />
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <span
          className="inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: C.tint, color: C.text }}
        >
          {label}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">{title}</h1>
        <Summary className="text-gray-700">{summary}</Summary>

        <nav className="mt-3 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:underline" style={{ color: C.text }}>
            Home
          </Link>
          <span className="mx-2">→</span>
          <span className="text-[#111827]">{long}</span>
        </nav>

        {hints ? (
          <>
            <div className="mt-6">
              <HintLadder headingLevel={2} title={hintsTitle} tag={long} hints={hints} answer={answer} />
            </div>
            {children}
            <p className="mt-4 text-sm text-gray-500">{source}</p>
          </>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-[#e5e7eb] bg-gray-50 p-6 text-center text-gray-500">
            {pendingText}
          </p>
        )}

        <AdSlot slot="in-content" className="my-10" />

        <div className="mt-6 text-center">
          <Link
            href={play.href}
            className="inline-flex rounded-lg px-6 py-3 font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: C.primary, color: C.onPrimary }}
          >
            {play.label}
          </Link>
          <p className="mt-2 text-xs text-gray-500">
            A different puzzle, made by Funzzle — not today&apos;s {label}.
          </p>
        </div>

        <section className="prose prose-sm mt-10 text-gray-700">
          <h2 className="text-xl font-bold text-[#111827]">{howTo.title}</h2>
          {howTo.body}
        </section>

        <QandA items={qa} className="text-[#111827]" />

        <nav className="mt-10 flex items-center justify-between border-t border-[#e5e7eb] pt-6 text-sm font-medium">
          {prev >= firstDate ? (
            <Link href={`${basePath}/${prev}`} className="hover:underline" style={{ color: C.text }}>
              ← {formatLongDate(prev)}
            </Link>
          ) : (
            <span />
          )}
          <Link href={`${basePath}/${next}`} className="hover:underline" style={{ color: C.text }}>
            {formatLongDate(next)} →
          </Link>
        </nav>

        <AdSlot slot="in-content" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
