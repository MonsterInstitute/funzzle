"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { WORD_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getStreak, markDone, setStatus } from "@/lib/games/kit/daily";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import {
  answerPool,
  boardCandidates,
  gridHint,
  MODE_INFO,
  practiceAnswer,
  practiceEquation,
  quadAnswersFromSeed,
  TEACH,
  type GridHint,
  type GridMode,
  type WordPuzzle,
} from "@/lib/games/word";
import { storageKey, useWordSession, type Finish, type Session } from "./session";
import { boardMarks, initialGrid, keyStates, MAX_HINTS, reducer, solvedAt, status, type GridState } from "./state";
import { Board, Keyboard, Ladder, LETTER_ROWS, markEmoji, MATH_ROWS, ModeNav, show } from "./ui";

const GAME = GAME_BY_SLUG.word;
const HARD_KEY = "fz:word:hard";

type Coach = { hint: GridHint; rung: 1 | 2 | 3; teach?: boolean };

function practicePuzzle(mode: GridMode) {
  return (seed: string): WordPuzzle => ({
    mode,
    answers: mode === "quad" ? quadAnswersFromSeed(seed) : mode === "math" ? [practiceEquation(seed)] : [practiceAnswer(seed)],
  });
}

const gridOf = (mode: GridMode) => (p: WordPuzzle) => initialGrid(mode, p.mode === "geo" ? ["?????"] : p.answers);

/**
 * Funzzle Word's grid modes: classic (/play/word), Quad (/play/word/quad)
 * and Math (/play/word/math). Daily, practice, archive and challenge URL
 * modes come from useWordSession.
 */
export default function WordGame({ mode, date, daily }: { mode: GridMode; date: string; daily: WordPuzzle }) {
  const { session, loaded, startPractice, resumePractice, backToDaily } = useWordSession<GridState>({
    mode,
    date,
    daily,
    init: gridOf(mode),
    practicePuzzle: practicePuzzle(mode),
  });
  if (!loaded) return <Play mode={mode} session={session} date={date} key={`pre-${session.key}`} inert />;
  return (
    <Play
      key={session.key}
      mode={mode}
      session={session}
      date={session.date ?? date}
      onPractice={() => void startPractice()}
      onResumePractice={resumePractice}
      onDaily={backToDaily}
    />
  );
}

function useBoardWidth() {
  const [width, setWidth] = useState(358);
  useEffect(() => {
    const measure = () => setWidth(Math.min(488, window.innerWidth - 32));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return width;
}

function Play({
  mode,
  session,
  date,
  inert = false,
  onPractice,
  onResumePractice,
  onDaily,
}: {
  mode: GridMode;
  session: Session<GridState>;
  date: string;
  inert?: boolean;
  onPractice?: () => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const info = MODE_INFO[mode];
  const key = storageKey(mode, session.kind, date);
  const [state, dispatch] = useReducer(reducer, session.state);
  const [finish, setFinish] = useState<Finish | null>(session.done ?? null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [showRecap, setShowRecap] = useState(!!session.done);
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("word-extra-hint", "word", outOfHints && !finish && !inert);
  const result = status(state);
  const over = result !== "playing";
  const timer = useTimer(!inert && !paused && !over && !finish, session.elapsed);
  const started = useRef(false);
  const width = useBoardWidth();
  const solved = solvedAt(state);
  const rating = getRating("word").rating;
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    session.kind === "practice"
      ? `Practice · ${info.blurb}`
      : `${session.kind === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${info.blurb}`;

  // Hard mode preference applies to a fresh classic board.
  useEffect(() => {
    if (inert || mode !== "classic" || state.guesses.length || finish) return;
    if (readJson<boolean>(HARD_KEY, false) && !state.hard) dispatch({ type: "hard", on: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per board
  }, [inert]);

  // Save progress (and the homepage's "In play" line) on every change.
  useEffect(() => {
    if (inert) return;
    writeJson(key, { ...session, state: { ...state, message: null }, elapsed: timer.now(), done: finish ?? undefined } satisfies Session<GridState>);
    if (mode === "classic" && session.kind === "daily" && !finish && state.guesses.length && !over) {
      setStatus("word", date, { state: "playing", meta: `Guess ${state.guesses.length + 1} of ${state.rows} · ${formatClock(timer.now())}` });
    }
    // timer.now is read on purpose without re-running every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.guesses.length, state.hints, state.reveals.length, state.hard, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "word", { mode: session.kind, variant: mode });
  }, [inert, finish, session.kind, mode]);

  // Finish: rank against today's players (guesses first, then time), rating, stats, Daily Set.
  useEffect(() => {
    if (!over || finish || inert) return;
    const won = result === "won";
    const timeMs = Math.max(1000, Math.round(timer.now()));
    const guesses = state.guesses.length;
    const moves = won ? guesses : state.rows + 1;
    track("game_complete", "word", { mode: session.kind, variant: mode, won, guesses, timeMs, hints: state.hints });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const ratingKey = session.kind === "daily" ? `${mode}:${date}` : `${mode}:practice:${session.seed}`;
      const { rating: r, delta } =
        session.kind === "archive"
          ? { rating: getRating("word").rating, delta: 0 }
          : recordMatch("word", ratingKey, { puzzleRating: WORD_PUZZLE_RATING[mode], won, percentile: percentile ?? undefined, hints: state.hints, mistakes: 0 });
      const skills =
        mode === "classic"
          ? ["solve", guesses <= 4 && "in-four", guesses <= 3 && "in-three", !state.hints && "unaided", state.hard && "hard-mode"]
          : mode === "quad"
            ? ["quad", guesses <= 8 && "quad-eight", !state.hints && "unaided"]
            : ["math", !state.hints && "unaided"];
      recordFinish("word", { won, timeMs, hints: state.hints, level: mode, skills: skills.filter(Boolean) as string[] });
      if (mode === "classic" && session.kind === "daily") {
        // The Daily Set card (homepage) shows "3/6" or "X/6", as before.
        markDone("word", date, { label: won ? `${guesses}/${state.rows}` : `X/${state.rows}`, timeMs, hints: state.hints, ratingDelta: delta });
      }
      setFinish({ won, guesses, timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
    };
    const t = window.setTimeout(() => setShowRecap(true), 1100);
    if (session.kind === "daily") {
      submitResult({ game: "word", variant: mode, date, timeMs, mistakes: 0, hints: state.hints, moves }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else {
      finalize();
    }
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const onKey = useCallback(
    (k: string) => {
      if (inert || over || paused) return;
      if (k === "enter") dispatch({ type: "submit", at: Math.round(timer.now()) });
      else if (k === "back") dispatch({ type: "back" });
      else dispatch({ type: "type", ch: k });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inert, over, paused]
  );

  // Close the coach once the guess it was about is played.
  const played = state.guesses.length;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new guess makes the open hint stale
    setCoach((c) => (c && c.rung < 3 ? null : c));
  }, [played]);

  const openHint = () => {
    if (over || coach || outOfHints) return;
    const hint = gridHint({ mode, answers: state.answers, guesses: state.guesses, reveals: state.reveals, hard: state.hard });
    if (!hint) return;
    dispatch({ type: "hint-used" });
    track("hint_used", "word", { technique: hint.technique, variant: mode, mode: session.kind });
    setCoach({ hint, rung: 1 });
  };

  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  // Keyboard: letters (digits and + - * x / = in Math), Enter, Backspace, ? for a hint.
  useEffect(() => {
    if (inert) return;
    const handler = (e: KeyboardEvent) => {
      if (paused || showRecap || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      if (e.key === "Enter") {
        // Let a focused on-screen button handle its own Enter.
        if (target.closest("button, a")) return;
        e.preventDefault();
        onKey("enter");
      } else if (e.key === "Backspace") {
        onKey("back");
      } else if (e.key === "?") {
        openHint();
      } else {
        const k = mode === "math" && e.key.toLowerCase() === "x" ? "*" : e.key.toLowerCase();
        if (k.length === 1) onKey(k);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (showRecap && finish) {
    return <WordRecap mode={mode} session={session} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Comparing with today’s players…</p>
      </div>
    );
  }

  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const boards = state.answers.length;
  const quad = boards > 1;
  const cols = state.length;
  const gap = quad ? 3 : 6;
  const boardW = quad ? (width - 12) / 2 : width;
  const size = Math.max(22, Math.min(quad ? 34 : 62, Math.floor((boardW - (cols - 1) * gap) / cols)));
  const keys = mode === "math" ? MATH_ROWS : LETTER_ROWS;
  const states = state.answers.map((_, b) => keyStates(state, b));

  return (
    <GameShell
      tint={GAME.tint}
      title={info.title}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>
            Guess {Math.min(state.rows, state.guesses.length + (over ? 0 : 1))} / {state.rows}
          </Chip>
          {mode === "classic" &&
            (state.guesses.length || inert ? (
              <Chip dark={state.hard}>Hard mode {state.hard ? "on" : "off"}</Chip>
            ) : (
              <Chip
                dark={state.hard}
                pressed={state.hard}
                onClick={() => {
                  writeJson(HARD_KEY, !state.hard);
                  dispatch({ type: "hard", on: !state.hard });
                }}
              >
                Hard mode {state.hard ? "on" : "off"}
              </Chip>
            ))}
        </>
      }
    >
      <ModeNav mode={mode} />

      <div className="relative px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <p role="status" aria-live="polite" className={`absolute left-1/2 top-1 z-10 m-0 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ground ${state.message ? "" : "sr-only"}`}>
          {state.message ?? ""}
        </p>
        <div className={quad ? "grid grid-cols-2 gap-3" : "flex justify-center"}>
          {state.answers.map((answer, b) => {
            const marks = boardMarks(state, b);
            const done = solved[b] >= 0;
            return (
              <div key={b} className={`flex flex-col items-center gap-1 ${quad ? `rounded-[14px] p-1 ${done ? "bg-soft" : ""}` : ""}`}>
                <Board
                  label={quad ? `Board ${b + 1}${done ? ", solved" : ""}` : "Guesses"}
                  rows={state.rows}
                  length={cols}
                  guesses={state.guesses}
                  marks={marks}
                  current={over ? null : state.current}
                  reveals={state.reveals.filter((r) => r.board === b)}
                  size={size}
                  solved={done}
                  shake={state.rejected}
                />
                {over && !done && (
                  <p className="m-0 mt-1 rounded-full bg-ink px-3 py-1 font-mono text-sm font-semibold tracking-[0.12em] text-ground">{[...answer].map(show).join("")}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4">
        {coach?.teach ? (
          <CoachCard heading={`Coach · ${TEACH[coach.hint.technique].title}`} tag="How it works" onClose={() => setCoach(null)} primary={{ label: "Back to the hint", onClick: () => setCoach({ ...coach, teach: false }) }}>
            {TEACH[coach.hint.technique].body}
          </CoachCard>
        ) : coach ? (
          <Ladder
            rung={coach.rung}
            tag={coach.hint.title}
            direction={coach.hint.direction}
            specific={coach.hint.specific}
            answer={coach.hint.answer}
            hintsLeft={hintsLeft}
            onMore={() => setCoach({ ...coach, rung: 2 })}
            onAnswer={() => {
              if (coach.hint.reveal) dispatch({ type: "reveal", reveal: coach.hint.reveal });
              setCoach({ ...coach, rung: 3 });
            }}
            onClose={() => setCoach(null)}
            onTeach={() => setCoach({ ...coach, teach: true })}
            action={
              coach.hint.suggestion
                ? {
                    label: `Use ${[...coach.hint.suggestion].map(show).join("")}`,
                    onClick: () => {
                      dispatch({ type: "fill", guess: coach.hint.suggestion! });
                      setCoach(null);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              over
                ? finish
                  ? { label: "See recap", onClick: () => setShowRecap(true) }
                  : undefined
                : hintsLeft
                  ? { label: "Get a hint", onClick: openHint }
                  : bonusOffer.ready
                    ? {
                        label: "Watch an ad for one more hint",
                        onClick: async () => {
                          if (await bonusOffer.watch()) {
                            setBonusHints((n) => n + 1);
                            setHintAfterAd(true);
                          }
                        },
                      }
                    : undefined
            }
          >
            {over
              ? result === "won"
                ? "Solved. Open the recap to see how you did."
                : "Out of guesses. The recap shows the answer and your best deduction."
              : hintsLeft
                ? mode === "math"
                  ? "Stuck? I’ll show what the colors prove about the operators and digits, then the strongest next guess."
                  : "Stuck? I’ll show what your guesses rule out, then the strongest next guess, then a letter."
                : "You’ve used this puzzle’s hints. List what each color proves, then test letters you haven’t tried."}
          </CoachCard>
        )}
      </div>

      <Keyboard rows={keys} states={states} onKey={onKey} disabled={inert || over} />

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          {session.kind === "daily" ? (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice?.();
              }}
            >
              Practice puzzles
            </SheetButton>
          ) : (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                New practice puzzle
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s {info.title}
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
const KEYCAP = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

/** The guess that cut the possibilities the most, for the recap. */
export function keyMove(mode: GridMode, answers: string[], guesses: string[]): { index: number; before: number; after: number } | null {
  const pool = answerPool(mode).length;
  const left = (n: number) => boardCandidates(mode, answers, guesses.slice(0, n)).reduce((a, c) => a + c.length, 0);
  let best: { index: number; before: number; after: number } | null = null;
  let before = pool * answers.length;
  for (let i = 0; i < guesses.length; i++) {
    const after = left(i + 1);
    // Skip a guess that just solved what was already pinned down.
    if (before > 1 && (!best || before / Math.max(1, after) > best.before / Math.max(1, best.after))) best = { index: i, before, after };
    before = after;
  }
  return best;
}

function WordRecap({
  mode,
  session,
  date,
  state,
  finish,
  onClose,
  onPractice,
}: {
  mode: GridMode;
  session: Session<GridState>;
  date: string;
  state: GridState;
  finish: Finish;
  onClose: () => void;
  onPractice?: () => void;
}) {
  const info = MODE_INFO[mode];
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const practice = session.kind === "practice";
  const name = mode === "classic" ? "Funzzle Word" : `Funzzle Word ${info.short}`;
  const scoreText = `${finish.won ? finish.guesses : "X"}/${state.rows}${state.hard ? "*" : ""}`;
  const unit = mode === "math" ? "equations" : "words";

  const coach = useMemo(() => {
    const km = keyMove(mode, state.answers, state.guesses);
    const reveal = finish.won ? "" : `The ${mode === "math" ? "equation" : mode === "quad" ? "words were" : "word"}${mode === "quad" ? "" : " was"} ${state.answers.map((a) => [...a].map(show).join("")).join(", ")}. `;
    let move: string;
    if (finish.won && finish.guesses === 1) move = "you found it on the very first guess. That’s mostly luck, so enjoy it.";
    else if (km) {
      const g = [...state.guesses[km.index]].map(show).join("");
      move = `your ${ORDINAL[km.index]} guess, ${g}, cut ${km.before.toLocaleString("en-US")} possible ${unit} to ${km.after.toLocaleString("en-US")}${mode === "quad" ? " across the four boards" : ""}.`;
    } else move = "you worked through the clues one guess at a time.";
    if (state.hints) move += ` The coach helped ${state.hints} time${state.hints === 1 ? "" : "s"}; next time try spotting the split yourself.`;
    const next =
      mode === "classic"
        ? state.hard
          ? "Quad: four words at once in nine guesses, so every opener has to work for every board."
          : "Hard mode: every guess must reuse what you’ve found. It trains deduction instead of probing. Turn it on before your first guess."
        : mode === "quad"
          ? "Splitting: when several words fit, play the guess that divides them best, even if it can’t be the answer."
          : "Operators first: pin down the = sign and the operators, and the digits follow.";
    const teach = mode === "math" ? TEACH.elimination : TEACH.split;
    return { keyMove: reveal ? `${reveal}${move.charAt(0).toUpperCase()}${move.slice(1)}` : move, nextSkill: next, learn: { title: `Learn ${teach.title.toLowerCase()} in 2 minutes`, body: teach.body } };
  }, [mode, state, finish, unit]);

  const marks = state.answers.map((_, b) => boardMarks(state, b));
  const rowsText =
    mode === "quad"
      ? [0, 2].map((b) => [b, b + 1].map((x) => (solvedAt(state)[x] >= 0 ? KEYCAP[solvedAt(state)[x] + 1] : "🟥")).join(" ")).join("\n")
      : marks[0].map((row) => row.map(markEmoji).join("")).join("\n");
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const text = [
    `${name}${practice ? " practice" : ` · ${short}`} · ${scoreText}`,
    rowsText,
    `${formatTime(finish.timeMs)}${top !== null && session.kind === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `funzzle.com${info.path}`,
  ].join("\n");
  const imageParams = new URLSearchParams({
    g: "word",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(state.hints),
    lv: practice ? `${info.short} practice` : info.short,
    gs: `${finish.won ? finish.guesses : "X"}/${state.rows}`,
    map: marks.map((rows) => rows.map((r) => r.join("")).join("-")).join("_"),
  });
  if (top !== null && session.kind === "daily") imageParams.set("top", String(top));
  const label = practice ? `${name} practice` : `${name} · ${short}`;

  return (
    <Recap
      game="word"
      heading={`${name}${practice ? " practice" : ` · ${short}${session.kind === "archive" ? " · archive" : ""}`}`}
      title={finish.won ? "Solved." : "So close."}
      timeMs={finish.timeMs}
      percentile={session.kind === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      rankWord="Better"
      tiles={[
        { label: "Guesses", value: scoreText.replace("*", ""), note: finish.won ? (state.hard ? "Hard mode" : `of ${state.rows}`) : "Out of guesses", good: finish.won && finish.guesses <= state.rows - 2 },
        { label: "Hints", value: String(state.hints), note: `of ${MAX_HINTS} used`, good: !state.hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: session.kind === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${session.kind === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: practice ? { kind: "practice", seed: session.seed, level: mode } : { kind: "daily", date, variant: mode },
        label,
        result: { timeMs: finish.timeMs, mistakes: 0, hints: state.hints, moves: finish.won ? finish.guesses : state.rows + 1 },
        activeId: session.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={
        onPractice && (
          <PracticeAction
            game="word"
            href={`${info.path}?practice=1`}
            label={mode === "math" ? "Play a practice equation" : mode === "quad" ? "Play a practice Quad" : "Play a practice word"}
          />
        )
      }
    />
  );
}
