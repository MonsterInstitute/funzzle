import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import { COUNTRIES } from "@/lib/content/countries";
import { WORLDLE_DAILY } from "@/lib/worldle";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

type Params = { slug: string };
// Bundled content (lib/content) — static until the next deploy.
export const revalidate = false;

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ slug: c.slug }));
}

const bySlug = new Map(COUNTRIES.map((c) => [c.slug, c]));
const byName = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const c = bySlug.get(slug);
  if (!c) return { title: "Country" };
  return pageMetadata({
    title: `${c.name} Facts: Capital, Population, Region & Neighbors`,
    description: `${c.name} at a glance: its capital, population, region, location and every neighboring country, on one page. ${c.description}`,
    path: `/country/${slug}`,
  });
}

export default async function CountryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const c = bySlug.get(slug);
  if (!c) notFound();

  const isWorldle = WORLDLE_DAILY.some((d) => d.slug === slug);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Countries", path: "/country" }, { name: c.name, path: `/country/${slug}` }])} />
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">{c.name}</h1>
        <p className="mt-3 leading-relaxed text-gray-700">{c.description}</p>

        <section className="mt-6 rounded-xl border border-[#e5e7eb] p-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-500">Capital</dt><dd className="font-semibold text-[#111827]">{c.capital}</dd></div>
            <div><dt className="text-gray-500">Region</dt><dd className="font-semibold text-[#111827]">{c.region}</dd></div>
            <div><dt className="text-gray-500">Population</dt><dd className="font-semibold text-[#111827]">{c.population.toLocaleString()}</dd></div>
            <div><dt className="text-gray-500">Coordinates</dt><dd className="font-semibold text-[#111827]">{c.lat.toFixed(1)}, {c.lng.toFixed(1)}</dd></div>
          </dl>
        </section>

        {c.neighbors.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xl font-bold text-[#111827]">Neighboring countries</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {c.neighbors.map((n) => {
                const nb = byName.get(n.toLowerCase());
                return (
                  <li key={n}>
                    {nb ? (
                      <Link href={`/country/${nb.slug}`} className="rounded-full border border-[#e5e7eb] px-3 py-1 text-sm text-[#16a34a] hover:border-[#16a34a]">
                        {n}
                      </Link>
                    ) : (
                      <span className="rounded-full border border-[#e5e7eb] px-3 py-1 text-sm text-gray-600">{n}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <AdSlot slot="in-content" className="my-8" />

        {isWorldle && (
          <p className="rounded-xl bg-green-50 p-4 text-sm text-[#111827]">
            🌍 {c.name} is one of the countries featured in{" "}
            <Link href="/play/worldle" className="font-semibold text-[#16a34a] hover:underline">
              Funzzle Worldle
            </Link>{" "}
            — guess it from its silhouette!
          </p>
        )}

        <div className="mt-8 text-center">
          <Link href="/play/worldle" className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]">
            Play Worldle →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
