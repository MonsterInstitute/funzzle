import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public site URL — used for canonicals, Open Graph, sitemap, and robots.
  // www is the canonical host: worker.ts 308s the apex to it.
  env: {
    NEXT_PUBLIC_SITE_URL: "https://www.funzzle.com",
  },
  // Share cards print "funzzle.com/daily": it lands on today's Daily Set.
  async redirects() {
    return [{ source: "/daily", destination: "/#today", permanent: false }];
  },
};

export default nextConfig;
