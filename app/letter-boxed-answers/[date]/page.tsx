import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import { puzzleForDate } from "@/lib/letterBoxed";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { isValidISODate, formatLongDate, recentDates } from "@/lib/dates";

type Params = { date: string };
// Each date's puzzle is computed from bundled data — static until the next deploy.
export const revalidate = false;
export const dynamicParams = true;

export function generateStaticParams() {
  return recentDates(30).map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { date } = await params;
  if (!isValidISODate(date)) return { title: "Letter Boxed Answers" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `Letter Boxed Answers ${long} — Solution`,
    description: `The Letter Boxed solution for ${long}: a word chain that uses all twelve letters. Answer revealed and explained.`,
    path: `/letter-boxed-answers/${date}`,
  });
}

export default async function LetterBoxedAnswersPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();
  const long = formatLongDate(date);
  const p = puzzleForDate(date);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Letter Boxed Answers", path: `/letter-boxed-answers/${date}` }])} />
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Letter Boxed Answers — {long}
        </h1>
        <p className="mt-3 text-gray-600">
          Today&apos;s letters are{" "}
          <span className="font-mono font-semibold">{p.sides.join(" · ")}</span>.
          Here is a solution that uses all twelve letters.
        </p>

        <section className="mt-6 rounded-xl border border-[#e5e7eb] p-5 text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Solution
          </h2>
          <p className="mt-2 text-2xl font-bold uppercase text-[#16a34a]">
            {p.solution.join(" → ")}
          </p>
        </section>

        <p className="mt-6 text-gray-700">
          In Letter Boxed, each word must start with the last letter of the
          previous word, and you can never use two letters from the same side in a
          row. This {p.solution.length}-word chain covers every letter — but many
          other solutions exist, so try to beat it in fewer words.
        </p>

        <div className="mt-8 text-center">
          <Link href="/play/letter-box" className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]">
            Play Letter Box →
          </Link>
        </div>
        <AdSlot slot="in-content" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
