import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Leagues from "@/components/profile/Leagues";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Puzzle Leagues for Family, Friends and Teams",
  description:
    "Start a private Funzzle league with an invite code: a weekly leaderboard for the daily puzzles, per game and overall. No sign-up needed.",
  path: "/leagues",
});

export default function LeaguesPage() {
  return (
    <div data-kit className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-10">
        <h1 className="m-0 font-display text-[44px] font-extrabold leading-none tracking-[-0.03em]">Leagues</h1>
        <p className="mb-8 mt-3 text-[17px] leading-relaxed text-muted">
          A private weekly leaderboard for your family, office or class. Everyone plays the same daily puzzles; finishing one earns a point, plus a
          point for each member you beat. Boards reset every Monday. No sign-up: share the invite code.
        </p>
        <Leagues />
      </main>
      <Footer />
    </div>
  );
}
