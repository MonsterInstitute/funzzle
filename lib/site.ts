/**
 * Single source of truth for the site's public URL and brand constants.
 * Change SITE_URL here to update canonicals, Open Graph, sitemap, and robots.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.funzzle.com";
export const SITE_NAME = "Funzzle";
export const SITE_TAGLINE = "Free NYT Games, No Paywall";
export const SITE_DESCRIPTION =
  "Play free crossword puzzles, Wordle, Connections, and more. No subscription, no account. The free alternative to NYT Games.";

/** Affiliate / outbound links (replace with real tagged URLs). */
export const AFFILIATE = {
  nytGames: "https://www.nytimes.com/subscription/games",
  amazonPuzzleBooks: "https://www.amazon.com/s?k=crossword+puzzle+books",
};

export const NYT_GAMES_PRICE = "$6";

/** Absolute URL helper for canonicals and structured data. */
export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
