"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icons";

/**
 * AI Coach card. Orange is reserved for the coach (design/DESIGN.md). Shows
 * one rung of the hint ladder, or the coach's explanation, with up to two
 * actions.
 */
export default function CoachCard({
  heading,
  tag,
  children,
  primary,
  secondary,
  onClose,
}: {
  heading: string;
  tag?: string;
  children: ReactNode;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  onClose?: () => void;
}) {
  return (
    <section aria-label="Coach" aria-live="polite" className="flex flex-col gap-2 rounded-[18px] border border-coach-line bg-coach-tint px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-bold">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-coach text-white">
            <Icon name="coach" size={15} strokeWidth={2.2} />
          </span>
          {heading}
        </span>
        <span className="flex items-center gap-1">
          {tag && <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-coach-ink">{tag}</span>}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close coach" className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink">
              <Icon name="close" size={16} />
            </button>
          )}
        </span>
      </div>
      <div className="m-0 text-sm leading-[1.45] text-ink">{children}</div>
      {(primary || secondary) && (
        <div className="flex flex-wrap gap-2">
          {primary && (
            <button type="button" onClick={primary.onClick} className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-ground">
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" onClick={secondary.onClick} className="min-h-11 rounded-full border border-coach-line bg-ground px-4 text-sm font-semibold text-ink">
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
