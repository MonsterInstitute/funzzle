import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";

export const metadata: Metadata = {
  title: "Blog",
  description: "Puzzle tips, strategies, and daily answer roundups from Funzzle.",
};

export default function BlogPage() {
  return (
    <>
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Funzzle Blog
        </h1>
        <p className="mx-auto mt-4 max-w-md text-gray-600">
          Puzzle tips, strategies, and daily answer roundups are on the way.
          Check back soon!
        </p>
        <AdSlot slot="rectangle" className="mt-12" />
      </main>
      <Footer />
    </>
  );
}
