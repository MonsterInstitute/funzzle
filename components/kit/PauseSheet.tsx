"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getColorBlind, getTheme, setColorBlind, setTheme, type Theme } from "@/lib/games/kit/settings";

/**
 * Pause overlay: covers the board (the clock is stopped, so the puzzle is
 * hidden), with settings and any game-specific actions.
 */
export default function PauseSheet({ onResume, children }: { onResume: () => void; children?: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [cb, setCb] = useState(() => getColorBlind());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onResume();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onResume]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-label="Paused">
      <div data-kit className="w-full max-w-[520px] rounded-t-[28px] bg-ground p-5 pb-8 sm:rounded-[28px]">
        <h2 className="m-0 font-display text-[28px] font-extrabold tracking-[-0.02em]">Paused</h2>
        <button type="button" autoFocus onClick={onResume} className="mt-4 min-h-[52px] w-full rounded-full bg-ink text-base font-semibold text-ground">
          Resume
        </button>
        {children && <div className="mt-3 flex flex-col gap-2">{children}</div>}
        <fieldset className="mt-5 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">Theme</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["system", "light", "dark"] as Theme[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={theme === t}
                onClick={() => {
                  setTheme(t);
                  setThemeState(t);
                }}
                className={`min-h-11 rounded-full border text-sm font-semibold capitalize ${theme === t ? "border-ink bg-ink text-ground" : "border-line-strong text-ink"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 flex min-h-11 items-center justify-between gap-3 text-sm font-semibold">
          Color-blind mode
          <input
            type="checkbox"
            checked={cb}
            onChange={(e) => {
              setColorBlind(e.target.checked);
              setCb(e.target.checked);
            }}
            className="h-6 w-6 accent-[var(--violet)]"
          />
        </label>
      </div>
    </div>
  );
}

export function SheetButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[52px] w-full rounded-full border border-line-strong text-base font-semibold text-ink">
      {children}
    </button>
  );
}
