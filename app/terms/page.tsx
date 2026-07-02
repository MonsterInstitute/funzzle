import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const LAST_UPDATED = "July 1, 2026";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description:
    "The terms governing your use of Funzzle — acceptable use, intellectual property, disclaimers, limitation of liability, and our non-affiliation with NYT Games.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Terms of Service", path: "/terms" },
        ])}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm mt-6 max-w-none text-gray-700">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
            use of {SITE_NAME} at {SITE_URL} (the &ldquo;Service&rdquo;). By using
            the Service, you agree to these Terms. If you do not agree, please do
            not use the Service.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            1. Use of the Service
          </h2>
          <p>
            {SITE_NAME} is provided free of charge for your personal,
            non-commercial entertainment. You may play the games, read the
            answer and clue pages, and share your results. You do not need an
            account to use the Service.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            2. Acceptable use
          </h2>
          <p>You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Scrape, crawl, or bulk-download the site&apos;s content or puzzle
              data except as permitted by our{" "}
              <Link href="/robots.txt" className="text-[#16a34a] hover:underline">
                robots.txt
              </Link>
              .
            </li>
            <li>
              Attempt to disrupt, overload, or gain unauthorized access to the
              Service or its servers.
            </li>
            <li>
              Interfere with, hide, or fraudulently interact with the
              advertisements that fund the Service.
            </li>
            <li>
              Reproduce, resell, or redistribute the Service&apos;s content as
              your own.
            </li>
            <li>Use the Service for any unlawful purpose.</li>
          </ul>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            3. Intellectual property
          </h2>
          <p>
            The {SITE_NAME} name, site design, original text, puzzle
            implementations, and clue explanations are owned by us or our
            licensors and are protected by applicable laws. You are granted a
            limited, revocable, non-exclusive license to access the Service for
            personal use. All rights not expressly granted are reserved.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            4. No affiliation with The New York Times
          </h2>
          <p>
            {SITE_NAME} is an independent service and is not affiliated with,
            authorized by, endorsed by, or in any way officially connected to The
            New York Times Company or its Games products. Product and game names,
            including &ldquo;Wordle,&rdquo; &ldquo;The Mini,&rdquo;
            &ldquo;Connections,&rdquo; and &ldquo;Spelling Bee,&rdquo; are
            trademarks of their respective owners and are used here for
            descriptive and comparative purposes only. Our games are
            independently created implementations inspired by these popular
            formats.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            5. Advertising and third-party content
          </h2>
          <p>
            The Service displays advertising and may contain links to third-party
            websites. We do not control and are not responsible for third-party
            content, products, or services, or for the privacy or business
            practices of advertisers or linked sites. Your dealings with third
            parties are solely between you and them. Ads and affiliate links help
            keep {SITE_NAME} free; some outbound links may be affiliate links,
            meaning we could earn a commission at no extra cost to you.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            6. Disclaimer of warranties
          </h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available,&rdquo; without warranties of any kind, express or implied,
            including merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that the Service will be
            uninterrupted, error-free, or that puzzle answers and explanations
            are always complete or accurate. Puzzles and answers are provided for
            entertainment.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            7. Limitation of liability
          </h2>
          <p>
            To the fullest extent permitted by law, {SITE_NAME} and its operators
            will not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or any loss of data or goodwill,
            arising from your use of or inability to use the Service. Our total
            liability for any claim relating to the Service will not exceed the
            amount you paid to use it — which, for a free service, is zero.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            8. Changes to the Service and Terms
          </h2>
          <p>
            We may modify, suspend, or discontinue any part of the Service at any
            time, and we may update these Terms from time to time. When we do,
            we&apos;ll revise the &ldquo;Last updated&rdquo; date above. Continued
            use of the Service after changes take effect constitutes acceptance of
            the revised Terms.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            9. Governing law
          </h2>
          <p>
            These Terms are governed by the laws applicable in the operator&apos;s
            place of business, without regard to conflict-of-law principles. Any
            disputes will be resolved in the courts of that jurisdiction, unless
            local mandatory consumer-protection law provides otherwise.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">10. Contact</h2>
          <p>
            Questions about these Terms? Email{" "}
            <a
              href="mailto:hello@funzzle.com"
              className="text-[#16a34a] hover:underline"
            >
              hello@funzzle.com
            </a>
            . See also our{" "}
            <Link href="/privacy" className="text-[#16a34a] hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/about" className="text-[#16a34a] hover:underline">
              About page
            </Link>
            .
          </p>
        </div>

        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
