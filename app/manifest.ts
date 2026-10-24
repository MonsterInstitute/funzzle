import type { MetadataRoute } from "next";

/** PWA manifest: installable, and needed for web push on iOS (Home Screen apps). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Funzzle — The Daily Puzzle Playground",
    short_name: "Funzzle",
    description: "Free daily puzzles: Sudoku, Solitaire, word games and more, with a coach that explains the next move.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    categories: ["games", "entertainment", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
