import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public site URL — used for canonicals, Open Graph, sitemap, and robots.
  // www is the canonical host: worker.ts 308s the apex to it.
  env: {
    NEXT_PUBLIC_SITE_URL: "https://www.funzzle.com",
  },
};

export default nextConfig;
