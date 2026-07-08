"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type BeePuzzle,
  BEE_DICTIONARY,
  isValidBeeWord,
  isPangram,
  scoreWord,
  maxScoreFor,
  rankForScore,
} from "@/lib/spellingBee";
import { gameColor } from "@/lib/gameColors";

const c = gameColor("spelling-bee");

export default function SpellingBeeGame({
  puzzle,
  date,
}: {
  puzzle: BeePuzzle;
  date: string;
}) {
  const dict = useMemo(() => new Set(BEE_DICTIONARY), []);
  const maxScore = useMemo(() => maxScoreFor(puzzle), [puzzle]);
  const geniusScore = Math.ceil(maxScore * 0.7);

  const [outer, setOuter] = useState<string[]>(puzzle.others);
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [wonShown, setWonShown] = useState(false);

  const score = useMemo(
    () => found.reduce((s, w) => s + scoreWord(w, puzzle), 0),
    [found, puzzle]
  );
  const rank = rankForScore(score, maxScore);
  const isGenius = rank.name === "Genius";

  useEffect(() => {
    if (isGenius && !wonShown) setWonShown(true);
  }, [isGenius, wonShown]);

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 1400);
  }, []);

  const submit = useCallback(() => {
    const word = typed.toUpperCase();
    setTyped("");
    if (word.length === 0) return;
    if (word.length < 4) return flash("Too short");
    if (!word.includes(puzzle.center)) return flash("Missing center letter");
    if (!isValidBeeWord(word, puzzle)) return flash("Bad letters");
    if (found.includes(word)) return flash("Already found");
    if (!dict.has(word)) return flash("Not in word list");

    const pts = scoreWord(word, puzzle);
    setFound((f) => [word, ...f]);
    flash(isPangram(word, puzzle) ? `Pangram! +${pts}` : `+${pts}`);
  }, [typed, puzzle, found, dict, flash]);

  const type = useCallback(
    (ch: string) => {
      const allowed = new Set([puzzle.center, ...outer]);
      if (allowed.has(ch)) setTyped((t) => t + ch);
    },
    [puzzle.center, outer]
  );

  // Physical keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        type(e.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, type]);

  const shuffle = useCallback(() => {
    setOuter((prev) => {
      const a = [...prev];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  }, []);

  const Hex = ({ letter, center }: { letter: string; center?: boolean }) => (
    <button
      type="button"
      onClick={() => type(letter)}
      aria-label={letter}
      className={`flex h-16 w-16 items-center justify-center text-2xl font-bold uppercase transition-transform active:scale-95 sm:h-[72px] sm:w-[72px] ${
        center ? "" : "bg-gray-200 text-[#111827] hover:bg-gray-300"
      }`}
      style={{
        clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
        ...(center ? { backgroundColor: c.primary, color: c.onPrimary } : {}),
      }}
    >
      {letter}
    </button>
  );

  return (
    <div className="flex flex-col items-center">
      {message && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          {message}
        </div>
      )}

      {/* Rank + score */}
      <div className="mb-4 w-full max-w-md">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold" style={{ color: c.text }}>{rank.name}</span>
          <span className="text-gray-500">
            {score} pts{isGenius ? "" : ` · Genius at ${geniusScore}`}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full transition-all"
            style={{
              backgroundColor: c.primary,
              width: `${Math.min(100, Math.round((score / Math.max(1, maxScore)) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Current word */}
      <div className="mb-4 h-8 text-2xl font-bold tracking-wider">
        {typed.split("").map((ch, i) => (
          <span
            key={i}
            className={ch === puzzle.center ? "" : "text-[#111827]"}
            style={ch === puzzle.center ? { color: c.text } : undefined}
          >
            {ch}
          </span>
        ))}
        {typed.length === 0 && <span className="text-gray-300">Type or tap letters</span>}
      </div>

      {/* Hex grid */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1">
          <Hex letter={outer[0]} />
          <Hex letter={outer[1]} />
        </div>
        <div className="flex gap-1">
          <Hex letter={outer[2]} />
          <Hex letter={puzzle.center} center />
          <Hex letter={outer[3]} />
        </div>
        <div className="flex gap-1">
          <Hex letter={outer[4]} />
          <Hex letter={outer[5]} />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTyped((t) => t.slice(0, -1))}
          className="rounded-full border border-[#111827] px-5 py-2 text-sm font-semibold text-[#111827] transition-colors hover:bg-gray-100"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={shuffle}
          aria-label="Shuffle letters"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#111827] text-lg transition-colors hover:bg-gray-100"
        >
          ↻
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-full px-5 py-2 text-sm font-semibold transition-colors hover:brightness-95"
          style={{ backgroundColor: c.primary, color: c.onPrimary }}
        >
          Enter
        </button>
      </div>

      {/* Found words */}
      <div className="mt-8 w-full max-w-md">
        <p className="mb-2 text-sm font-semibold text-[#111827]">
          You found {found.length} word{found.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-[#e5e7eb] p-4 text-sm text-[#111827]">
          {found.length === 0 && <span className="text-gray-400">No words yet — start typing!</span>}
          {found.map((w) => (
            <span
              key={w}
              className={isPangram(w, puzzle) ? "font-bold" : ""}
              style={isPangram(w, puzzle) ? { color: c.text } : undefined}
            >
              {w.charAt(0) + w.slice(1).toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Win modal */}
      {wonShown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#111827]">🐝 Genius!</h2>
            <p className="mt-2 text-gray-600">
              You reached Genius with {score} points and {found.length} words. Keep
              going for the full {maxScore}!
            </p>
            <button
              type="button"
              onClick={() => setWonShown(false)}
              className="mt-4 w-full rounded-lg px-6 py-3 font-semibold transition-colors hover:brightness-95"
              style={{ backgroundColor: c.primary, color: c.onPrimary }}
            >
              Keep playing
            </button>
            <a
              href="/play/connections"
              className="mt-2 block w-full rounded-lg border border-[#e5e7eb] px-6 py-2 font-semibold text-[#111827] transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            >
              Play Connections →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
