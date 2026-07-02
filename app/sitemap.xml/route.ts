import { recentDates } from "@/lib/dates";

const BASE_URL = "https://funzzle.com";

export const revalidate = 3600;

export function GET() {
  const staticPaths = [
    "/",
    "/play/mini",
    "/play/wordle",
    "/wordle-answer/today",
  ];

  const answerPaths = recentDates(30).map(
    (date) => `/nyt-crossword-answers/${date}`
  );

  const urls = [...staticPaths, ...answerPaths]
    .map(
      (path) =>
        `  <url>\n    <loc>${BASE_URL}${path}</loc>\n    <changefreq>daily</changefreq>\n  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
