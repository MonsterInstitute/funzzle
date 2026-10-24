import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import { puzzleForDate } from "@/lib/strands";
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
  if (!isValidISODate(date)) return { title: "Strands Answers" };
  const long = formatLongDate(date);
  const p = puzzleForDate(date);
  return pageMetadata({
    title: `Strands Answers ${long} — Theme & Words`,
    description: `Today's Strands theme is "${p.theme}". All hidden words and the spangram for ${long}, revealed and explained.`,
    path: `/strands-answers/${date}`,
  });
}

export default async function StrandsAnswersPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();
  const long = formatLongDate(date);
  const p = puzzleForDate(date);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Strands Answers", path: `/strands-answers/${date}` }])} />
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Strands Answers — {long}
        </h1>
        <p className="mt-3 text-gray-600">
          The Strands theme for {long} is <strong>&ldquo;{p.theme}&rdquo;</strong>.
          Below are all the themed words and the spangram — the word that spans the
          grid. Scroll only if you want the solution!
        </p>

        <section className="mt-6 rounded-xl border border-[#e5e7eb] p-5">
          <h2 className="text-lg font-bold text-[#111827]">Spangram</h2>
          <p className="mt-1 text-xl font-bold uppercase text-[#eab308]">{p.spangram}</p>
          <h2 className="mt-4 text-lg font-bold text-[#111827]">Theme words</h2>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-[#3b82f6]">
            {p.words.map((w) => (
              <li key={w} className="font-semibold uppercase">{w}</li>
            ))}
          </ul>
        </section>

        <p className="mt-6 text-gray-700">
          Every word in a Strands puzzle connects to the day&apos;s theme, and the
          spangram touches two opposite sides of the board. Once you spot the
          spangram, the remaining words usually fall into place around it.
        </p>

        <div className="mt-8 text-center">
          <Link href="/play/strands" className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]">
            Play today&apos;s Strands →
          </Link>
        </div>
        <AdSlot slot="in-content" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
