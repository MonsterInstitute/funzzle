"use client";

import { useEffect, useState } from "react";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import type { DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { MODE_INFO, WORD_MODES, type DailyWord, type WordMode, type WordPuzzle } from "@/lib/games/word/modes";

/** How a finished game went (saved with the session so the recap comes back). */
export interface Finish {
  won: boolean;
  /** Guesses used. */
  guesses: number;
  timeMs: number;
  percentile?: number | null;
  stats?: DayStats | null;
  ratingDelta: number;
  rating: number;
  streak: number;
}

/**
 * One play of a mode: today's daily, a past day's daily (/archive, unranked),
 * or a practice puzzle from a seed. Saved in local storage per kind.
 */
export interface Session<S> {
  key: string;
  kind: "daily" | "practice" | "archive";
  /** The archive puzzle's date. */
  date?: string;
  /** Opened from a friend's challenge link (lib/games/kit/challenge.ts). */
  challengeId?: string;
  seed: string;
  puzzle: WordPuzzle;
  state: S;
  elapsed: number;
  done?: Finish;
}

export const storageKey = (mode: WordMode, kind: Session<unknown>["kind"], date: string) =>
  kind === "practice" ? `fz:word:${mode}:practice` : `fz:word:${mode}:${kind}:${date}`;

const puzzleKey = (p: WordPuzzle) => (p.mode === "geo" ? p.slug : p.answers.join(","));

/**
 * URL modes shared by every Funzzle Word screen: ?practice=1 starts a new
 * practice puzzle, ?date= opens an archive day, ?challenge= a friend's
 * challenge (redirecting to the right mode's page if needed); otherwise
 * today's daily, restored from local storage.
 */
export function useWordSession<S>({
  mode,
  date,
  daily,
  init,
  practicePuzzle,
}: {
  mode: WordMode;
  date: string;
  daily: WordPuzzle;
  init: (p: WordPuzzle) => S;
  practicePuzzle: (seed: string) => WordPuzzle | Promise<WordPuzzle>;
}) {
  const dailyKey = `${date}:${puzzleKey(daily)}`;
  const fresh = (): Session<S> => ({ key: dailyKey, kind: "daily", seed: `word:${mode}:${date}`, puzzle: daily, state: init(daily), elapsed: 0 });
  const [session, setSession] = useState<Session<S>>(fresh);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    const done = () => setLoaded(true);
    if (params.get("practice")) {
      history.replaceState(null, "", location.pathname);
      startPractice().finally(done);
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then(async (c) => {
          if (c.game !== "word") throw new Error("not a word challenge");
          const p = c.puzzle;
          const want = (p.kind === "practice" ? p.level : p.variant || "classic") as WordMode;
          if (WORD_MODES.includes(want) && want !== mode) {
            location.replace(`${MODE_INFO[want].path}?challenge=${challengeId}`);
            return;
          }
          if (p.kind === "practice") return openPractice(p.seed, challengeId);
          if (p.date === date) return openDaily(challengeId);
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily())
        .finally(done);
    } else if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      openArchive(archiveDate).finally(done);
    } else {
      openDaily();
      done();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [date, dailyKey]);

  function openDaily(challengeId?: string) {
    const saved = readJson<Session<S> | null>(storageKey(mode, "daily", date), null);
    if (saved && saved.key === dailyKey) setSession(challengeId ? { ...saved, challengeId } : saved);
    else if (challengeId) setSession((s) => ({ ...s, challengeId }));
  }

  /** A past day's daily puzzle: the stored row, or regenerated from its seed. */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Session<S> | null>(storageKey(mode, "archive", day), null);
    if (saved && saved.date === day && !challengeId) return setSession(saved);
    try {
      const res = await fetch(`/api/daily-puzzle?game=word&mode=${mode}&date=${day}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(String(res.status));
      const { puzzle } = (await res.json()) as DailyWord;
      setSession({ key: `archive:${day}`, kind: "archive", date: day, challengeId, seed: `word:${mode}:${day}`, puzzle, state: init(puzzle), elapsed: 0 });
    } catch {
      openDaily();
    }
  }

  async function openPractice(seed: string, challengeId: string) {
    const puzzle = await practicePuzzle(seed);
    setSession({ key: `${seed}:${challengeId}`, kind: "practice", seed, challengeId, puzzle, state: init(puzzle), elapsed: 0 });
  }

  async function startPractice() {
    countPractice("word");
    const seed = `word-${mode}-practice:${crypto.randomUUID()}`;
    const puzzle = await practicePuzzle(seed);
    const next: Session<S> = { key: seed, kind: "practice", seed, puzzle, state: init(puzzle), elapsed: 0 };
    writeJson(storageKey(mode, "practice", date), next);
    setSession(next);
  }

  function resumePractice() {
    const saved = readJson<Session<S> | null>(storageKey(mode, "practice", date), null);
    if (saved && !saved.done) setSession(saved);
    else void startPractice();
  }

  function backToDaily() {
    const saved = readJson<Session<S> | null>(storageKey(mode, "daily", date), null);
    setSession(saved && saved.key === dailyKey ? saved : fresh());
  }

  return { session, loaded, startPractice, resumePractice, backToDaily };
}
