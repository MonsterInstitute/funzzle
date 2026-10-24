"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icons";

/**
 * Game screen frame (design/Sudoku.dc.html, Solitaire.dc.html): a top bar on
 * the game's signature tint with back, title and the timer, a chip row, then
 * the game. Mobile-first: a 390px-wide column that centers on larger screens.
 */
export default function GameShell({
  tint,
  title,
  subtitle,
  timer,
  onTimerClick,
  chips,
  children,
  fullTint = false,
  maxWidth = 520,
}: {
  tint: string;
  title: string;
  subtitle: string;
  timer: string;
  onTimerClick?: () => void;
  chips?: ReactNode;
  children: ReactNode;
  /** Solitaire paints the whole screen in its tint; Sudoku only the header. */
  fullTint?: boolean;
  /** Column width in px (Crossword widens it on desktop for the clue lists). */
  maxWidth?: number;
}) {
  return (
    <div data-kit className="min-h-dvh" style={fullTint ? { background: tint } : undefined}>
      <div className={`mx-auto flex w-full flex-col ${fullTint ? "gap-3.5" : "gap-3"} pb-5`} style={{ maxWidth }}>
        <div className="flex flex-col gap-2.5 px-3 pb-3 pt-2.5" style={{ background: tint }}>
          <div className="flex items-center justify-between text-[#111111]">
            <Link href="/" aria-label="Back to home" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#111111]">
              <Icon name="back" size={20} />
            </Link>
            <div className="flex flex-col items-center">
              <h1 className="m-0 font-display text-xl font-extrabold tracking-[-0.02em]">{title}</h1>
              <span className="text-xs text-[#44445A]">{subtitle}</span>
            </div>
            <button
              type="button"
              onClick={onTimerClick}
              aria-label={`Time ${timer}. Pause and settings`}
              className="flex h-11 min-w-11 items-center rounded-full bg-white px-3 font-mono text-[15px] font-semibold text-[#111111]"
            >
              {timer}
            </button>
          </div>
          {chips && <div className="flex flex-wrap justify-center gap-2">{chips}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chip({ children, dark = false, onClick, pressed }: { children: ReactNode; dark?: boolean; onClick?: () => void; pressed?: boolean }) {
  const cls = `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${dark ? "bg-[#111111] text-white" : "bg-white text-[#111111]"}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={`${cls} min-h-8`}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export function ToolButton({
  icon,
  label,
  onClick,
  active = false,
  accent = false,
  disabled = false,
  surface = "soft",
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
  /** "soft" on white screens (Sudoku), "white" on tinted ones (Solitaire). */
  surface?: "soft" | "white";
}) {
  const bg = active ? "bg-ink text-ground" : accent ? "bg-[#FFE6D3] text-[#111111]" : surface === "white" ? "bg-white text-[#111111]" : "bg-soft-2 text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      className={`flex min-h-[52px] flex-col items-center justify-center gap-[3px] rounded-[14px] text-xs font-semibold transition-opacity disabled:opacity-40 ${bg}`}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
}
