"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type LetterBoxedPuzzle,
  allLetters,
  validateWord,
  usedLetters,
  isSolved,
} from "@/lib/letterBoxed";

export default function LetterBoxedGame({
  puzzle,
  date,
}: {
  puzzle: LetterBoxedPuzzle;
  date: string;
}) {
  const [words, setWords] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [toast, setToast] = useState("");

  const letters = useMemo(() => allLetters(puzzle), [puzzle]);
  const used = useMemo(() => usedLetters(words), [words]);
  const solved = isSolved(words, puzzle);
  const prev = words[words.length - 1] ?? null;

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1700);
  }, []);

  const submit = useCallback(() => {
    if (solved) return;
    const err = validateWord(current, puzzle, prev);
    if (err) return flash(err);
    setWords((w) => [...w, current]);
    // Next word starts from this word's last letter.
    setCurrent(current[current.length - 1]);
  }, [solved, current, puzzle, prev, flash]);

  const type = useCallback(
    (ch: string) => {
      if (solved) return;
      if (letters.includes(ch)) setCurrent((c) => c + ch);
    },
    [solved, letters]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        type(e.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [submit, type]);

  const restart = useCallback(() => {
    setWords([]);
    setCurrent("");
  }, []);

  // Square layout: sides[0]=top, [1]=right, [2]=bottom, [3]=left.
  const [top, right, bottom, left] = puzzle.sides;
  const dot = (letter: string) => (
    <button
      key={letter}
      type="button"
      onClick={() => type(letter)}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
        used.has(letter)
          ? "bg-[#16a34a] text-white"
          : "border-2 border-[#111827] bg-white text-[#111827]"
      }`}
    >
      {letter}
    </button>
  );

  return (
    <div className="flex flex-col items-center">
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          {toast}
        </div>
      )}

      {/* Current word */}
      <div className="mb-4 h-8 text-2xl font-bold uppercase tracking-widest text-[#111827]">
        {current || <span className="text-gray-300">Tap letters</span>}
      </div>

      {/* Square board */}
      <div className="relative h-64 w-64">
        <div className="absolute inset-8 rounded-md border-2 border-[#e5e7eb]" />
        {/* top */}
        <div className="absolute left-0 right-0 top-0 flex justify-around">
          {top.split("").map(dot)}
        </div>
        {/* bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-around">
          {bottom.split("").map(dot)}
        </div>
        {/* left */}
        <div className="absolute bottom-0 left-0 top-0 flex flex-col justify-around">
          {left.split("").map(dot)}
        </div>
        {/* right */}
        <div className="absolute bottom-0 right-0 top-0 flex flex-col justify-around">
          {right.split("").map(dot)}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setCurrent((c) => c.slice(0, -1))}
          className="rounded-full border border-[#111827] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-100"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={restart}
          className="rounded-full border border-[#111827] px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-full bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d]"
        >
          Enter
        </button>
      </div>

      {/* Progress */}
      <p className="mt-4 text-sm text-gray-500">
        {used.size}/{letters.length} letters used
      </p>
      {words.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 text-sm font-semibold text-[#111827]">
          {words.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
      )}

      {solved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#111827]">🎉 Solved!</h2>
            <p className="mt-2 text-gray-600">
              You used all {letters.length} letters in {words.length} word
              {words.length === 1 ? "" : "s"}: {words.join(" → ")}.
            </p>
            <button
              type="button"
              onClick={restart}
              className="mt-4 w-full rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white hover:bg-[#15803d]"
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
