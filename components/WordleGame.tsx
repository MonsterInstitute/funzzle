"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { gameColor } from "@/lib/gameColors";

const ROWS = 6;
const COLS = 5;

type LetterState = "empty" | "absent" | "present" | "correct";

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

/** Score a guess against the answer, handling duplicate letters correctly. */
function scoreGuess(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(COLS).fill("absent");
  const counts: Record<string, number> = {};
  for (const ch of answer) counts[ch] = (counts[ch] ?? 0) + 1;

  // First pass: exact matches.
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      counts[guess[i]]--;
    }
  }
  // Second pass: present-but-misplaced.
  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;
    const ch = guess[i];
    if (counts[ch] > 0) {
      result[i] = "present";
      counts[ch]--;
    }
  }
  return result;
}

const TILE_CLASSES: Record<LetterState, string> = {
  empty: "border-2 border-[#e5e7eb] bg-white text-[#111827]",
  absent: "border-2 border-gray-500 bg-gray-500 text-white",
  present: "border-2 border-yellow-500 bg-yellow-500 text-white",
  correct: "border-2 border-[#16a34a] bg-[#16a34a] text-white",
};

const KEY_CLASSES: Record<LetterState, string> = {
  empty: "bg-gray-200 text-[#111827]",
  absent: "bg-gray-500 text-white",
  present: "bg-yellow-500 text-white",
  correct: "bg-[#16a34a] text-white",
};

const EMOJI: Record<LetterState, string> = {
  empty: "⬜",
  absent: "⬛",
  present: "🟨",
  correct: "🟩",
};

export default function WordleGame({
  answer,
  date,
}: {
  answer: string;
  date: string;
}) {
  const c = gameColor("wordle");
  const solution = answer.toUpperCase();
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const scored = useMemo(
    () => guesses.map((g) => scoreGuess(g, solution)),
    [guesses, solution]
  );

  // Best-known state per keyboard letter.
  const keyStates = useMemo(() => {
    const map: Record<string, LetterState> = {};
    const rank: Record<LetterState, number> = {
      empty: 0,
      absent: 1,
      present: 2,
      correct: 3,
    };
    guesses.forEach((g, gi) => {
      g.split("").forEach((ch, i) => {
        const s = scored[gi][i];
        if (!map[ch] || rank[s] > rank[map[ch]]) map[ch] = s;
      });
    });
    return map;
  }, [guesses, scored]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1500);
  }, []);

  const submit = useCallback(() => {
    if (current.length !== COLS) {
      showToast("Not enough letters");
      return;
    }
    const guess = current;
    const nextGuesses = [...guesses, guess];
    setGuesses(nextGuesses);
    setCurrent("");
    if (guess === solution) setStatus("won");
    else if (nextGuesses.length >= ROWS) setStatus("lost");
  }, [current, guesses, solution, showToast]);

  const onKey = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      if (key === "ENTER") {
        submit();
      } else if (key === "BACK") {
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[A-Z]$/.test(key) && current.length < COLS) {
        setCurrent((c) => (c.length < COLS ? c + key : c));
      }
    },
    [status, submit, current.length]
  );

  // Physical keyboard support.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (k === "ENTER") onKey("ENTER");
      else if (k === "BACKSPACE") onKey("BACK");
      else if (/^[A-Z]$/.test(k)) onKey(k);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);

  const shareText = useMemo(() => {
    const grid = scored
      .map((row) => row.map((s) => EMOJI[s]).join(""))
      .join("\n");
    const score = status === "won" ? `${guesses.length}/6` : "X/6";
    return `Funzzle Wordle ${date} ${score}\n${grid}\nfunzzle.com`;
  }, [scored, status, guesses.length, date]);

  const share = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Copy failed");
    }
  }, [shareText, showToast]);

  return (
    <div className="flex flex-col items-center">
      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          {toast}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-rows-6 gap-1.5">
        {Array.from({ length: ROWS }).map((_, r) => {
          const guess = guesses[r] ?? (r === guesses.length ? current : "");
          const rowScore = scored[r];
          return (
            <div key={r} className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: COLS }).map((_, c) => {
                const ch = guess[c] ?? "";
                const state: LetterState = rowScore
                  ? rowScore[c]
                  : "empty";
                return (
                  <div
                    key={c}
                    className={`flex h-14 w-14 items-center justify-center rounded text-2xl font-bold uppercase ${TILE_CLASSES[state]} ${
                      ch && state === "empty" ? "border-gray-400" : ""
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

      {/* Keyboard */}
      <div className="mt-6 flex w-full max-w-lg flex-col gap-1.5">
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="flex justify-center gap-1.5">
            {row.map((key) => {
              const wide = key === "ENTER" || key === "BACK";
              const state = keyStates[key] ?? "empty";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onKey(key)}
                  className={`flex h-12 items-center justify-center rounded text-sm font-semibold uppercase transition-colors ${
                    wide ? "px-3 text-xs" : "flex-1"
                  } ${KEY_CLASSES[state]}`}
                >
                  {key === "BACK" ? "⌫" : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* End-of-game modal */}
      {status !== "playing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            {status === "won" ? (
              <>
                <h2 className="text-2xl font-extrabold text-[#111827]">
                  🎉 You got it!
                </h2>
                <p className="mt-2 text-gray-600">
                  Solved in {guesses.length}/{ROWS}.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold text-[#111827]">
                  So close!
                </h2>
                <p className="mt-2 text-gray-600">
                  The word was{" "}
                  <span
                    className="font-bold uppercase"
                    style={{ color: c.text }}
                  >
                    {solution}
                  </span>
                  .
                </p>
              </>
            )}

            <div className="mt-4 whitespace-pre rounded-lg bg-gray-50 p-3 text-center text-lg leading-tight">
              {scored.map((row) => row.map((s) => EMOJI[s]).join("")).join("\n")}
            </div>

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
