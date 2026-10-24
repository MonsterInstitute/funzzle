"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/kit/Icons";
import { GameGlyph } from "@/components/kit/Icons";
import { trackVisit } from "@/lib/games/kit/analytics";
import { GAMES } from "@/lib/games/kit/catalog";
import { getStreak } from "@/lib/games/kit/daily";
import { useLocal } from "@/lib/games/kit/useLocal";
import Logo from "./Logo";

const NAV = [
  { label: "Today", href: "/#today" },
  { label: "Games", href: "/#games" },
  { label: "Puzzle Studio", href: "/#studio" },
  { label: "Hints & answers", href: "/#answers" },
];

const readStreak = () => getStreak().current;

export default function Header() {
  const streak = useLocal(readStreak, 0);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    trackVisit();
  }, []);

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-8 sm:py-4">
        <Link href="/" className="rounded-xl text-ink no-underline" aria-label="Funzzle home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="order-3 -mx-1.5 flex w-full justify-between overflow-x-auto text-[14px] font-medium sm:justify-start sm:gap-2 sm:text-[15px] md:order-none md:mx-0 md:w-auto md:gap-7">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full px-1.5 py-2 text-ink no-underline md:px-0">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          {streak > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-tint px-3.5 py-2 text-sm font-semibold text-violet-deep">
              <Icon name="flame" size={16} />
              {streak}-day streak
            </span>
          )}
          <button
            type="button"
            aria-label="Search games"
            onClick={() => setSearchOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-ground text-ink"
          >
            <Icon name="search" />
          </button>
        </div>
      </div>
      {searchOpen && <GameSearch onClose={() => setSearchOpen(false)} />}
    </header>
  );
}

function GameSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const results = GAMES.filter((g) => !q || `${g.name} ${g.category} ${g.description}`.toLowerCase().includes(q));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Search games" className="w-full max-w-lg rounded-[26px] bg-ground p-4 shadow-2xl">
        <div className="flex items-center gap-2 rounded-2xl border border-line-strong px-3">
          <Icon name="search" className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 20 games"
            aria-label="Search games"
            className="min-h-12 flex-1 bg-transparent text-base text-ink outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="flex h-11 w-11 items-center justify-center rounded-full text-ink">
            <Icon name="close" />
          </button>
        </div>
        <ul className="mt-3 max-h-[60vh] overflow-y-auto">
          {results.map((g) => (
            <li key={g.slug}>
              {g.href ? (
                <Link href={g.href} onClick={onClose} className="flex items-center gap-3 rounded-2xl p-2 text-ink no-underline hover:bg-soft">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: g.color }}>
                    <GameGlyph path={g.glyph} size={28} />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{g.name}</span>
                    <span className="text-sm text-muted">{g.description}</span>
                  </span>
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl p-2 opacity-70">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: g.color }}>
                    <GameGlyph path={g.glyph} size={28} />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{g.name}</span>
                    <span className="text-sm text-muted">Coming soon</span>
                  </span>
                </div>
              )}
            </li>
          ))}
          {results.length === 0 && <li className="p-3 text-sm text-muted">No games match “{query}”.</li>}
        </ul>
      </div>
    </div>
  );
}
