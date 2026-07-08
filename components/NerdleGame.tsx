"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  NERDLE_LEN,
  validateEquation,
  scoreEquation,
  type CharState,
} from "@/lib/nerdle";
import { gameColor } from "@/lib/gameColors";

const ROWS = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "+", "-", "*", "/", "="];

const TILE: Record<CharState, string> = {
  empty: "border-2 border-[#e5e7eb] bg-white text-[#111827]",
  absent: "border-2 border-gray-500 bg-gray-500 text-white",
  present: "border-2 border-[#8b5cf6] bg-[#8b5cf6] text-white",
  correct: "border-2 border-[#16a34a] bg-[#16a34a] text-white",
};
const KEYBG: Record<CharState, string> = {
  empty: "bg-gray-200 text-[#111827]",
  absent: "bg-gray-500 text-white",
  present: "bg-[#8b5cf6] text-white",
  correct: "bg-[#16a34a] text-white",
};

export default function NerdleGame({
  answer,
  date,
}: {
  answer: string;
  date: string;
}) {
  const c = gameColor("nerdle");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const scored = useMemo(
    () => guesses.map((g) => scoreEquation(g, answer)),
    [guesses, answer]
  );

  const keyStates = useMemo(() => {
    const map: Record<string, CharState> = {};
    const rank = { empty: 0, absent: 1, present: 2, correct: 3 };
    guesses.forEach((g, gi) =>
      g.split("").forEach((c, i) => {
        const s = scored[gi][i];
        if (!map[c] || rank[s] > rank[map[c]]) map[c] = s;
      })
    );
    return map;
  }, [guesses, scored]);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1600);
  }, []);

  const submit = useCallback(() => {
    if (current.length !== NERDLE_LEN) return flash(`Fill all ${NERDLE_LEN} tiles`);
    const err = validateEquation(current);
    if (err) return flash(err);
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent("");
    if (current === answer) setStatus("won");
    else if (next.length >= ROWS) setStatus("lost");
  }, [current, guesses, answer, flash]);

  const press = useCallback(
    (k: string) => {
      if (status !== "playing") return;
      if (k === "Enter") return submit();
      if (k === "Back") return setCurrent((c) => c.slice(0, -1));
      if (/^[0-9+\-*/=]$/.test(k)) setCurrent((c) => (c.length < NERDLE_LEN ? c + k : c));
    },
    [status, submit]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") press("Enter");
      else if (e.key === "Backspace") press("Back");
      else if (/^[0-9+\-*/=]$/.test(e.key)) press(e.key);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [press]);

  const shareText = useMemo(() => {
    const emoji: Record<CharState, string> = {
      correct: "🟩",
      present: "🟪",
      absent: "⬛",
      empty: "⬛",
    };
    const grid = scored.map((r) => r.map((s) => emoji[s]).join("")).join("\n");
    const res = status === "won" ? `${guesses.length}/6` : "X/6";
    return `Funzzle Nerdle ${date} ${res}\n${grid}\nfunzzle.com`;
  }, [scored, status, guesses.length, date]);

  const share = useCallback(async () => {
    try {
      if (navigator.share) return void (await navigator.share({ text: shareText }));
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [shareText]);

  return (
    <div className="flex flex-col items-center">
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          {toast}
        </div>
      )}

      <div className="grid gap-1.5">
        {Array.from({ length: ROWS }).map((_, r) => {
          const g = guesses[r] ?? (r === guesses.length ? current : "");
          const row = scored[r];
          return (
            <div key={r} className="grid grid-cols-8 gap-1.5">
              {Array.from({ length: NERDLE_LEN }).map((_, c) => {
                const ch = g[c] ?? "";
                const state: CharState = row ? row[c] : "empty";
                return (
                  <div
                    key={c}
                    className={`flex h-11 w-9 items-center justify-center rounded text-xl font-bold sm:h-12 sm:w-11 ${TILE[state]}`}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid w-full max-w-md grid-cols-8 gap-1.5">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={`flex h-11 items-center justify-center rounded text-sm font-bold ${
              KEYBG[keyStates[k] ?? "empty"]
            }`}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => press("Enter")}
          className="col-span-4 flex h-11 items-center justify-center rounded text-sm font-bold transition-colors hover:brightness-95"
          style={{ backgroundColor: c.primary, color: c.onPrimary }}
        >
          Enter
        </button>
        <button
          type="button"
          onClick={() => press("Back")}
          className="col-span-4 flex h-11 items-center justify-center rounded bg-gray-300 text-sm font-bold text-[#111827]"
        >
          ⌫ Delete
        </button>
      </div>

      {status !== "playing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#111827]">
              {status === "won" ? "🎉 Solved!" : "Out of tries"}
            </h2>
            <p className="mt-2 text-gray-600">
              The equation was{" "}
              <span className="font-mono font-bold" style={{ color: c.text }}>{answer}</span>.
            </p>
            <button
              type="button"
              onClick={share}
              className="mt-4 w-full rounded-lg px-6 py-3 font-semibold transition-colors hover:brightness-95"
              style={{ backgroundColor: c.primary, color: c.onPrimary }}
            >
              {copied ? "Copied to clipboard!" : "Share"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
