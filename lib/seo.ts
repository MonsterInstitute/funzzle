import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, absoluteUrl } from "./site";

/**
 * Build a consistent Metadata object with canonical URL, Open Graph, and
 * Twitter card tags for a page.
 */
export function pageMetadata({
  title,
  description,
  path,
  ogType = "website",
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article";
  keywords?: string[];
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: ogType,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD structured data builders                                    */
/* ------------------------------------------------------------------ */

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "Funzzle — The Daily Puzzle Playground",
    url: SITE_URL,
    description:
      "Free daily puzzles — Sudoku, Solitaire, word games and more — with a coach that explains the next move, plus hints and answers for the day's NYT puzzles.",
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    email: "hello@funzzle.com",
    description: "Funzzle makes free daily puzzle games that teach you how to solve them.",
  };
}

/** A playable game page: VideoGame + WebApplication. */
export function gameJsonLd({ name, description, path, genre }: { name: string; description: string; path: string; genre: string }) {
  return {
    "@context": "https://schema.org",
    "@type": ["VideoGame", "WebApplication"],
    name,
    description,
    url: absoluteUrl(path),
    genre,
    gamePlatform: "Web browser",
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    playMode: "SinglePlayer",
    isAccessibleForFree: true,
    inLanguage: "en",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(qas: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function articleJsonLd({
  title,
  description,
  path,
  datePublished,
}: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: absoluteUrl(path),
    datePublished,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}
