"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type StrandsPuzzle,
  type Cell,
  STRANDS_ROWS,
  STRANDS_COLS,
  lineCells,
  matchPlacement,
} from "@/lib/strands";
import { gameColor } from "@/lib/gameColors";

const c = gameColor("strands");

const MAX_HINTS = 3;
const key = (r: number, c: number) => `${r}-${c}`;

export default function StrandsGame({
  puzzle,
  date,
}: {
  puzzle: StrandsPuzzle;
  date: string;
}) {
  const rows = useMemo(() => puzzle.grid.map((r) => r.split("")), [puzzle]);
  const [found, setFound] = useState<{ word: string; isSpangram: boolean }[]>([]);
  const [start, setStart] = useState<Cell | null>(null);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hintCells, setHintCells] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  const total = puzzle.words.length + 1; // + spangram
  const won = found.length === total;

  // cellKey -> color role
  const cellRole = useMemo(() => {
    const m = new Map<string, "word" | "spangram">();
    for (const f of found) {
      const p = puzzle.placements.find((x) => x.word === f.word);
      p?.cells.forEach(([r, c]) => m.set(key(r, c), f.isSpangram ? "spangram" : "word"));
    }
    return m;
  }, [found, puzzle]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1500);
  }, []);

  const click = useCallback(
    (r: number, c: number) => {
      if (won) return;
      if (cellRole.has(key(r, c))) return;
      if (!start) {
        setStart([r, c]);
        return;
      }
      if (start[0] === r && start[1] === c) {
        setStart(null);
        return;
      }
      const cells = lineCells(start, [r, c]);
      setStart(null);
      if (!cells) return flash("Select a straight line");
      const placement = matchPlacement(cells, puzzle);
      if (!placement) return flash("Not a theme word");
      if (found.some((f) => f.word === placement.word)) return flash("Already found");
      setFound((f) => [...f, { word: placement.word, isSpangram: placement.isSpangram }]);
      flash(placement.isSpangram ? "Spangram! ✨" : placement.word);
    },
    [won, cellRole, start, puzzle, found, flash]
  );

  const useHint = useCallback(() => {
    if (hintsLeft <= 0 || won) return;
    const remaining = puzzle.placements.find(
      (p) => !found.some((f) => f.word === p.word)
    );
    if (!remaining) return;
    setHintCells(new Set(remaining.cells.map(([r, c]) => key(r, c))));
    setHintsLeft((h) => h - 1);
    flash(`Hint: ${remaining.isSpangram ? "the spangram" : "a word"} is highlighted`);
  }, [hintsLeft, won, puzzle, found, flash]);

  return (
    <div className="flex flex-col items-center">
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          {toast}
        </div>
      )}

      <div className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
        Today&apos;s theme
      </div>
      <h2 className="mb-4 text-center text-xl font-bold" style={{ color: c.text }}>
        {puzzle.theme}
      </h2>

      {/* Grid */}
      <div className="grid grid-cols-6 gap-1">
        {rows.map((row, r) =>
          row.map((ch, c) => {
            const k = key(r, c);
            const role = cellRole.get(k);
            const isStart = start && start[0] === r && start[1] === c;
            const isHint = hintCells.has(k) && !role;
            let cls = "bg-gray-100 text-[#111827]";
            if (role === "word") cls = "bg-[#3b82f6] text-white";
            else if (role === "spangram") cls = "bg-[#eab308] text-white";
            else if (isStart) cls = "bg-[#111827] text-white";
            else if (isHint) cls = "bg-blue-100 text-[#111827] ring-2 ring-[#3b82f6]";
            return (
              <button
                key={k}
                type="button"
                onClick={() => click(r, c)}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-bold uppercase transition-colors sm:h-11 sm:w-11 ${cls}`}
              >
                {ch}
              </button>
            );
          })
        )}
      </div>

      {/* Status */}
      <div className="mt-5 flex items-center gap-4 text-sm">
        <span className="text-gray-500">
          {found.length}/{total} found
        </span>
        <button
          type="button"
          onClick={useHint}
          disabled={hintsLeft <= 0 || won}
          className="rounded-full border border-[#111827] px-4 py-1.5 font-semibold text-[#111827] transition-colors hover:bg-gray-100 disabled:opacity-40"
        >
          Hint ({hintsLeft})
        </button>
      </div>
      <p className="mt-2 max-w-xs text-center text-xs text-gray-400">
        Tap the first and last letter of a word. Blue = theme word, yellow =
        spangram.
      </p>

      {/* Found words */}
      {found.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm font-semibold">
          {found.map((f) => (
            <span key={f.word} className={f.isSpangram ? "text-[#eab308]" : "text-[#3b82f6]"}>
              {f.word}
            </span>
          ))}
        </div>
      )}

      {won && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#111827]">🎉 Solved!</h2>
            <p className="mt-2 text-gray-600">
              You found all {total} words in the &ldquo;{puzzle.theme}&rdquo; theme,
              including the spangram{" "}
              <span className="font-bold text-[#eab308]">{puzzle.spangram}</span>.
            </p>
            <a
              href="/play/wordle"
              className="mt-4 block w-full rounded-lg px-6 py-3 font-semibold transition-colors hover:brightness-95"
              style={{ backgroundColor: c.primary, color: c.onPrimary }}
            >
              Play Wordle →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
