"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { LETTER_BOX_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { boxHint, sideMap, wordMask, type BoxHint, type LetterBoxPuzzle } from "@/lib/games/letterbox";
import { canTap, initialState, isSolved, MAX_HINTS, pathPositions, reducer, usedPositions, type BoxState } from "./state";

/**
 * Letter Box (design: Game Kit, like components/sudoku/SudokuGame). A daily
 * ends when every letter is used; results rank by words used, then time.
 */

interface Saved {
  key: string;
  mode: "daily" | "practice" | "archive";
  date?: string;
  challengeId?: string;
  /** Practice seed id (the API's ?practice=), or the daily seed. */
  seed: string;
  state: BoxState;
  elapsed: number;
  done?: Finish;
}

interface Finish {
  timeMs: number;
  words: number;
  percentile?: number | null;
  stats?: DayStats | null;
  ratingDelta: number;
  rating: number;
  streak: number;
}

const SLUG = "letter-box";
const GAME = GAME_BY_SLUG[SLUG];
const DAILY_KEY = (date: string) => `fz:${SLUG}:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:${SLUG}:archive:${date}`;
const PRACTICE_KEY = `fz:${SLUG}:practice`;

/** `chain` is the words played when the hint was given: playing on makes it stale. */
type Coach = { hint: BoxHint; rung: 1 | 2 | 3; chain: string };

async function fetchPuzzle(query: string): Promise<LetterBoxPuzzle> {
  const res = await fetch(`/api/daily-puzzle?game=${SLUG}&${query}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`puzzle ${res.status}`);
  return (await res.json()) as LetterBoxPuzzle;
}

export default function LetterBoxGame({ date, daily }: { date: string; daily: LetterBoxPuzzle }) {
  const dailyKey = `${date}:${daily.sides.join("")}`;
  const fresh = (): Saved => ({ key: dailyKey, mode: "daily", seed: `${SLUG}:${date}`, state: initialState(daily), elapsed: 0 });
  const [game, setGame] = useState<Saved>(fresh);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    let job: Promise<unknown> | null = null;
    if (want) {
      history.replaceState(null, "", location.pathname);
      job = startPractice();
    } else if (challengeId) {
      job = fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== SLUG) throw new Error("not a letter box challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed, challengeId);
          if (p.date === date) return openDaily(challengeId);
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily());
    } else if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      job = openArchive(archiveDate);
    } else {
      openDaily();
    }
    if (job) {
      job.finally(() => setLoaded(true));
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage / URL
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [date, dailyKey]);

  function openDaily(challengeId?: string) {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    if (saved && saved.key === dailyKey) setGame(challengeId ? { ...saved, challengeId } : saved);
    else if (challengeId) setGame((g) => ({ ...g, challengeId }));
  }

  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setGame(saved);
    try {
      const p = await fetchPuzzle(`date=${day}`);
      setGame({ key: `archive:${day}`, mode: "archive", date: day, challengeId, seed: `${SLUG}:${day}`, state: initialState(p), elapsed: 0 });
    } catch {
      openDaily();
    }
  }

  async function openPractice(seed: string, challengeId: string) {
    const p = await fetchPuzzle(`practice=${encodeURIComponent(seed)}`);
    setGame({ key: `${seed}:${challengeId}`, mode: "practice", seed, challengeId, state: initialState(p), elapsed: 0 });
  }

  async function startPractice() {
    setBusy(true);
    try {
      const seed = crypto.randomUUID();
      const p = await fetchPuzzle(`practice=${seed}`);
      countPractice(SLUG);
      const next: Saved = { key: seed, mode: "practice", seed, state: initialState(p), elapsed: 0 };
      writeJson(PRACTICE_KEY, next);
      setGame(next);
    } catch {
      // Offline or the API is down: stay on the current box.
    } finally {
      setBusy(false);
    }
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else void startPractice();
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey ? saved : fresh());
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Board key={game.key} game={game} date={game.date ?? date} busy={busy} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

function Board({
  game,
  date,
  inert = false,
  busy = false,
  onPractice,
  onResumePractice,
  onDaily,
}: {
  game: Saved;
  date: string;
  inert?: boolean;
  busy?: boolean;
  onPractice?: () => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer(reducer, game.state);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer(`${SLUG}-extra-hint`, SLUG, outOfHints && !finish && !inert);
  const complete = isSolved(state);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  const rating = getRating(SLUG).rating;
  const p = state.puzzle;
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? `Practice · Par ${p.par}`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · Par ${p.par}`;
  const locked = complete || !!finish || inert;

  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer.now is read on purpose without re-running every tick
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", SLUG, { mode: game.mode });
  }, [inert, finish, game.mode]);

  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const words = state.words.length;
    const base = { hints: state.hints, mistakes: Math.max(0, words - p.par) };
    track("game_complete", SLUG, { mode: game.mode, timeMs, words, par: p.par, hints: state.hints });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      const { rating: rt, delta } =
        game.mode === "archive"
          ? { rating: getRating(SLUG).rating, delta: 0 }
          : recordMatch(SLUG, key, { puzzleRating: LETTER_BOX_PUZZLE_RATING, won: true, percentile: percentile ?? undefined, ...base });
      const onPar = words <= p.par;
      const skills = [
        "solve",
        onPar ? "par" : "",
        !state.hints ? "unaided" : "",
        state.words.some((w) => w.length >= 8) ? "long-word" : "",
        timeMs < 180_000 ? "fast" : "",
        onPar && !state.hints ? "par-unaided" : "",
      ].filter(Boolean);
      recordFinish(SLUG, { won: true, timeMs, hints: state.hints, level: `${words}-words`, skills });
      setFinish({ timeMs, words, percentile, stats, ratingDelta: delta, rating: rt, streak: getStreak().current });
      setLoadingStats(false);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- completion is detected from state
    setShowRecap(true);
    setCoach(null);
    if (game.mode === "daily") {
      setLoadingStats(true);
      submitResult({ game: SLUG, date, timeMs, mistakes: state.mistakes, hints: state.hints, moves: words }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const at = () => Math.round(timer.now());
  const submit = () => {
    if (locked) return;
    dispatch({ type: "submit", at: at() });
    if (coach?.rung === 3) setCoach(null);
  };

  const openHint = () => {
    if (locked || coach || outOfHints) return;
    const hint = boxHint(p, state.words);
    if (!hint) return;
    dispatch({ type: "hint-used" });
    track("hint_used", SLUG, { mode: game.mode, restart: hint.restart });
    setCoach({ hint, rung: 1, chain: state.words.join(" ") });
  };

  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  // A hint is about the chain it was given for: playing on makes it stale.
  useEffect(() => {
    if (coach && coach.chain !== state.words.join(" ")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the chain moved on
      setCoach(null);
    }
  }, [coach, state.words]);

  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap || locked) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        dispatch({ type: "tap", letter: e.key });
      } else if (e.key === "Backspace") {
        e.preventDefault();
        dispatch({ type: "delete" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <BoxRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Solved! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const lettersLeft = 12 - usedPositions(state).size;

  return (
    <GameShell
      tint={GAME.tint}
      title="Letter Box"
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>
            {state.words.length} word{state.words.length === 1 ? "" : "s"} · par {p.par}
          </Chip>
          <Chip>{lettersLeft} letters left</Chip>
        </>
      }
    >
      <div className="flex flex-col items-center gap-1 px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div aria-live="polite" className="flex min-h-[44px] items-center justify-center font-display text-[30px] font-bold tracking-[0.04em]">
          {state.current ? (
            state.current.split("").map((ch, i) => (
              <span key={i} className={i === 0 && state.words.length ? "text-muted-2" : ""}>
                {ch.toUpperCase()}
              </span>
            ))
          ) : (
            <span className="text-base font-semibold text-muted">{complete ? "Solved" : "Tap letters to spell a word"}</span>
          )}
        </div>
        <p className="m-0 min-h-5 text-center text-sm text-muted" aria-label="Words played">
          {state.words.map((w) => w.toUpperCase()).join(" – ")}
        </p>
        <Toast message={state.message} />
      </div>

      <div className="flex justify-center px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <Square state={state} disabled={locked} onLetter={(l) => dispatch({ type: "tap", letter: l })} />
      </div>

      <div className="grid grid-cols-3 gap-2 px-4">
        <PillButton label="Delete" onClick={() => dispatch({ type: "delete" })} disabled={locked || (!state.current && !state.words.length)} />
        <PillButton label="Restart" onClick={() => dispatch({ type: "restart" })} disabled={locked || (!state.current && !state.words.length)} />
        <PillButton label="Enter" onClick={submit} disabled={locked || state.current.length < 3} dark />
      </div>

      <div className="px-4">
        {coach ? (
          <BoxCoach
            coach={coach}
            hintsLeft={hintsLeft}
            onMore={() => setCoach({ ...coach, rung: 2 })}
            onReveal={() => setCoach({ ...coach, rung: 3 })}
            onPlay={() => {
              dispatch({ type: "play", word: coach.hint.word, restart: coach.hint.restart, at: at() });
              setCoach(null);
            }}
            onClose={() => setCoach(null)}
          />
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              hintsLeft && !locked
                ? { label: "Get a hint", onClick: openHint }
                : !locked && bonusOffer.ready
                  ? {
                      label: "Watch an ad for one more hint",
                      onClick: async () => {
                        if (await bonusOffer.watch()) {
                          setBonusHints((b) => b + 1);
                          setHintAfterAd(true);
                        }
                      },
                    }
                  : undefined
            }
          >
            {finish
              ? "Solved. Open the recap to see how you did."
              : hintsLeft
                ? `Stuck? I’ll find a shortest way through: a good letter to start from, then the next word’s shape, then the word. Par is ${p.par} words.`
                : "You’ve used your three hints. Try a long word that ends on a common starting letter."}
          </CoachCard>
        )}
      </div>

      <div className={`grid gap-2 px-4 ${finish ? "grid-cols-2" : "grid-cols-1"}`}>
        <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={openHint} disabled={!hintsLeft || !!coach || locked} />
        {finish && (
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] rounded-[14px] bg-ink text-sm font-semibold text-ground">
            See recap
          </button>
        )}
      </div>

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          {game.mode === "daily" ? (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice?.();
              }}
            >
              Practice boxes
            </SheetButton>
          ) : (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                {busy ? "Loading…" : "New practice box"}
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Letter Box
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function PillButton({ label, onClick, disabled, dark }: { label: string; onClick: () => void; disabled?: boolean; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[52px] rounded-full text-[15px] font-semibold transition-opacity disabled:opacity-40 ${dark ? "bg-ink text-ground" : "border border-line-strong text-ink"}`}
    >
      {label}
    </button>
  );
}

function Toast({ message }: { message: BoxState["message"] }) {
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!message) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new message shows for a moment
    setShown(message.id);
    const t = setTimeout(() => setShown(null), 1800);
    return () => clearTimeout(t);
  }, [message]);
  const visible = message && shown === message.id;
  return (
    <div className="flex h-8 items-center" role="status" aria-live="polite">
      {visible && (
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${message.tone === "bad" ? "bg-soft-2 text-ink" : "text-[#111111]"}`} style={message.tone === "good" ? { background: GAME.color } : undefined}>
          {message.text}
        </span>
      )}
    </div>
  );
}

/** Board geometry in a 330-unit viewBox: the square and the 12 letter spots. */
const VB = 330;
const INSET = 56;
const SIDE = VB - 2 * INSET;
const along = (k: number) => INSET + (SIDE * (k + 0.5)) / 3;
const LABEL = 30;

/** Dot (on the square) and label (outside it) for box position i (side = i / 3). */
function spot(i: number): { dot: [number, number]; label: [number, number] } {
  const side = Math.floor(i / 3);
  const t = along(i % 3);
  if (side === 0) return { dot: [t, INSET], label: [t, INSET - LABEL] };
  if (side === 1) return { dot: [INSET + SIDE, t], label: [INSET + SIDE + LABEL, t] };
  if (side === 2) return { dot: [t, INSET + SIDE], label: [t, INSET + SIDE + LABEL] };
  return { dot: [INSET, t], label: [INSET - LABEL, t] };
}

const SIDE_NAMES = ["top", "right", "bottom", "left"];

function Square({ state, disabled, onLetter }: { state: BoxState; disabled: boolean; onLetter: (l: string) => void }) {
  const all = state.puzzle.sides.join("");
  const committed = pathPositions(state);
  const full = pathPositions(state, state.current);
  const used = new Set(full);
  const last = full[full.length - 1];
  const pts = (list: number[]) => list.map((i) => spot(i).dot.join(",")).join(" ");
  const pending = full.slice(Math.max(0, committed.length - 1));
  const sides = sideMap(state.puzzle.sides);
  return (
    <div className="relative aspect-square w-full max-w-[340px]">
      <svg viewBox={`0 0 ${VB} ${VB}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect x={INSET} y={INSET} width={SIDE} height={SIDE} rx="6" fill="var(--ground)" stroke="var(--ink)" strokeWidth="3" />
        {committed.length > 1 && <polyline points={pts(committed)} fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />}
        {pending.length > 1 && (
          <polyline points={pts(pending)} fill="none" stroke="#E0525E" strokeWidth="3.5" strokeDasharray="7 6" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {Array.from({ length: 12 }, (_, i) => {
          const [x, y] = spot(i).dot;
          const isLast = i === last;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isLast ? 9 : 7.5}
              fill={isLast ? GAME.color : used.has(i) ? "var(--ink)" : "var(--ground)"}
              stroke="var(--ink)"
              strokeWidth="2.5"
            />
          );
        })}
      </svg>
      {all.split("").map((ch, i) => {
        const [x, y] = spot(i).label;
        const ok = !disabled && canTap(state, ch);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onLetter(ch)}
            disabled={!ok}
            aria-label={`${ch.toUpperCase()}, ${SIDE_NAMES[sides.get(ch) ?? 0]} side${used.has(i) ? ", used" : ""}`}
            className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-display text-[24px] font-extrabold transition-opacity ${used.has(i) ? "text-muted-2" : "text-ink"} ${ok ? "" : "opacity-45"}`}
            style={{ left: `${(x / VB) * 100}%`, top: `${(y / VB) * 100}%` }}
          >
            {ch.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function BoxCoach({
  coach,
  hintsLeft,
  onMore,
  onReveal,
  onPlay,
  onClose,
}: {
  coach: Coach;
  hintsLeft: number;
  onMore: () => void;
  onReveal: () => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  const { hint, rung } = coach;
  const tag = hint.restart ? "Fresh start" : "Shortest path";
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }}>
        {hint.nudge}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={{ label: "Show the word", onClick: onReveal }}>
        <span className="block font-mono text-xl font-semibold tracking-[0.12em]" aria-label={`Pattern: ${hint.patternText}`}>
          {hint.pattern}
        </span>
        <span className="mt-1 block">{hint.patternText}</span>
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: hint.restart ? "Restart and play it" : "Play it", onClick: onPlay }} secondary={{ label: "I’ll type it", onClick: onClose }}>
      {hint.answer}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this box.</span>}
    </CoachCard>
  );
}

// ---------------------------------------------------------------------------
// Recap
// ---------------------------------------------------------------------------

function BoxRecap({
  game,
  date,
  state,
  finish,
  onClose,
  onPractice,
}: {
  game: Saved;
  date: string;
  state: BoxState;
  finish: Finish;
  onClose: () => void;
  onPractice?: () => void;
}) {
  const p = state.puzzle;
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const onPar = finish.words <= p.par;

  const coach = useMemo(() => {
    const own = state.words.map((w, i) => ({ w, i })).filter(({ w }) => !state.coached.includes(w));
    const cover = (w: string) => {
      let n = 0;
      for (let m = wordMask(w, p.sides); m; m &= m - 1) n++;
      return n;
    };
    const best = [...own].sort((a, b) => cover(b.w) - cover(a.w) || b.w.length - a.w.length)[0];
    const keyMove = best
      ? `${state.playedAt[best.i] ? `at ${formatTime(state.playedAt[best.i])} ` : ""}you played ${best.w.toUpperCase()}, covering ${cover(best.w)} of the 12 letters.`
      : "the coach supplied your words this time. Next box, try finding the long first word yourself.";
    const solution = p.solution.map((w) => w.toUpperCase()).join(" – ");
    const nextSkill = !onPar
      ? `Solving in par. Today’s box has a ${p.par}-word solution: start with a long word that ends on a letter many words begin with.`
      : state.hints
        ? "Par without the coach. Look for the long first word on your own next time."
        : finish.timeMs > 180_000
          ? "Speed. You solved it in par; next, try it in under 3 minutes."
          : "You’ve got the box down: par, unaided and quick. Try a practice box for another.";
    return {
      keyMove,
      nextSkill,
      learn: {
        title: onPar ? "Another way through" : `See a ${p.par}-word solution`,
        body: (
          <p className="m-0">
            <strong className="font-mono">{solution}</strong>. The first word grabs as many letters as it can; the second starts on its last letter and picks up the rest.
          </p>
        ),
      },
    };
  }, [state, p, onPar, finish.timeMs]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const path = pathPositions(state)
    .map((i) => i.toString(16))
    .join("")
    .slice(0, 80);
  const imageParams = new URLSearchParams({
    g: SLUG,
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(state.hints),
    w: String(finish.words),
    lv: game.mode === "practice" ? `Practice · Par ${p.par}` : `Par ${p.par}`,
  });
  if (path.length >= 2) imageParams.set("p", path);
  if (top !== null && game.mode === "daily") imageParams.set("top", String(top));
  const text = [
    `Funzzle Letter Box${game.mode === "practice" ? " practice" : ""} · ${short}`,
    `${finish.words} word${finish.words === 1 ? "" : "s"} (par ${p.par}) · ${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${state.hints} hint${state.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/letter-box",
  ].join("\n");

  return (
    <Recap
      game={SLUG}
      heading={game.mode === "practice" ? "Letter Box practice" : `Letter Box · ${short}${game.mode === "archive" ? " · archive" : ""}`}
      title={finish.words === 1 ? "Solved in 1." : `Solved in ${finish.words}.`}
      beatText="Beat"
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Words", value: String(finish.words), note: onPar ? `Par ${p.par}` : `Par is ${p.par}`, good: onPar },
        { label: "Hints", value: String(state.hints), note: `of ${MAX_HINTS} used`, good: !state.hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: game.seed, level: "standard" } : { kind: "daily", date },
        label: game.mode === "practice" ? "Letter Box practice" : `Letter Box · ${short}`,
        result: { timeMs: finish.timeMs, mistakes: state.mistakes, hints: state.hints, moves: finish.words },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game={SLUG} href={`/play/${SLUG}?practice=new`} label="Play a practice box" />}
    />
  );
}

