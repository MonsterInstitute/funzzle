import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import RevealBox from "@/components/RevealBox";
import JsonLd from "@/components/JsonLd";
import {
  getClue,
  getAllClueSlugs,
  getRelatedClues,
} from "@/lib/getClues";
import { breadcrumbJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo";
import { formatLongDate } from "@/lib/dates";

type Params = { slug: string };

export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getAllClueSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clue = await getClue(slug);
  if (!clue) return { title: "Crossword Clue" };
  return pageMetadata({
    title: `${clue.clue_text} — Crossword Clue Answer: ${clue.answer}`,
    description: `The answer to the crossword clue "${clue.clue_text}" is ${clue.answer}. ${clue.explanation}`,
    path: `/clue/${slug}`,
    keywords: [
      clue.clue_text,
      `${clue.clue_text} crossword clue`,
      `${clue.clue_text} answer`,
      clue.answer.toLowerCase(),
    ],
  });
}

export default async function CluePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const clue = await getClue(slug);
  if (!clue) notFound();

  const related = await getRelatedClues(slug, clue.answer);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Crossword Clues", path: "/clue" },
          { name: clue.clue_text, path: `/clue/${slug}` },
        ])}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-[#16a34a]">
            Home
          </Link>
          <span className="mx-2">→</span>
          <span className="text-[#111827]">Crossword Clue</span>
        </nav>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#111827]">
          Crossword Clue: {clue.clue_text}
        </h1>
        <p className="mt-2 text-gray-600">
          Here&apos;s the answer to the{" "}
          <strong>{clue.clue_text}</strong> crossword clue, with an explanation
          and where it has appeared.
        </p>

        {/* Answer reveal */}
        <div className="mt-6">
          <RevealBox answer={clue.answer} />
        </div>

        {/* Explanation */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-[#111827]">
            About the answer: {clue.answer}
          </h2>
          <p className="mt-2 leading-relaxed text-gray-700">
            {clue.explanation}
          </p>
        </section>

        <AdSlot slot="rectangle" className="my-10" />

        {/* Appearances */}
        {clue.appearances.length > 0 && (
          <section className="mt-4">
            <h2 className="text-xl font-bold text-[#111827]">
              Appeared in these puzzles
            </h2>
            <ul className="mt-3 space-y-2">
              {clue.appearances.map((date) => (
                <li key={date}>
                  <Link
                    href={`/nyt-crossword-answers/${date}`}
                    className="text-[#16a34a] hover:underline"
                  >
                    NYT Mini Crossword — {safeLongDate(date)} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Related clues */}
        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-[#111827]">
              Related clues ({clue.answer.length}-letter answers)
            </h2>
            <ul className="mt-3 space-y-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/clue/${r.slug}`}
                    className="text-[#16a34a] hover:underline"
                  >
                    {r.clue_text} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/play/mini"
            className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]"
          >
            Play free Mini Crossword →
          </Link>
        </div>

        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}

function safeLongDate(date: string): string {
  try {
    return formatLongDate(date);
  } catch {
    return date;
  }
}
