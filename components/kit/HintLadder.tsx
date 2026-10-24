"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

/**
 * Three-step hint ladder for answer pages and the homepage (direction →
 * specific → answer). Nothing past the current step is shown, so scrolling
 * never spoils anything; the answer appears only when asked for.
 */
export default function HintLadder({
  title,
  tag,
  hints,
  answer,
  moreHref,
  moreLabel = "All hints & the full answer",
  headingLevel = 3,
}: {
  title: string;
  tag?: string;
  hints: string[];
  answer: ReactNode;
  moreHref?: string;
  moreLabel?: string;
  headingLevel?: 2 | 3;
}) {
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="flex flex-col gap-3.5 rounded-[22px] border border-line bg-ground p-[22px]">
      <div className="flex items-center justify-between gap-3">
        <Heading className="m-0 font-display text-[21px] font-bold tracking-[-0.01em]">{title}</Heading>
        {tag && <span className="font-mono text-xs text-muted-2">{tag}</span>}
      </div>
      {hints.slice(0, step + 1).map((hint, i) => (
        <div key={i} className="rounded-[14px] bg-coach-tint px-4 py-3.5 text-[15px] leading-normal text-ink">
          <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.06em] text-coach-ink">
            Hint {i + 1} of {hints.length}
          </span>
          {hint}
        </div>
      ))}
      {revealed && (
        <div className="rounded-[14px] border border-line bg-soft px-4 py-3.5 text-[15px] leading-normal" aria-live="polite">
          <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.06em] text-muted-2">Answer</span>
          {answer}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {step < hints.length - 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="min-h-11 rounded-full border border-line-strong bg-ground px-4 text-sm font-semibold text-ink"
          >
            Next hint
          </button>
        )}
        {!revealed && (
          <button type="button" onClick={() => setRevealed(true)} className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-ground">
            Reveal answer
          </button>
        )}
        {moreHref && (
          <Link href={moreHref} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink underline underline-offset-4">
            {moreLabel}
          </Link>
        )}
      </div>
    </article>
  );
}
