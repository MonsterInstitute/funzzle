"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "./Logo";

const GAME_LINKS = [
  { label: "Mini", href: "/play/mini" },
  { label: "Wordle", href: "/play/wordle" },
  { label: "Connections", href: "/play/connections" },
  { label: "Spelling Bee", href: "/play/spelling-bee" },
  { label: "Strands", href: "/play/strands" },
  { label: "Letter Boxed", href: "/play/letter-boxed" },
  { label: "Quordle", href: "/play/quordle" },
  { label: "Worldle", href: "/play/worldle" },
  { label: "Nerdle", href: "/play/nerdle" },
];

const MORE_LINKS = [
  { label: "Answers", href: "/wordle-answer/today" },
  { label: "How to Play", href: "/how-to-play" },
  { label: "Blog", href: "/blog" },
];

const ALL_LINKS = [...GAME_LINKS, ...MORE_LINKS];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="border-b border-[#e5e7eb] bg-white sticky top-0 z-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        {/* Desktop nav (lg+): games inline + a "More" dropdown for utility links */}
        <nav className="hidden items-center gap-x-2.5 text-[13px] font-medium text-[#111827] lg:flex xl:gap-x-4 xl:text-sm">
          {GAME_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="whitespace-nowrap transition-colors hover:text-[#16a34a]"
            >
              {link.label}
            </Link>
          ))}
          <div
            className="relative"
            onMouseEnter={() => setMoreOpen(true)}
            onMouseLeave={() => setMoreOpen(false)}
          >
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="whitespace-nowrap transition-colors hover:text-[#16a34a]"
            >
              More ▾
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full w-40 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                {MORE_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="block px-4 py-2 text-sm text-[#111827] hover:bg-gray-50 hover:text-[#16a34a]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Hamburger (below lg) */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex flex-col justify-center gap-[5px] p-2 lg:hidden"
        >
          <span className={`block h-0.5 w-6 bg-black transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`block h-0.5 w-6 bg-black transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`block h-0.5 w-6 bg-black transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Mobile / tablet menu */}
      {open && (
        <nav className="border-t border-[#e5e7eb] bg-white px-4 py-2 lg:hidden">
          {ALL_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-[#111827] hover:text-[#16a34a]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
