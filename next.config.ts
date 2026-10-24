import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public site URL — used for canonicals, Open Graph, sitemap, and robots.
  // www is the canonical host: worker.ts 308s the apex to it.
  env: {
    NEXT_PUBLIC_SITE_URL: "https://www.funzzle.com",
  },
  // Share cards print "funzzle.com/daily": it lands on today's Daily Set.
  async redirects() {
    // The old game clones were replaced by Funzzle's own games (Phase 2):
    // 301 so search engines move their signals to the new URLs.
    const moved: [string, string][] = [
      ["/play/wordle", "/play/word"],
      ["/play/quordle", "/play/word/quad"],
      ["/play/worldle", "/play/word/geo"],
      ["/play/nerdle", "/play/word/math"],
      ["/play/connections", "/play/groups"],
      ["/play/spelling-bee", "/play/spelling-hive"],
      ["/play/strands", "/play/word-hunt"],
      ["/play/letter-boxed", "/play/letter-box"],
    ];
    return [
      { source: "/daily", destination: "/#today", permanent: false },
      ...moved.map(([source, destination]) => ({ source, destination, statusCode: 301 as const })),
    ];
  },
};

export default nextConfig;
