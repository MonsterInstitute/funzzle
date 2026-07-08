"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type DailyCountry,
  distanceKm,
  directionArrow,
  proximityPct,
} from "@/lib/worldle";
import { gameColor } from "@/lib/gameColors";

const c = gameColor("worldle");

interface GuessCountry {
  name: string;
  lat: number;
  lng: number;
}

const MAX = 6;

export default function WorldleGame({
  answer,
  countries,
  date,
}: {
  answer: DailyCountry;
  countries: GuessCountry[];
  date: string;
}) {
  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<
    { name: string; km: number; arrow: string; pct: number; correct: boolean }[]
  >([]);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const byName = useMemo(() => {
    const m = new Map<string, GuessCountry>();
    for (const c of countries) m.set(c.name.toLowerCase(), c);
    return m;
  }, [countries]);

  const won = guesses.some((g) => g.correct);
  const over = won || guesses.length >= MAX;

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1600);
  }, []);

  const guess = useCallback(() => {
    if (over) return;
    const c = byName.get(input.trim().toLowerCase());
    if (!c) return flash("Unknown country");
    if (guesses.some((g) => g.name === c.name)) return flash("Already guessed");
    const km = distanceKm(c, answer);
    const correct = c.name.toLowerCase() === answer.name.toLowerCase();
    setGuesses((g) => [
      ...g,
      {
        name: c.name,
        km,
        arrow: correct ? "🎯" : directionArrow(c, answer),
        pct: proximityPct(km),
        correct,
      },
    ]);
    setInput("");
  }, [over, byName, input, guesses, answer, flash]);

  const shareText = useMemo(() => {
    const rows = guesses
      .map((g) => {
        const blocks = Math.round(g.pct / 20);
        return "🟩".repeat(blocks) + "⬜".repeat(5 - blocks) + " " + g.arrow;
      })
      .join("\n");
    return `Funzzle Worldle ${date} ${won ? guesses.length : "X"}/${MAX}\n${rows}\nfunzzle.com`;
  }, [guesses, won, date]);

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

      {/* Silhouette */}
      <div className="rounded-xl border border-[#e5e7eb] p-6">
        <svg viewBox="0 0 100 100" className="h-44 w-44" aria-label="Country silhouette">
          <path d={answer.svg} fill="#111827" />
        </svg>
      </div>

      {/* Guess input */}
      {!over && (
        <div className="mt-5 flex w-full max-w-sm gap-2">
          <input
            list="country-list"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guess()}
            placeholder="Guess a country"
            className="flex-1 rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none"
            onFocus={(e) => (e.currentTarget.style.borderColor = c.primary)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
          />
          <datalist id="country-list">
            {countries.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={guess}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:brightness-95"
            style={{ backgroundColor: c.primary, color: c.onPrimary }}
          >
            Guess
          </button>
        </div>
      )}

      <p className="mt-3 text-sm text-gray-500">
        {guesses.length}/{MAX} guesses
      </p>

      {/* Guess rows */}
      <div className="mt-3 w-full max-w-sm space-y-2">
        {guesses.map((g, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            style={
              g.correct
                ? { borderColor: c.primary, backgroundColor: c.tint }
                : { borderColor: "#e5e7eb" }
            }
          >
            <span className="font-semibold text-[#111827]">{g.name}</span>
            <span className="flex items-center gap-3 text-gray-600">
              {!g.correct && <span>{g.km.toLocaleString()} km</span>}
              <span>{g.arrow}</span>
              <span className="font-medium" style={{ color: c.text }}>{g.pct}%</span>
            </span>
          </div>
        ))}
      </div>

      {over && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#111827]">
              {won ? "🎉 Correct!" : "Out of guesses"}
            </h2>
            <p className="mt-2 text-gray-600">
              The country was <span className="font-bold" style={{ color: c.text }}>{answer.name}</span>.
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
