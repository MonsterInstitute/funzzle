"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildLayout,
  cellKey,
  type Direction,
  type MiniPuzzle,
  type WordEntry,
} from "@/lib/miniCrossword";
import { gameColor } from "@/lib/gameColors";
import { track } from "@/lib/games/kit/analytics";
import { markDone } from "@/lib/games/kit/daily";

const c = gameColor("mini");

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function MiniCrossword({
  puzzle,
  date,
}: {
  puzzle: MiniPuzzle;
  date: string;
}) {
  const layout = useMemo(() => buildLayout(puzzle), [puzzle]);
  const { cells, words, ordered, size } = layout;

  // First playable (non-black) cell, used as the initial selection.
  const firstCell = useMemo(() => {
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (!cells[r][c].black) return { row: r, col: c };
    return { row: 0, col: 0 };
  }, [cells, size]);

  const [entries, setEntries] = useState<Record<string, string>>({});
  const [active, setActive] = useState(firstCell);
  const [direction, setDirection] = useState<Direction>("across");
  const [checking, setChecking] = useState(false);
  const [won, setWon] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Timer.
  useEffect(() => {
    if (!running || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, won]);

  // A finished daily counts toward the Daily Set and streak.
  useEffect(() => {
    if (!won) return;
    markDone("mini-crossword", date, { timeMs: seconds * 1000, label: revealed ? "Revealed" : undefined });
    track("game_complete", "mini-crossword", { seconds, revealed });
    // Only when the puzzle is finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const activeCell = cells[active.row][active.col];

  // The word the cursor currently sits in (falls back to the other direction
  // if the active cell has no word in the preferred direction).
  const activeWord: WordEntry | null = useMemo(() => {
    const preferId =
      direction === "across" ? activeCell.acrossWord : activeCell.downWord;
    const altId =
      direction === "across" ? activeCell.downWord : activeCell.acrossWord;
    if (preferId != null) return words[direction][preferId];
    if (altId != null) {
      const altDir: Direction = direction === "across" ? "down" : "across";
      return words[altDir][altId];
    }
    return null;
  }, [activeCell, direction, words]);

  const activeCellKeys = useMemo(
    () => new Set(activeWord?.cells.map((c) => cellKey(c.row, c.col))),
    [activeWord]
  );

  const focusHiddenInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const selectCell = useCallback(
    (r: number, c: number) => {
      if (cells[r][c].black) return;
      if (r === active.row && c === active.col) {
        // Toggle direction when tapping the current cell.
        setDirection((d) => (d === "across" ? "down" : "across"));
      } else {
        setActive({ row: r, col: c });
      }
      setChecking(false);
      focusHiddenInput();
    },
    [active, cells, focusHiddenInput]
  );

  const selectWord = useCallback(
    (word: WordEntry) => {
      setDirection(word.direction);
      setActive({ row: word.cells[0].row, col: word.cells[0].col });
      setChecking(false);
      focusHiddenInput();
    },
    [focusHiddenInput]
  );

  // Win detection.
  const checkWin = useCallback(
    (next: Record<string, string>) => {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (cells[r][c].black) continue;
          if (next[cellKey(r, c)] !== cells[r][c].solution) return false;
        }
      }
      return true;
    },
    [cells, size]
  );

  const moveWithinWord = useCallback(
    (delta: number) => {
      if (!activeWord) return;
      const idx = activeWord.cells.findIndex(
        (c) => c.row === active.row && c.col === active.col
      );
      const nextIdx = idx + delta;
      if (nextIdx >= 0 && nextIdx < activeWord.cells.length) {
        const nc = activeWord.cells[nextIdx];
        setActive({ row: nc.row, col: nc.col });
      }
    },
    [activeWord, active]
  );

  const typeLetter = useCallback(
    (letter: string) => {
      const key = cellKey(active.row, active.col);
      setEntries((prev) => {
        const next = { ...prev, [key]: letter };
        if (checkWin(next)) {
          setWon(true);
          setRunning(false);
        }
        return next;
      });
      setChecking(false);
      moveWithinWord(1);
    },
    [active, checkWin, moveWithinWord]
  );

  const backspace = useCallback(() => {
    const key = cellKey(active.row, active.col);
    setChecking(false);
    if (entries[key]) {
      // Current cell has a letter — clear it and stay put.
      setEntries((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    // Current cell is empty — step back within the word and clear that cell.
    if (!activeWord) return;
    const idx = activeWord.cells.findIndex(
      (c) => c.row === active.row && c.col === active.col
    );
    if (idx > 0) {
      const prevCell = activeWord.cells[idx - 1];
      const prevKey = cellKey(prevCell.row, prevCell.col);
      setActive({ row: prevCell.row, col: prevCell.col });
      setEntries((prev) => {
        const next = { ...prev };
        delete next[prevKey];
        return next;
      });
    }
  }, [active, entries, activeWord]);

  const moveArrow = useCallback(
    (dr: number, dc: number) => {
      let r = active.row;
      let c = active.col;
      // Skip over black squares.
      for (let step = 0; step < size; step++) {
        r += dr;
        c += dc;
        if (r < 0 || c < 0 || r >= size || c >= size) return;
        if (!cells[r][c].black) {
          setActive({ row: r, col: c });
          setDirection(dr !== 0 ? "down" : "across");
          return;
        }
      }
    },
    [active, cells, size]
  );

  const handleKey = useCallback(
    (raw: string) => {
      if (won) return;
      if (raw === "BACK") return backspace();
      if (/^[A-Z]$/.test(raw)) return typeLetter(raw);
    },
    [won, backspace, typeLetter]
  );

  // Physical keyboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (k === "ArrowUp") {
        e.preventDefault();
        moveArrow(-1, 0);
      } else if (k === "ArrowDown") {
        e.preventDefault();
        moveArrow(1, 0);
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        moveArrow(0, -1);
      } else if (k === "ArrowRight") {
        e.preventDefault();
        moveArrow(0, 1);
      } else if (k === " ") {
        e.preventDefault();
        setDirection((d) => (d === "across" ? "down" : "across"));
      } else if (/^[a-zA-Z]$/.test(k)) {
        e.preventDefault();
        typeLetter(k.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [backspace, moveArrow, typeLetter]);

  const nextWord = useCallback(
    (delta: number) => {
      if (!activeWord) return;
      const list = ordered[activeWord.direction];
      const idx = list.findIndex((w) => w.number === activeWord.number);
      const target = list[(idx + delta + list.length) % list.length];
      selectWord(target);
    },
    [activeWord, ordered, selectWord]
  );

  const reveal = useCallback(() => {
    const next: Record<string, string> = {};
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (!cells[r][c].black) next[cellKey(r, c)] = cells[r][c].solution;
    setEntries(next);
    setChecking(false);
    setRevealed(true);
    setWon(true);
    setRunning(false);
  }, [cells, size]);

  const reset = useCallback(() => {
    setEntries({});
    setChecking(false);
    setWon(false);
    setRevealed(false);
    setCopied(false);
    setSeconds(0);
    setRunning(true);
    setActive(firstCell);
    setDirection("across");
    focusHiddenInput();
  }, [firstCell, focusHiddenInput]);

  const shareText = useMemo(() => {
    const result = revealed
      ? "Revealed the answers"
      : `Solved in ${fmtTime(seconds)} ⏱`;
    return `Funzzle Mini ${date}\n${result}\nfunzzle.com`;
  }, [revealed, seconds, date]);

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
      // clipboard unavailable — nothing else to do
    }
  }, [shareText]);

  return (
    <div className="flex flex-col items-center">
      {/* Timer + controls */}
      <div className="mb-3 flex w-full max-w-[420px] items-center justify-between text-sm">
        <span className="font-mono text-gray-500" aria-label="Elapsed time">
          ⏱ {fmtTime(seconds)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChecking((v) => !v)}
            className={`rounded-md border px-3 py-1 font-medium transition-colors ${
              checking ? "" : "border-[#e5e7eb] text-[#111827]"
            }`}
            style={checking ? { borderColor: c.primary, color: c.text } : undefined}
            onMouseEnter={(e) => {
              if (!checking) e.currentTarget.style.borderColor = c.primary;
            }}
            onMouseLeave={(e) => {
              if (!checking) e.currentTarget.style.borderColor = "#e5e7eb";
            }}
          >
            Check
          </button>
          <button
            type="button"
            onClick={reveal}
            className="rounded-md border border-[#e5e7eb] px-3 py-1 font-medium text-[#111827] transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.primary)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
          >
            Reveal
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-[#e5e7eb] px-3 py-1 font-medium text-gray-500 transition-colors hover:border-gray-400"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Active clue bar */}
      <div
        className="mb-3 flex w-full max-w-[420px] items-stretch overflow-hidden rounded-lg"
        style={{ backgroundColor: c.tint }}
      >
        <button
          type="button"
          onClick={() => nextWord(-1)}
          aria-label="Previous clue"
          className="px-3 hover:bg-gray-200"
          style={{ color: c.text }}
        >
          ‹
        </button>
        <p className="flex-1 px-2 py-2 text-center text-sm font-medium text-[#111827]">
          {activeWord ? (
            <>
              <span className="font-bold" style={{ color: c.text }}>
                {activeWord.number}
                {activeWord.direction === "across" ? "A" : "D"}
              </span>{" "}
              {activeWord.clue}
            </>
          ) : (
            "Select a cell to begin"
          )}
        </p>
        <button
          type="button"
          onClick={() => nextWord(1)}
          aria-label="Next clue"
          className="px-3 hover:bg-gray-200"
          style={{ color: c.text }}
        >
          ›
        </button>
      </div>

      {/* Grid */}
      <div
        className="relative select-none"
        style={{ width: "min(90vw, 420px)" }}
      >
        {/* Hidden input keeps the mobile soft keyboard available. */}
        <input
          ref={inputRef}
          className="absolute h-0 w-0 opacity-0"
          aria-hidden
          inputMode="text"
          autoCapitalize="characters"
          value=""
          onChange={(e) => {
            const ch = e.target.value.slice(-1);
            if (/^[a-zA-Z]$/.test(ch)) handleKey(ch.toUpperCase());
          }}
        />
        <div
          className="grid overflow-hidden rounded-md border-2 border-[#111827]"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        >
          {cells.flat().map((cell) => {
            const key = cellKey(cell.row, cell.col);
            if (cell.black) {
              return <div key={key} className="aspect-square bg-[#111827]" />;
            }
            const value = entries[key] ?? "";
            const isActive =
              cell.row === active.row && cell.col === active.col;
            const inWord = activeCellKeys.has(key);
            const wrong = checking && value && value !== cell.solution;

            let bg = "bg-white";
            if (isActive) bg = "bg-yellow-300";
            else if (inWord) bg = "bg-green-100";

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectCell(cell.row, cell.col)}
                className={`relative aspect-square border border-[#d1d5db] ${bg} transition-colors`}
              >
                {cell.number != null && (
                  <span className="absolute left-0.5 top-0 text-[9px] font-semibold leading-none text-gray-500">
                    {cell.number}
                  </span>
                )}
                <span
                  className={`flex h-full w-full items-center justify-center text-xl font-bold uppercase ${
                    wrong ? "text-red-500" : "text-[#111827]"
                  }`}
                >
                  {value}
                </span>
                {wrong && (
                  <span className="pointer-events-none absolute right-0.5 top-0.5 h-0 w-0 border-l-8 border-t-8 border-l-transparent border-t-red-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* On-screen keyboard (mobile-friendly, also works on desktop) */}
      <div className="mt-5 flex w-full max-w-[520px] flex-col gap-1.5">
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="flex justify-center gap-1.5">
            {row.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKey(k)}
                className={`flex h-11 items-center justify-center rounded bg-gray-200 text-sm font-semibold uppercase text-[#111827] transition-colors hover:bg-gray-300 ${
                  k === "BACK" ? "px-3" : "flex-1"
                }`}
              >
                {k === "BACK" ? "⌫" : k}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Clue lists */}
      <div className="mt-8 grid w-full max-w-[520px] gap-6 sm:grid-cols-2">
        <ClueList
          heading="Across"
          words={ordered.across}
          active={activeWord}
          onSelect={selectWord}
        />
        <ClueList
          heading="Down"
          words={ordered.down}
          active={activeWord}
          onSelect={selectWord}
        />
      </div>

      {/* Win modal */}
      {won && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#111827]">
              {revealed ? "Answers revealed" : "🎉 Solved!"}
            </h2>
            <p className="mt-2 text-gray-600">
              {revealed ? (
                "Give it another try to beat the clock!"
              ) : (
                <>
                  You finished the Mini in{" "}
                  <span className="font-bold" style={{ color: c.text }}>
                    {fmtTime(seconds)}
                  </span>
                  .
                </>
              )}
            </p>

            <button
              type="button"
              onClick={share}
              className="mt-4 w-full rounded-lg px-6 py-3 font-semibold transition-colors hover:brightness-95"
              style={{ backgroundColor: c.primary, color: c.onPrimary }}
            >
              {copied ? "Copied to clipboard!" : "Share"}
            </button>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-lg border border-[#e5e7eb] px-4 py-2 font-semibold text-[#111827] transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              >
                Play again
              </button>
              <a
                href="/play/wordle"
                className="flex-1 rounded-lg border border-[#e5e7eb] px-4 py-2 font-semibold text-[#111827] transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              >
                Play Wordle →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClueList({
  heading,
  words,
  active,
  onSelect,
}: {
  heading: string;
  words: WordEntry[];
  active: WordEntry | null;
  onSelect: (w: WordEntry) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {heading}
      </h3>
      <ul className="space-y-1 text-sm">
        {words.map((w) => {
          const isActive =
            active?.number === w.number && active?.direction === w.direction;
          return (
            <li key={`${heading}-${w.number}`}>
              <button
                type="button"
                onClick={() => onSelect(w)}
                className={`flex w-full gap-2 rounded px-2 py-1 text-left transition-colors ${
                  isActive ? "text-[#111827]" : "hover:bg-gray-100 text-gray-700"
                }`}
                style={isActive ? { backgroundColor: c.tint } : undefined}
              >
                <span className="font-bold" style={{ color: c.text }}>{w.number}</span>
                <span>{w.clue}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
