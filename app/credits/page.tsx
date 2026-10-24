import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Credits and Open-Source Notices",
  description: "The word lists and open-source work Funzzle's games are built on, with their licenses.",
  path: "/credits",
});

// Fully static: the notices are read from the repo at build time.
export const dynamic = "force-static";

/** The license sections of lib/games/words/SOURCES.md, shown verbatim. */
function wordListNotices(): string {
  const md = readFileSync(path.join(process.cwd(), "lib/games/words/SOURCES.md"), "utf8");
  const start = md.indexOf("## SCOWL copyright");
  return start >= 0 ? md.slice(start) : md;
}

export default function CreditsPage() {
  return (
    <div data-kit className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-10">
        <h1 className="m-0 font-display text-[44px] font-extrabold leading-none tracking-[-0.03em]">Credits</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          Funzzle’s word games check words against two freely licensed lists. Thank you to their authors.
        </p>
        <ul className="text-[17px] leading-relaxed">
          <li>
            <strong>SCOWL</strong> (Spell Checker Oriented Word Lists) by Kevin Atkinson and contributors,{" "}
            <a href="http://wordlist.aspell.net/">wordlist.aspell.net</a>, version 2020.12.07.
          </li>
          <li>
            <strong>ENABLE</strong> (Enhanced North American Benchmark LExicon) word list, public domain.
          </li>
        </ul>
        <p className="text-[15px] text-muted">
          Puzzles, clues, pictures and game artwork on Funzzle are original. Funzzle is independent and not affiliated with The New York Times.
        </p>
        <h2 className="mt-10 text-xl font-bold">License notices</h2>
        <pre className="mt-3 max-h-[640px] overflow-auto whitespace-pre-wrap rounded-2xl bg-soft p-4 text-[12px] leading-relaxed">{wordListNotices()}</pre>
      </main>
      <Footer />
    </div>
  );
}
