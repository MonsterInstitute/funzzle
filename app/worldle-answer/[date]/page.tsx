import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import RevealBox from "@/components/RevealBox";
import { countryForDate } from "@/lib/worldle";
import { COUNTRIES } from "@/lib/content/countries";
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
  if (!isValidISODate(date)) return { title: "Worldle Answer" };
  const long = formatLongDate(date);
  const c = countryForDate(date);
  return pageMetadata({
    title: `Worldle Answer ${long} — ${c.name}`,
    description: `Today's Worldle country for ${long} is ${c.name}. See the answer, plus facts about ${c.name}.`,
    path: `/worldle-answer/${date}`,
  });
}

export default async function WorldleAnswerPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();
  const long = formatLongDate(date);
  const daily = countryForDate(date);
  const info = COUNTRIES.find((c) => c.slug === daily.slug);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Worldle Answer", path: `/worldle-answer/${date}` }])} />
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Worldle Answer — {long}
        </h1>
        <p className="mt-3 text-gray-600">Today&apos;s mystery country, revealed:</p>

        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
          <svg viewBox="0 0 100 100" className="h-32 w-32 flex-shrink-0" aria-label="Country silhouette">
            <path d={daily.svg} fill="#111827" />
          </svg>
          <div className="w-full">
            <RevealBox answer={daily.name} />
          </div>
        </div>

        {info && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-[#111827]">About {info.name}</h2>
            <p className="mt-2 text-gray-700">{info.description}</p>
            <ul className="mt-3 space-y-1 text-sm text-gray-700">
              <li><strong>Capital:</strong> {info.capital}</li>
              <li><strong>Region:</strong> {info.region}</li>
              <li><strong>Population:</strong> {info.population.toLocaleString()}</li>
              {info.neighbors.length > 0 && (
                <li><strong>Borders:</strong> {info.neighbors.join(", ")}</li>
              )}
            </ul>
            <p className="mt-3">
              <Link href={`/country/${info.slug}`} className="text-[#16a34a] hover:underline">
                More facts about {info.name} →
              </Link>
            </p>
          </section>
        )}

        <div className="mt-8 text-center">
          <Link href="/play/worldle" className="inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]">
            Play free Worldle →
          </Link>
        </div>
        <AdSlot slot="in-content" className="mt-10" />
      </main>
      <Footer />
    </>
  );
}
