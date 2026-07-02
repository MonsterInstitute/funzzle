"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "./Logo";

const NAV_LINKS = [
  { label: "Mini", href: "/play/mini" },
  { label: "Wordle", href: "/play/wordle" },
  { label: "Connections", href: "/play/connections" },
  { label: "Spelling Bee", href: "/play/spelling-bee" },
  { label: "Strands", href: "/play/strands" },
  { label: "Letter Boxed", href: "/play/letter-boxed" },
  { label: "Quordle", href: "/play/quordle" },
  { label: "Worldle", href: "/play/worldle" },
  { label: "Nerdle", href: "/play/nerdle" },
  { label: "Answers", href: "/wordle-answer/today" },
  { label: "Blog", href: "/blog" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-[#e5e7eb] bg-white sticky top-0 z-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm font-medium text-[#111827] max-w-[72%]">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="hover:text-[#16a34a] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden flex flex-col justify-center gap-[5px] p-2"
        >
          <span
            className={`block h-0.5 w-6 bg-black transition-transform ${
              open ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-black transition-opacity ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-black transition-transform ${
              open ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-[#e5e7eb] bg-white px-4 py-2">
          {NAV_LINKS.map((link) => (
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
