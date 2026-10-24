import { SITE_URL } from "@/lib/site";
import { recentDates, todayISO } from "@/lib/dates";
import { CLUE_CONTENT } from "@/lib/content/clues";
import { BLOG_POSTS } from "@/lib/blog";
import { COUNTRIES } from "@/lib/content/countries";
import { EQUATIONS } from "@/lib/content/equations";
import { WORDS } from "@/lib/content/words";

// Shows "today": refreshed on demand at the UTC day change and after the daily
// content run (lib/revalidation.ts); the 6h window is only a fallback.
export const revalidate = 21600;

interface Entry {
  path: string;
  priority: number;
  /** Real content date only; omitted for pages whose content has no date. */
  lastmod?: string;
}

export function GET() {
  const today = todayISO();

  const entries: Entry[] = [
    { path: "/", priority: 1.0, lastmod: today },
    { path: "/free-nyt-games-alternative", priority: 0.8, lastmod: today },
    { path: "/nyt-mini-crossword-free", priority: 0.8, lastmod: today },
    { path: "/wordle-free", priority: 0.8, lastmod: today },
    { path: "/free-crossword-puzzle-daily", priority: 0.8, lastmod: today },
    { path: "/play/sudoku", priority: 0.9, lastmod: today },
    { path: "/play/solitaire", priority: 0.9, lastmod: today },
    { path: "/play/word-hunt", priority: 0.9, lastmod: today },
    { path: "/play/mini", priority: 0.8, lastmod: today },
    { path: "/play/wordle", priority: 0.8, lastmod: today },
    { path: "/play/connections", priority: 0.8, lastmod: today },
    { path: "/wordle-answer/today", priority: 0.8, lastmod: today },
    { path: "/play/spelling-bee", priority: 0.8, lastmod: today },
    { path: "/play/strands", priority: 0.8, lastmod: today },
    { path: "/play/letter-boxed", priority: 0.8, lastmod: today },
    { path: "/play/quordle", priority: 0.8, lastmod: today },
    { path: "/play/worldle", priority: 0.8, lastmod: today },
    { path: "/play/nerdle", priority: 0.8, lastmod: today },
    { path: "/clue", priority: 0.6, lastmod: today },
    { path: "/blog", priority: 0.7, lastmod: today },
    { path: "/how-to-play", priority: 0.7, lastmod: today },
    { path: "/archive", priority: 0.6, lastmod: today },
    { path: "/leagues", priority: 0.5 },
    { path: "/about", priority: 0.4, lastmod: today },
    { path: "/privacy", priority: 0.3, lastmod: today },
    { path: "/terms", priority: 0.3, lastmod: today },
  ];

  // Blog posts (priority 0.7).
  for (const post of BLOG_POSTS) {
    entries.push({
      path: `/blog/${post.slug}`,
      priority: 0.7,
      lastmod: post.datePublished,
    });
  }

  // Last 30 days of answer pages (priority 0.9), the dates both routes prerender.
  for (const date of recentDates(30)) {
    for (const route of ["/nyt-crossword-answers", "/connections-answers"]) {
      entries.push({ path: `${route}/${date}`, priority: 0.9, lastmod: date });
    }
  }

  // Clue pages (priority 0.6).
  for (const clue of CLUE_CONTENT) {
    entries.push({
      path: `/clue/${clue.slug}`,
      priority: 0.6,
      lastmod: clue.appearances[0],
    });
  }

  // Daily answer/hint pages for the newer games (recent 90 days each).
  const answerRoutes = [
    "/strands-answers",
    "/letter-boxed-answers",
    "/quordle-answers",
    "/worldle-answer",
    "/nerdle-answer",
  ];
  for (const route of answerRoutes) {
    for (const date of recentDates(90)) {
      entries.push({ path: `${route}/${date}`, priority: 0.5, lastmod: date });
    }
  }

  // Country / equation / word detail pages: static datasets, so no lastmod
  // (a lastmod that is always today teaches Google to ignore it everywhere).
  for (const c of COUNTRIES) {
    entries.push({ path: `/country/${c.slug}`, priority: 0.6 });
  }
  for (const e of EQUATIONS) {
    entries.push({ path: `/equation/${e.slug}`, priority: 0.5 });
  }
  for (const w of WORDS) {
    entries.push({ path: `/word/${w.slug}`, priority: 0.5 });
  }

  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${SITE_URL}${e.path}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ""}    <changefreq>daily</changefreq>\n    <priority>${e.priority.toFixed(1)}</priority>\n  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
