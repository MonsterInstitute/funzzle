import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ProfileSection from "@/components/home/ProfileSection";
import ReminderOptIn from "@/components/kit/ReminderOptIn";
import { BadgeGrid, SkillTree } from "@/components/profile/Badges";
import NameField from "@/components/profile/NameField";
import Passport from "@/components/profile/Passport";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your Puzzle Profile",
    description: "Your Funzzle streak, ratings, badges, technique skill trees and game passport.",
    path: "/me",
  }),
  // Personal and empty for crawlers: everything here lives on the player's device.
  robots: { index: false, follow: true },
};

export default function MePage() {
  return (
    <div data-kit className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">
        <ProfileSection heading="h1" />
        <div className="mx-auto flex max-w-[1280px] flex-col gap-14 px-4 pb-20 sm:px-8">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
            <SkillTree game="sudoku" />
            <SkillTree game="solitaire" />
          </div>
          <BadgeGrid />
          <Passport />
          <section aria-labelledby="settings-title" className="flex flex-col gap-4">
            <h2 id="settings-title" className="m-0 font-display text-[28px] font-extrabold tracking-[-0.02em]">
              Reminders and name
            </h2>
            <ReminderOptIn />
            <NameField />
            <p className="m-0 max-w-[640px] text-sm text-muted">
              No account: your progress is saved in this browser. Clearing site data resets it.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
