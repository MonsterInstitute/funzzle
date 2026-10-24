import Link from "next/link";

const LINKS = [
  { label: "How to play", href: "/how-to-play" },
  { label: "Hints & answers", href: "/#answers" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "mailto:hello@funzzle.com" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
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
