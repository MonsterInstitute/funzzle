"use client";

import { useState } from "react";
import type { ConnectionsGroup } from "@/lib/getAnswers";

// Official NYT Connections difficulty tile colors (easy -> hard).
const TILE: Record<string, string> = {
  yellow: "#f9df6d",
  green: "#a0c35a",
  blue: "#b0c4ef",
  purple: "#ba81c5",
};

export default function ConnectionsReveal({ groups }: { groups: ConnectionsGroup[] }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative mt-4">
      <div
        className={`space-y-3 transition ${
          revealed ? "" : "pointer-events-none select-none blur-md"
        }`}
        aria-hidden={!revealed}
      >
        {groups.map((g) => (
          <div
            key={g.title}
            className="rounded-xl p-4"
            style={{ backgroundColor: TILE[g.color ?? "yellow"] ?? "#f9df6d" }}
          >
            <p className="text-sm font-extrabold uppercase tracking-wide text-[#12100b]">
              {g.title}
            </p>
            <p className="mt-1 font-mono text-base font-bold uppercase tracking-wide text-[#12100b]">
              {g.words.join("  ·  ")}
            </p>
            {g.note && (
              <p className="mt-2 text-sm text-[#12100b]/80">{g.note}</p>
            )}
          </div>
        ))}
      </div>

      {!revealed && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50 text-sm font-semibold text-[#111827]"
        >
          Tap to reveal all four groups
        </button>
      )}
    </div>
  );
}
