import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import RevealBox from "@/components/RevealBox";
import JsonLd from "@/components/JsonLd";
import { equationForDate } from "@/lib/nerdle";
import { EQUATIONS } from "@/lib/content/equations";
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
  if (!isValidISODate(date)) return { title: "Nerdle Answer" };
  const long = formatLongDate(date);
  return pageMetadata({
    title: `Nerdle Answer for ${long}: Equation Solved & Explained`,
    description: `The Nerdle answer for ${long}, with how each part of the equation works so the next one is easier. Then play free Nerdle on Funzzle.`,
    path: `/nerdle-answer/${date}`,
  });
}

export default async function NerdleAnswerPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();
  const long = formatLongDate(date);
  const eq = equationForDate(date);
  const [lhs, rhs] = eq.split("=");
  const known = EQUATIONS.find((e) => e.equation === eq);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Nerdle Answer", path: `/nerdle-answer/${date}` }])} />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Nerdle Answer — {long}
        </h1>
        <p className="mt-3 text-gray-600">Today&apos;s eight-character equation, revealed:</p>

        <div className="mt-6">
          <RevealBox answer={eq} />
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-[#111827]">How it works</h2>
          <p className="mt-2 text-gray-700">
            {known?.explanation ??
              `The left side, ${lhs}, evaluates to ${rhs}. Nerdle follows standard order of operations, so multiplication and division are calculated before addition and subtraction.`}
          </p>
        </section>

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
