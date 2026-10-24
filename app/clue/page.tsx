import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/ads/AdSlot";
import JsonLd from "@/components/JsonLd";
import { loadAllClues } from "@/lib/getClues";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

export const metadata: Metadata = pageMetadata({
  title: "Crossword Clue Answers & Explanations",
  description:
    "Browse crossword clue answers with explanations. Find the answer to any clue and play a free Mini Crossword.",
  path: "/clue",
});

export default async function ClueIndexPage() {
  const clues = (await loadAllClues()).sort((a, b) =>
    a.clue_text.localeCompare(b.clue_text)
  );

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Crossword Clues", path: "/clue" },
        ])}
      />
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Crossword Clue Answers
        </h1>
        <p className="mt-2 text-gray-600">
          {clues.length} clues explained. Tap any clue to reveal its answer.
        </p>

        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {clues.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/clue/${c.slug}`}
                className="flex items-center justify-between rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm transition-colors hover:border-[#16a34a]"
              >
                <span className="text-[#111827]">{c.clue_text}</span>
                <span className="text-gray-400">{c.answer.length}</span>
              </Link>
            </li>
          ))}
        </ul>

        <AdSlot slot="in-content" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
