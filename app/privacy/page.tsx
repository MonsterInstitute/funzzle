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
  title: "Privacy Policy",
  description:
    "How Funzzle collects, uses, and protects your information, including cookies, third-party advertising (Google AdSense), analytics, and your privacy rights.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Privacy Policy", path: "/privacy" },
        ])}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm mt-6 text-gray-700">
          <p>
            This Privacy Policy explains how {SITE_NAME} (&ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;), operator of {SITE_URL},
            collects, uses, and safeguards information when you visit and play on
            our site. By using {SITE_NAME}, you agree to the practices described
            here.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            1. Information we collect
          </h2>
          <p>We keep data collection to a minimum. Specifically:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>No account data.</strong> {SITE_NAME} does not require you
              to register or sign in, so we do not collect names, email
              addresses, or passwords unless you voluntarily email us.
            </li>
            <li>
              <strong>Game progress (local only).</strong> Your in-progress
              puzzles, guesses, and found words are stored in your browser (for
              example via local storage) so a page refresh doesn&apos;t lose your
              game. This data stays on your device and is not sent to us.
            </li>
            <li>
              <strong>Usage and device data.</strong> Like most websites, our
              hosting provider and analytics tools automatically receive standard
              log information — IP address, browser type, device type, referring
              page, and pages viewed — used to keep the site secure and to
              understand which puzzles are popular.
            </li>
            <li>
              <strong>Advertising data.</strong> Our advertising partners may
              collect information through cookies and similar technologies as
              described below.
            </li>
          </ul>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            2. Cookies and similar technologies
          </h2>
          <p>
            A cookie is a small text file stored on your device. We and our
            partners use cookies and local storage to remember your game state,
            measure traffic, and deliver and measure advertising. You can disable
            or delete cookies in your browser settings; core gameplay will still
            work, though some conveniences (like saved progress) may not.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            3. Advertising and Google AdSense
          </h2>
          <p>
            {SITE_NAME} is supported by advertising, including{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-[#16a34a] hover:underline"
            >
              Google AdSense
            </a>
            . Please note the following:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Third-party vendors, including Google, use cookies to serve ads
              based on your prior visits to this and other websites.
            </li>
            <li>
              Google&apos;s use of advertising cookies (including the DART
              cookie) enables it and its partners to serve ads to you based on
              your visit to {SITE_NAME} and/or other sites on the Internet.
            </li>
            <li>
              You may opt out of personalized advertising by visiting{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-[#16a34a] hover:underline"
              >
                Google Ads Settings
              </a>
              . You can also opt out of a third party&apos;s use of cookies for
              personalized advertising at{" "}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-[#16a34a] hover:underline"
              >
                aboutads.info/choices
              </a>
              {" "}or{" "}
              <a
                href="https://www.youronlinechoices.eu/"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-[#16a34a] hover:underline"
              >
                youronlinechoices.eu
              </a>
              .
            </li>
            <li>
              Third-party ad networks other than Google may also be used; those
              networks have their own privacy policies governing their use of
              cookies and data.
            </li>
          </ul>
          <p className="mt-3">
            For visitors in the European Economic Area, the UK, and other regions
            requiring consent, we use a consent mechanism to ask permission
            before non-essential advertising cookies are set, consistent with
            Google&apos;s EU user consent policy.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">4. Analytics</h2>
          <p>
            We use privacy-conscious analytics to understand aggregate traffic
            (for example, how many people played today&apos;s Mini). Analytics
            data is used in aggregate and is not used to personally identify you.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            5. How we use information
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>To operate, maintain, and secure the site.</li>
            <li>To understand which puzzles and pages are popular.</li>
            <li>To serve and measure advertising that funds the site.</li>
            <li>To respond to emails and support requests you send us.</li>
          </ul>
          <p className="mt-3">
            We do not sell your personal information in the traditional sense of
            exchanging it for money.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            6. Your privacy rights (GDPR &amp; CCPA)
          </h2>
          <p>
            Depending on where you live, you may have the right to access,
            correct, delete, or restrict the processing of your personal data, to
            object to processing, and to opt out of the &ldquo;sale&rdquo; or
            &ldquo;sharing&rdquo; of personal information for targeted
            advertising. Because we do not maintain accounts, most requests
            relate to advertising cookies, which you can control using the opt-out
            links in Section 3 or your browser settings. To exercise any right,
            email us at{" "}
            <a
              href="mailto:privacy@funzzle.com"
              className="text-[#16a34a] hover:underline"
            >
              privacy@funzzle.com
            </a>
            .
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            7. Children&apos;s privacy
          </h2>
          <p>
            {SITE_NAME} is intended for a general audience and is not directed to
            children under 13 (or the equivalent minimum age in your
            jurisdiction). We do not knowingly collect personal information from
            children. If you believe a child has provided us personal
            information, contact us and we will delete it. Where required, we
            instruct our ad partners to serve non-personalized ads to users we
            treat as children.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            8. Data retention and security
          </h2>
          <p>
            Server logs are retained only as long as needed for security and
            analytics and are then deleted or anonymized. We use reasonable
            technical measures to protect information, but no method of
            transmission or storage is 100% secure.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            9. Third-party links
          </h2>
          <p>
            Our pages may link to third-party sites (such as advertisers or the
            official NYT Games). We are not responsible for the privacy practices
            of those sites; review their policies separately.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">
            10. Changes to this policy
          </h2>
          <p>
            We may update this policy from time to time. When we do, we&apos;ll
            revise the &ldquo;Last updated&rdquo; date above. Material changes
            will be reflected on this page; continued use of the site after an
            update constitutes acceptance of the revised policy.
          </p>

          <h2 className="mt-6 text-xl font-bold text-[#111827]">11. Contact</h2>
          <p>
            Questions about this Privacy Policy? Email{" "}
            <a
              href="mailto:privacy@funzzle.com"
              className="text-[#16a34a] hover:underline"
            >
              privacy@funzzle.com
            </a>
            . See also our{" "}
            <Link href="/terms" className="text-[#16a34a] hover:underline">
              Terms of Service
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
