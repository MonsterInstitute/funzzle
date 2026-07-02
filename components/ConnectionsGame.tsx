"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type ConnCategory,
  type ConnPuzzle,
  type Level,
  LEVEL_BG,
  LEVEL_EMOJI,
  seededShuffle,
  seedFromDate,
} from "@/lib/connections";

const MAX_MISTAKES = 4;

export default function ConnectionsGame({
  puzzle,
  date,
}: {
  puzzle: ConnPuzzle;
  date: string;
}) {
  const seed = useMemo(() => seedFromDate(date), [date]);

  // Map every word to its category, and build the initial shuffled board.
  const wordLevel = useMemo(() => {
    const map: Record<string, Level> = {};
    for (const cat of puzzle.categories)
      for (const w of cat.words) map[w] = cat.level;
    return map;
  }, [puzzle]);

  const allWords = useMemo(
    () => puzzle.categories.flatMap((c) => c.words),
    [puzzle]
  );

  const [board, setBoard] = useState<string[]>(() =>
    seededShuffle(allWords, seed)
  );
  const [solved, setSolved] = useState<ConnCategory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [guesses, setGuesses] = useState<Level[][]>([]);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(false);
  const [copied, setCopied] = useState(false);

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 1600);
  }, []);

  const toggle = useCallback(
    (word: string) => {
      if (status !== "playing") return;
      setSelected((prev) => {
        if (prev.includes(word)) return prev.filter((w) => w !== word);
        if (prev.length >= 4) return prev;
        return [...prev, word];
      });
    },
    [status]
  );

  const revealAll = useCallback(() => {
    setSolved(puzzle.categories.slice().sort((a, b) => a.level - b.level));
    setBoard([]);
  }, [puzzle]);

  const submit = useCallback(() => {
    if (selected.length !== 4 || status !== "playing") return;

    // Record this guess for the share grid.
    const row = selected.map((w) => wordLevel[w]);
    setGuesses((g) => [...g, row]);

    // A correct group is four words that share one category.
    const cat = puzzle.categories.find(
      (c) =>
        selected.every((w) => c.words.includes(w)) &&
        selected.length === c.words.length
    );

    if (cat) {
      const nextSolved = [...solved, cat].sort((a, b) => a.level - b.level);
      setSolved(nextSolved);
      setBoard((b) => b.filter((w) => !cat.words.includes(w)));
      setSelected([]);
      if (nextSolved.length === puzzle.categories.length) {
        setStatus("won");
      }
      return;
    }

    // Wrong guess. "One away" if 3 of the 4 share a category.
    const counts: Record<number, number> = {};
    for (const w of selected) counts[wordLevel[w]] = (counts[wordLevel[w]] ?? 0) + 1;
    const oneAway = Object.values(counts).some((n) => n === 3);

    const nextMistakes = mistakes + 1;
    setMistakes(nextMistakes);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    flash(oneAway ? "One away…" : "Not a group — try again");

    if (nextMistakes >= MAX_MISTAKES) {
      setStatus("lost");
      revealAll();
      setSelected([]);
    }
  }, [selected, status, wordLevel, puzzle, solved, mistakes, flash, revealAll]);

  const shareText = useMemo(() => {
    const grid = guesses
      .map((row) => row.map((lvl) => LEVEL_EMOJI[lvl]).join(""))
      .join("\n");
    const result = status === "won" ? `${guesses.length} guesses` : "X";
    return `Funzzle Connections ${date} (${result})\n${grid}\nfunzzle.com`;
  }, [guesses, status, date]);

  const share = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [shareText]);

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center">
      {/* Toast */}
      {message && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          {message}
        </div>
      )}

      <p className="mb-3 text-center text-sm text-gray-500">
        Create four groups of four!
      </p>

      {/* Solved categories */}
      <div className="w-full space-y-2">
        {solved.map((cat) => (
          <div
            key={cat.name}
            className={`rounded-lg px-3 py-2 text-center text-white ${LEVEL_BG[cat.level]}`}
          >
            <p className="text-sm font-bold uppercase tracking-wide">
              {cat.name}
            </p>
            <p className="text-sm">{cat.words.join(", ")}</p>
          </div>
        ))}
      </div>

      {/* Remaining word grid */}
      {board.length > 0 && (
        <div
          className={`mt-2 grid w-full grid-cols-4 gap-2 ${
            shake ? "animate-pulse" : ""
          }`}
        >
          {board.map((word) => {
            const isSel = selected.includes(word);
            return (
              <button
                key={word}
                type="button"
                onClick={() => toggle(word)}
                className={`flex aspect-[5/4] items-center justify-center rounded-lg px-1 text-center text-xs font-bold uppercase transition-colors sm:text-sm ${
                  isSel
                    ? "bg-[#111827] text-white"
                    : "bg-gray-200 text-[#111827] hover:bg-gray-300"
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>
      )}

      {/* Mistakes */}
      {status === "playing" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <span>Mistakes remaining:</span>
          <span className="flex gap-1">
            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${
                  i < MAX_MISTAKES - mistakes ? "bg-[#111827]" : "bg-gray-300"
                }`}
              />
            ))}
          </span>
        </div>
      )}

      {/* Controls */}
      {status === "playing" && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setBoard((b) => seededShuffle(b, seed + guesses.length + 1))}
            className="rounded-full border border-[#111827] px-4 py-2 text-sm font-semibold text-[#111827] transition-colors hover:bg-gray-100"
          >
            Shuffle
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            disabled={selected.length === 0}
            className="rounded-full border border-[#111827] px-4 py-2 text-sm font-semibold text-[#111827] transition-colors hover:bg-gray-100 disabled:opacity-40"
          >
            Deselect all
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={selected.length !== 4}
            className="rounded-full bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#15803d] disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      )}

      {/* End modal */}
      {status !== "playing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#111827]">
              {status === "won" ? "🎉 Solved!" : "Next time!"}
            </h2>
            <p className="mt-2 text-gray-600">
              {status === "won"
                ? `You found all four groups in ${guesses.length} guesses.`
                : "You ran out of guesses — the groups are revealed above."}
            </p>

            {guesses.length > 0 && (
              <div className="mt-4 whitespace-pre rounded-lg bg-gray-50 p-3 text-center text-lg leading-tight">
                {guesses
                  .map((row) => row.map((l) => LEVEL_EMOJI[l]).join(""))
                  .join("\n")}
              </div>
            )}

            <button
              type="button"
              onClick={share}
              className="mt-4 w-full rounded-lg bg-[#16a34a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#15803d]"
            >
              {copied ? "Copied to clipboard!" : "Share"}
            </button>
            <a
              href="/play/wordle"
              className="mt-2 block w-full rounded-lg border border-[#e5e7eb] px-6 py-2 font-semibold text-[#111827] transition-colors hover:border-[#16a34a]"
            >
              Play Wordle →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
