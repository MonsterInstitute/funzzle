import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { exec } from "@/lib/db";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

// Unsubscribe links are opened via GET; mark the subscriber as unsubscribed.
export const dynamic = "force-dynamic";

async function unsubscribe(token: string): Promise<"done" | "notfound" | "error"> {
  // Basic UUID shape check before hitting the DB.
  if (!/^[0-9a-f-]{16,}$/i.test(token)) return "notfound";
  try {
    const changed = await exec("UPDATE email_subscribers SET unsubscribed = 1 WHERE unsubscribe_token = ?", token.toLowerCase());
    return changed > 0 ? "done" : "notfound";
  } catch {
    return "error";
  }
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await unsubscribe(token);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
        {result === "done" && (
          <>
            <h1 className="text-2xl font-extrabold text-[#111827]">You&apos;re unsubscribed</h1>
            <p className="mt-3 text-gray-600">
              You won&apos;t receive any more daily-answer emails. Changed your
              mind? You can re-subscribe from the homepage anytime.
            </p>
          </>
        )}
        {result === "notfound" && (
          <>
            <h1 className="text-2xl font-extrabold text-[#111827]">Link not found</h1>
            <p className="mt-3 text-gray-600">
              This unsubscribe link is invalid or has already been used.
            </p>
          </>
        )}
        {result === "error" && (
          <>
            <h1 className="text-2xl font-extrabold text-[#111827]">Something went wrong</h1>
            <p className="mt-3 text-gray-600">
              We couldn&apos;t process that request. Please try again later.
            </p>
          </>
        )}
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]"
        >
          Back to Funzzle
        </Link>
      </main>
      <Footer />
    </>
  );
}
