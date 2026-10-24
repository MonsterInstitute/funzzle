import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ChallengeView from "@/components/profile/ChallengeView";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "You’ve Been Challenged",
    description: "A friend sent you a Funzzle puzzle and their time. Play the same puzzle and see who wins, no sign-up needed.",
    path: "/challenge",
  }),
  robots: { index: false, follow: true },
};

// Static shell: the challenge is read in the browser from ?id=, so each
// challenge link costs no server render or ISR write.
export default function ChallengePage() {
  return (
    <div data-kit className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-10">
        <ChallengeView />
      </main>
      <Footer />
    </div>
  );
}
