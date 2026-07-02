import { SITE_URL } from "@/lib/site";
import { recentDates, todayISO } from "@/lib/dates";
import { CLUE_CONTENT } from "@/lib/content/clues";
import { BLOG_POSTS } from "@/lib/blog";

export const revalidate = 3600;

interface Entry {
  path: string;
  priority: number;
  lastmod: string;
}

export function GET() {
  const today = todayISO();

  const entries: Entry[] = [
    { path: "/", priority: 1.0, lastmod: today },
    { path: "/free-nyt-games-alternative", priority: 0.8, lastmod: today },
    { path: "/nyt-mini-crossword-free", priority: 0.8, lastmod: today },
    { path: "/wordle-free", priority: 0.8, lastmod: today },
    { path: "/free-crossword-puzzle-daily", priority: 0.8, lastmod: today },
    { path: "/play/mini", priority: 0.8, lastmod: today },
    { path: "/play/wordle", priority: 0.8, lastmod: today },
    { path: "/play/connections", priority: 0.8, lastmod: today },
    { path: "/wordle-answer/today", priority: 0.8, lastmod: today },
    { path: "/play/spelling-bee", priority: 0.8, lastmod: today },
    { path: "/clue", priority: 0.6, lastmod: today },
    { path: "/blog", priority: 0.7, lastmod: today },
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

  // Last 30 days of answer pages (priority 0.9).
  for (const date of recentDates(30)) {
    entries.push({
      path: `/nyt-crossword-answers/${date}`,
      priority: 0.9,
      lastmod: date,
    });
  }

  // Clue pages (priority 0.6).
  for (const clue of CLUE_CONTENT) {
    entries.push({
      path: `/clue/${clue.slug}`,
      priority: 0.6,
      lastmod: clue.appearances[0] ?? today,
    });
  }

  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${SITE_URL}${e.path}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${e.priority.toFixed(1)}</priority>\n  </url>`
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
