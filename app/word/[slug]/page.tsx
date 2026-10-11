import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { WORDS } from "@/lib/content/words";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

type Params = { slug: string };
// Bundled content (lib/content) — static until the next deploy.
export const revalidate = false;

export function generateStaticParams() {
  return WORDS.map((w) => ({ slug: w.slug }));
}

const bySlug = new Map(WORDS.map((w) => [w.slug, w]));

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const w = bySlug.get(slug);
  if (!w) return { title: "Word" };
  return pageMetadata({
    title: `${w.word} — Meaning & Word Facts`,
    description: `What does ${w.word} mean? ${w.explanation}`,
    path: `/word/${slug}`,
  });
}

export default async function WordPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const w = bySlug.get(slug);
  if (!w) notFound();

  const related = WORDS.filter((x) => x.theme === w.theme && x.slug !== w.slug).slice(0, 8);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Words", path: "/word" }, { name: w.word, path: `/word/${slug}` }])} />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{w.theme}</p>
        <h1 className="mt-1 text-4xl font-extrabold uppercase tracking-tight text-[#111827]">{w.word}</h1>
        <p className="mt-4 leading-relaxed text-gray-700">{w.explanation}</p>

        <p className="mt-4 text-sm text-gray-600">
          {w.word} is the kind of word that shows up in themed word searches like
          Strands. Themed puzzles group words like this under a shared category —
          here, <strong>{w.theme}</strong>.
        </p>

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-[#111827]">More {w.theme} words</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/word/${r.slug}`} className="rounded-lg border border-[#e5e7eb] px-3 py-1 text-sm text-[#16a34a] hover:border-[#16a34a]">
                    {r.word}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <AdSlot slot="rectangle" className="my-8" />

        <div className="mt-4 text-center">
          <Link href="/play/strands" className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]">
            Play free Strands →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
