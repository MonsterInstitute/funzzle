import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ArchiveCalendar from "@/components/profile/ArchiveCalendar";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Daily Puzzle Archive: Past Sudoku, Solitaire and Mahjong",
  description: "Play any past Daily Sudoku, Daily Solitaire or Daily Mahjong from the calendar. Free, no sign-up; filled-in days are the ones you’ve solved.",
  path: "/archive",
});

export default function ArchivePage() {
  return (
    <div data-kit className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-10">
        <h1 className="m-0 font-display text-[44px] font-extrabold leading-none tracking-[-0.03em]">Past puzzles</h1>
        <p className="mb-8 mt-3 text-[17px] leading-relaxed text-muted">
          Every day’s Daily Sudoku, Daily Solitaire and Daily Mahjong, back to October 2026. Archive puzzles don’t change your rating or streak; they’re for
          practice and for catching up. Filled-in days are ones you’ve solved.
        </p>
        <ArchiveCalendar />
      </main>
      <Footer />
    </div>
  );
}
