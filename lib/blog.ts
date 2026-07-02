export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // YYYY-MM-DD
  excerpt: string;
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "is-nyt-games-worth-it",
    title: "Is NYT Games Worth It in 2026? Honest Review",
    description:
      "An honest 2026 review of NYT Games: pricing, what's included, the pros and cons, and free alternatives worth trying first.",
    datePublished: "2026-06-15",
    excerpt:
      "We break down the price, what you actually get, and whether the NYT Games subscription is worth it in 2026 — plus the free way to play.",
  },
  {
    slug: "best-free-crossword-apps",
    title: "7 Best Free Crossword Apps in 2026 (No Paywall)",
    description:
      "The 7 best free crossword apps and sites in 2026 — no paywall, no subscription. Where to solve daily crosswords without paying.",
    datePublished: "2026-06-20",
    excerpt:
      "Seven genuinely free crossword apps and sites for 2026, ranked — starting with the one that never asks for a credit card.",
  },
  {
    slug: "nyt-mini-crossword-tips",
    title: "NYT Mini Crossword Tips: Solve Faster Every Day",
    description:
      "Practical NYT Mini Crossword tips to solve faster: common clue patterns, fill tricks, and a daily practice routine.",
    datePublished: "2026-06-25",
    excerpt:
      "Cut your Mini Crossword time with these clue-pattern tricks, fill strategies, and a simple daily practice routine.",
  },
];

export function getPost(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
