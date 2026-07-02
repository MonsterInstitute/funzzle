"use client";

import { useState } from "react";

export default function RevealBox({ answer }: { answer: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      aria-label={revealed ? "Answer revealed" : "Click to reveal the answer"}
      className="relative flex w-full items-center justify-center rounded-xl border border-[#e5e7eb] bg-gray-50 px-6 py-10"
    >
      <span
        className={`text-4xl font-extrabold uppercase tracking-[0.3em] text-[#16a34a] transition ${
          revealed ? "" : "blur-md select-none"
        }`}
      >
        {answer}
      </span>
      {!revealed && (
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/40 text-sm font-semibold text-[#111827]">
          Tap to reveal answer
        </span>
      )}
    </button>
  );
}
