import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import GameCard from "@/components/GameCard";

export const metadata: Metadata = {
  title: "Free Mini Crossword",
  description:
    "A free 5×5 mini crossword — coming soon to Funzzle. Play our free Wordle in the meantime.",
};

export default function MiniPlayPage() {
  return (
    <>
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <AdSlot slot="mobile-banner" className="py-3" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl">
          Free Mini Crossword
        </h1>
        <p className="mx-auto mt-4 max-w-md text-gray-600">
          Coming soon — we&apos;re building this! Play our free Wordle in the
          meantime →
        </p>

        <div className="mx-auto mt-8 max-w-xs text-left">
          <GameCard
            title="Wordle Clone"
            description="Guess the 5-letter word"
            emoji="🟩"
            href="/play/wordle"
            badgeText="FREE FOREVER"
          />
        </div>

        <AdSlot slot="rectangle" className="mt-12" />
      </main>

      <Footer />
    </>
  );
}
