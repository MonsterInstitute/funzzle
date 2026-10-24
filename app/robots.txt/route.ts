import { SITE_URL } from "@/lib/site";

/**
 * Search engines and AI search/answer crawlers are welcome: they're how people
 * find the daily puzzles and answers. Named groups make that explicit (a
 * crawler follows the most specific group that matches it). Cloudflare's
 * managed robots.txt and AI-bot blocking are off for the zone, so this file is
 * served as written (docs/cloudflare-stack.md).
 */
const CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "Applebot",
  "Google-Extended",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "DuckAssistBot",
];

// /api stays crawlable too: pages fetch it while rendering.
const RULES = "Allow: /\n";

export const dynamic = "force-static";

export function GET() {
  const body = [
    ...CRAWLERS.map((ua) => `User-agent: ${ua}\n${RULES}`),
    `User-agent: *\n${RULES}`,
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
