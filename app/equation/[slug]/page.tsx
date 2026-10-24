import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { EQUATIONS } from "@/lib/content/equations";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

type Params = { slug: string };
// Bundled content (lib/content) — static until the next deploy.
export const revalidate = false;

export function generateStaticParams() {
  return EQUATIONS.map((e) => ({ slug: e.slug }));
}

const bySlug = new Map(EQUATIONS.map((e) => [e.slug, e]));

// "156-divided-by-4-equals-39" -> "156 divided by 4": the way people search it.
const spoken = (slug: string) => slug.replace(/-equals-.*$/, "").replace(/-/g, " ");

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const e = bySlug.get(slug);
  if (!e) return { title: "Equation" };
  return pageMetadata({
    title: `What Is ${spoken(slug)}? ${e.concept} Worked Out & Explained`,
    description: `How to work out ${spoken(slug)}: a quick ${e.concept.toLowerCase()} walkthrough, plus how the equation fits a Nerdle row. ${e.explanation}`,
    path: `/equation/${slug}`,
  });
}

export default async function EquationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const e = bySlug.get(slug);
  if (!e) notFound();

  const related = EQUATIONS.filter((x) => x.concept === e.concept && x.slug !== e.slug).slice(0, 4);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Equations", path: "/equation" }, { name: e.equation, path: `/equation/${slug}` }])} />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{e.concept}</p>
        <h1 className="mt-1 font-mono text-4xl font-extrabold tracking-tight text-[#16a34a]">{e.equation}</h1>
        <p className="mt-4 leading-relaxed text-gray-700">{e.explanation}</p>

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-[#111827]">More {e.concept.toLowerCase()} equations</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/equation/${r.slug}`} className="rounded-lg border border-[#e5e7eb] px-3 py-1 font-mono text-sm text-[#16a34a] hover:border-[#16a34a]">
                    {r.equation}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8 text-center">
          <Link href="/play/nerdle" className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]">
            Play free Nerdle →
          </Link>
        </div>
        <AdSlot slot="rectangle" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
