"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QUORDLE_POOL, scoreGuess, type LetterState } from "@/lib/quordle";
import { gameColor } from "@/lib/gameColors";

const c = gameColor("quordle");

const ATTEMPTS = 9;
const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

const TILE: Record<LetterState, string> = {
  empty: "border-2 border-[#e5e7eb] bg-white text-[#111827]",
  absent: "border-2 border-gray-500 bg-gray-500 text-white",
  present: "border-2 border-yellow-500 bg-yellow-500 text-white",
  correct: "border-2 border-[#16a34a] bg-[#16a34a] text-white",
};

function Board({
  answer,
  guesses,
  solvedAt,
}: {
  answer: string;
  guesses: string[];
  solvedAt: number | null;
}) {
  return (
    <div className="grid gap-1">
      {Array.from({ length: ATTEMPTS }).map((_, r) => {
        const g = guesses[r] ?? "";
        const scored = g.length === 5 ? scoreGuess(g, answer) : null;
        const done = solvedAt !== null && r >= solvedAt;
        return (
          <div key={r} className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, c) => {
              const ch = g[c] ?? "";
              const st: LetterState = scored ? scored[c] : "empty";
              return (
                <div
                  key={c}
                  className={`flex h-7 w-7 items-center justify-center rounded-sm text-sm font-bold uppercase sm:h-8 sm:w-8 ${TILE[st]} ${
                    done ? "opacity-70" : ""
                  }`}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function QuordleGame({
  dailyAnswers,
  date,
}: {
  dailyAnswers: string[];
  date: string;
}) {
  const [practice, setPractice] = useState(false);
  const [answers, setAnswers] = useState<string[]>(dailyAnswers);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [toast, setToast] = useState("");

  const solvedAt = useMemo(
    () =>
      answers.map((a) => {
        const idx = guesses.findIndex((g) => g === a);
        return idx === -1 ? null : idx;
      }),
    [answers, guesses]
  );
  const allSolved = solvedAt.every((s) => s !== null);
  const lost = !allSolved && guesses.length >= ATTEMPTS;
  const over = allSolved || lost;

  const keyStates = useMemo(() => {
    const map: Record<string, LetterState> = {};
    const rank = { empty: 0, absent: 1, present: 2, correct: 3 };
    guesses.forEach((g) => {
      answers.forEach((a) => {
        const sc = scoreGuess(g, a);
        g.split("").forEach((ch, i) => {
          const s = sc[i];
          if (!map[ch] || rank[s] > rank[map[ch]]) map[ch] = s;
        });
      });
    });
    return map;
  }, [guesses, answers]);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1400);
  }, []);

  const submit = useCallback(() => {
    if (over) return;
    if (current.length !== 5) return flash("Not enough letters");
    setGuesses((g) => [...g, current]);
    setCurrent("");
  }, [current, over, flash]);

  const press = useCallback(
    (k: string) => {
      if (over) return;
      if (k === "ENTER") return submit();
      if (k === "BACK") return setCurrent((c) => c.slice(0, -1));
      if (/^[A-Z]$/.test(k)) setCurrent((c) => (c.length < 5 ? c + k : c));
    },
    [over, submit]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (k === "ENTER") press("ENTER");
      else if (k === "BACKSPACE") press("BACK");
      else if (/^[A-Z]$/.test(k)) press(k);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [press]);

  const startPractice = useCallback(() => {
    const picks: string[] = [];
    while (picks.length < 4) {
      const w = QUORDLE_POOL[Math.floor(Math.random() * QUORDLE_POOL.length)];
      if (!picks.includes(w)) picks.push(w);
    }
    setAnswers(picks);
    setGuesses([]);
    setCurrent("");
    setPractice(true);
  }, []);

  const backToDaily = useCallback(() => {
    setAnswers(dailyAnswers);
    setGuesses([]);
    setCurrent("");
    setPractice(false);
  }, [dailyAnswers]);

  return (
    <div className="flex flex-col items-center">
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          {toast}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="font-semibold text-gray-500">
          {practice ? "Practice" : `Daily · ${date}`}
        </span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">
          Guess {guesses.length}/{ATTEMPTS}
        </span>
      </div>

      {/* 4 boards, 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {answers.map((a, i) => (
          <Board
            key={i}
            answer={a}
            guesses={guesses}
            solvedAt={solvedAt[i]}
          />
        ))}
      </div>

      {/* Keyboard */}
      <div className="mt-5 flex w-full max-w-lg flex-col gap-1.5">
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="flex justify-center gap-1.5">
            {row.map((k) => {
              const wide = k === "ENTER" || k === "BACK";
              const st = keyStates[k] ?? "empty";
              const bg =
                st === "correct"
                  ? "bg-[#16a34a] text-white"
                  : st === "present"
                    ? "bg-yellow-500 text-white"
                    : st === "absent"
                      ? "bg-gray-500 text-white"
                      : "bg-gray-200 text-[#111827]";
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  className={`flex h-11 items-center justify-center rounded text-xs font-semibold uppercase ${
                    wide ? "px-2" : "flex-1"
                  } ${bg}`}
                >
                  {k === "BACK" ? "⌫" : k}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {over && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#111827]">
              {allSolved ? "🎉 All four!" : "So close!"}
            </h2>
            <p className="mt-2 text-gray-600">
              {allSolved
                ? `Solved in ${guesses.length}/${ATTEMPTS} guesses.`
                : "The words were:"}
            </p>
            {!allSolved && (
              <p className="mt-1 font-bold uppercase" style={{ color: c.text }}>
                {answers.join(" · ")}
              </p>
            )}
            <button
              type="button"
              onClick={startPractice}
              className="mt-4 w-full rounded-lg px-6 py-3 font-semibold transition-colors hover:brightness-95"
              style={{ backgroundColor: c.primary, color: c.onPrimary }}
            >
              New practice game
            </button>
            {practice && (
              <button
                type="button"
                onClick={backToDaily}
                className="mt-2 block w-full rounded-lg border border-[#e5e7eb] px-6 py-2 font-semibold text-[#111827]"
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              >
                Back to daily
              </button>
            )}
          </div>
        </div>
      )}

      {!over && (
        <button
          type="button"
          onClick={practice ? backToDaily : startPractice}
          className="mt-4 text-sm font-medium hover:underline"
          style={{ color: c.text }}
        >
          {practice ? "Back to daily puzzle" : "Practice mode →"}
        </button>
      )}
    </div>
  );
}
