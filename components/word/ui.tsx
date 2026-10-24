"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import CoachCard from "@/components/kit/CoachCard";
import { Icon } from "@/components/kit/Icons";
import { MODE_INFO, WORD_MODES, type WordMode } from "@/lib/games/word/modes";
import type { Mark } from "@/lib/games/word/score";

/** Best-known state of a key (-1 = not tried). */
export type KeyState = Mark | -1;

/** The four modes, as links (each mode is its own page). */
export function ModeNav({ mode }: { mode: WordMode }) {
  return (
    <nav aria-label="Funzzle Word modes" className="grid grid-cols-4 gap-1.5 px-4">
      {WORD_MODES.map((m) => (
        <Link
          key={m}
          href={MODE_INFO[m].path}
          aria-current={m === mode ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-full text-sm font-semibold no-underline ${
            m === mode ? "bg-ink text-ground hover:text-ground" : "bg-soft-2 text-ink hover:text-ink"
          }`}
        >
          {MODE_INFO[m].short}
        </Link>
      ))}
    </nav>
  );
}

const MARK_STYLE: Record<Mark, { background: string; color: string; borderColor: string }> = {
  0: { background: "var(--word-miss)", color: "var(--word-miss-ink)", borderColor: "var(--word-miss)" },
  1: { background: "var(--word-near)", color: "var(--word-near-ink)", borderColor: "var(--word-near)" },
  2: { background: "var(--word-hit)", color: "var(--word-hit-ink)", borderColor: "var(--word-hit)" },
};
export const MARK_WORD: Record<Mark, string> = { 0: "not in it", 1: "wrong spot", 2: "right spot" };

/** Characters as shown on tiles and keys. */
export const show = (ch: string) => (ch === "*" ? "×" : ch === "/" ? "÷" : ch === "-" ? "−" : ch.toUpperCase());

export function Tile({ ch, mark, size, hint = false, active = false }: { ch: string; mark?: Mark; size: number; hint?: boolean; active?: boolean }) {
  const style = mark !== undefined ? MARK_STYLE[mark] : null;
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-[8px] border-2 font-display font-extrabold uppercase leading-none ${
        style ? "" : ch ? "border-ink text-ink" : active ? "border-line-strong" : "border-line"
      } ${hint && !ch ? "text-coach-ink" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5), ...(style ?? {}) }}
    >
      {ch ? show(ch) : ""}
    </span>
  );
}

/**
 * One board: finished rows with their marks, the row being typed, and empty
 * rows. Screen readers get one line per guess.
 */
export function Board({
  label,
  rows,
  length,
  guesses,
  marks,
  current,
  reveals,
  size,
  solved,
  shake,
}: {
  label: string;
  rows: number;
  length: number;
  guesses: string[];
  marks: Mark[][];
  current: string | null;
  reveals: { pos: number; ch: string }[];
  size: number;
  solved: boolean;
  shake?: number;
}) {
  const gap = size >= 44 ? 6 : 3;
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-col p-0" style={{ gap }}>
      {Array.from({ length: rows }, (_, r) => {
        const done = r < marks.length;
        const typing = !done && !solved && r === marks.length && current !== null;
        const word = done ? guesses[r] : typing ? current! : "";
        const line = done
          ? `Guess ${r + 1}: ${[...word].map((ch, i) => `${show(ch)} ${MARK_WORD[marks[r][i]]}`).join(", ")}`
          : typing && word
            ? `Typing: ${[...word].map(show).join(" ")}`
            : `Row ${r + 1}: empty`;
        return (
          <li key={typing ? `t${shake}` : r} aria-label={line} className={`flex justify-center ${typing && shake ? "animate-[word-shake_0.35s]" : ""}`} style={{ gap }}>
            {Array.from({ length }, (_, i) => {
              const hint = typing ? reveals.find((x) => x.pos === i) : undefined;
              return <Tile key={i} ch={word[i] ?? hint?.ch ?? ""} hint={!!hint && !word[i]} mark={done ? marks[r][i] : undefined} size={size} active={typing && i === word.length} />;
            })}
          </li>
        );
      })}
    </ol>
  );
}

const KEY_BG: Record<number, string> = { [-1]: "color-mix(in srgb, #B5E48C 28%, var(--ground))", 0: "var(--word-miss)", 1: "var(--word-near)", 2: "var(--word-hit)" };
const KEY_INK: Record<number, string> = { [-1]: "var(--ink)", 0: "var(--word-miss-ink)", 1: "var(--word-near-ink)", 2: "var(--word-hit-ink)" };

/**
 * On-screen keyboard. `states` holds one map per board: with four boards
 * (Quad) each key shows four quarters, one per board.
 */
export function Keyboard({
  rows,
  states,
  onKey,
  disabled = false,
}: {
  rows: string[][];
  states: Map<string, KeyState>[];
  onKey: (key: string) => void;
  disabled?: boolean;
}) {
  const word = (s: KeyState) => (s === -1 ? "" : `, ${MARK_WORD[s]}`);
  return (
    <div role="group" aria-label="Keyboard" className="flex flex-col gap-1.5 px-2">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1.5">
          {row.map((k) => {
            if (k === "enter" || k === "back") {
              return (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  onClick={() => onKey(k)}
                  aria-label={k === "enter" ? "Enter" : "Delete"}
                  className="flex min-h-[54px] min-w-[52px] flex-[1.5] items-center justify-center rounded-[10px] bg-soft-2 px-1 text-xs font-bold uppercase text-ink disabled:opacity-40"
                >
                  {k === "enter" ? "Enter" : <Icon name="back" size={20} />}
                </button>
              );
            }
            const per = states.map((m) => m.get(k) ?? -1);
            const single = per.length === 1;
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => onKey(k)}
                aria-label={`${show(k)}${single ? word(per[0]) : per.map((s, b) => (s === -1 ? "" : `, board ${b + 1} ${MARK_WORD[s]}`)).join("")}`}
                className="relative flex min-h-[54px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[10px] font-display text-lg font-bold disabled:opacity-40"
                style={single ? { background: KEY_BG[per[0]], color: KEY_INK[per[0]] } : { background: KEY_BG[-1], color: "var(--ink)" }}
              >
                {!single && (
                  <span aria-hidden="true" className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                    {per.map((s, b) => (
                      <span key={b} style={{ background: s === -1 ? "transparent" : KEY_BG[s] }} />
                    ))}
                  </span>
                )}
                <span className={`relative ${single ? "" : "rounded bg-ground/80 px-1 text-ink"}`}>{show(k)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const LETTER_ROWS = [
  [..."qwertyuiop"],
  [..."asdfghjkl"],
  ["enter", ..."zxcvbnm", "back"],
];
export const MATH_ROWS = [
  [..."1234567890"],
  ["+", "-", "*", "/", "=", "enter", "back"],
];

/** A coach ladder card: nudge → details → answer. */
export function Ladder({
  rung,
  tag,
  direction,
  specific,
  answer,
  hintsLeft,
  onMore,
  onAnswer,
  onClose,
  onTeach,
  action,
}: {
  rung: 1 | 2 | 3;
  tag: string;
  direction: ReactNode;
  specific: ReactNode;
  answer: ReactNode;
  hintsLeft: number;
  onMore: () => void;
  onAnswer: () => void;
  onClose: () => void;
  onTeach?: () => void;
  /** Rung 2's extra action, e.g. "Use SLATE". */
  action?: { label: string; onClick: () => void };
}) {
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }} secondary={onTeach ? { label: "Teach me this", onClick: onTeach } : undefined}>
        {direction}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={action ?? { label: "Show a letter", onClick: onAnswer }} secondary={action ? { label: "Show a letter", onClick: onAnswer } : undefined}>
        {specific}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: "Got it", onClick: onClose }}>
      {answer}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this puzzle.</span>}
    </CoachCard>
  );
}

/** Emoji for the copied result; color-blind mode uses orange and blue. */
export function markEmoji(m: Mark): string {
  const cb = typeof document !== "undefined" && document.documentElement.dataset.cb === "1";
  return m === 2 ? (cb ? "🟧" : "🟩") : m === 1 ? (cb ? "🟦" : "🟨") : "⬛";
}
