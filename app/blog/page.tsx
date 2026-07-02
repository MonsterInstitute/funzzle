import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { BLOG_POSTS } from "@/lib/blog";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { formatLongDate } from "@/lib/dates";

export const metadata: Metadata = pageMetadata({
  title: "Funzzle Blog — Puzzle Tips & Reviews",
  description:
    "Puzzle strategy, honest reviews, and daily answer roundups from Funzzle — the free NYT Games alternative.",
  path: "/blog",
});

export default function BlogIndexPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />
      <Header />
      <AdSlot slot="leaderboard" className="py-4" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
          Funzzle Blog
        </h1>
        <p className="mt-2 text-gray-600">
          Puzzle tips, honest reviews, and strategy guides.
        </p>

        <ul className="mt-8 space-y-6">
          {BLOG_POSTS.map((post) => (
            <li
              key={post.slug}
              className="rounded-xl border border-[#e5e7eb] p-5 transition-shadow hover:shadow-lg"
            >
              <Link href={`/blog/${post.slug}`}>
                <h2 className="text-xl font-bold text-[#111827]">
                  {post.title}
                </h2>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
                  {formatLongDate(post.datePublished)}
                </p>
                <p className="mt-2 text-gray-600">{post.excerpt}</p>
                <p className="mt-3 font-semibold text-[#16a34a]">Read more →</p>
              </Link>
            </li>
          ))}
        </ul>

        <AdSlot slot="rectangle" className="mt-10" />
      </main>

      <Footer />
    </>
  );
}
