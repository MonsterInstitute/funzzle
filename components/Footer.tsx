import Link from "next/link";
import { GAMES } from "@/lib/games/kit/catalog";

const LINKS = [
  { label: "How to play", href: "/how-to-play" },
  { label: "Hints & answers", href: "/#answers" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Credits", href: "/credits" },
  { label: "Contact", href: "mailto:hello@funzzle.com" },
];

// Every game, on every page that has a footer: the game pages' main source of
// internal links (Search Console had most of them "Discovered – not indexed").
const GAME_LINKS = GAMES.flatMap((g) => (g.href ? [{ label: g.name, href: g.href }] : []));

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <nav aria-label="Games" className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-8">
        <h2 className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-2">Free daily games</h2>
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm">
          {GAME_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex min-h-11 items-center text-ink no-underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-8">
        <span className="font-display text-[22px] font-extrabold tracking-[-0.03em]">funzzle</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center text-ink no-underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="text-sm text-muted-2">© 2026 Funzzle · Free forever</span>
      </div>
    </footer>
  );
}
