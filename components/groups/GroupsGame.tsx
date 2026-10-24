"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import {
  BANK_BY_ID,
  earnedSkills,
  hintFor,
  initialOrder,
  isPuzzle,
  LEARN,
  LEVEL_COLOR,
  LEVEL_NAME,
  nextSkill,
  practicePick,
  type GroupsHint,
  type GroupsPuzzle,
} from "@/lib/games/groups";
import { GROUPS_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { gameStats, recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { guessMap, guessRows, initialState, isOver, isWon, MAX_HINTS, MAX_MISTAKES, reducer, type PlayState } from "./state";

interface Saved {
  key: string;
  /** archive = a past day's daily puzzle (/archive): unranked. */
  mode: "daily" | "practice" | "archive";
  /** The archive puzzle's date. */
  date?: string;
  /** Opened from a friend's challenge link (lib/games/kit/challenge.ts). */
  challengeId?: string;
  state: PlayState;
  elapsed: number;
  done?: Finish;
}

interface Finish {
  won: boolean;
  timeMs: number;
  percentile?: number | null;
  stats?: DayStats | null;
  ratingDelta: number;
  rating: number;
  streak: number;
  skills: string[];
}

const GAME = GAME_BY_SLUG.groups;
const DAILY_KEY = (date: string) => `fz:groups:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:groups:archive:${date}`;
const PRACTICE_KEY = "fz:groups:practice";
const PLAYED_KEY = "fz:groups:practice-played";
const PRACTICE_SEED = (id: string) => `groups-practice:${id}`;
const ORDINAL = ["1st", "2nd", "3rd", "4th"];

const fresh = (puzzle: GroupsPuzzle, seed: string) => initialState(puzzle, initialOrder(puzzle, seed));
const dailySaved = (date: string, puzzle: GroupsPuzzle): Saved => ({ key: `${date}:${puzzle.id}`, mode: "daily", state: fresh(puzzle, `groups:${date}`), elapsed: 0 });

export default function GroupsGame({ date, daily }: { date: string; daily: GroupsPuzzle }) {
  const dailyKey = `${date}:${daily.id}`;
  const [game, setGame] = useState<Saved>(() => dailySaved(date, daily));
  const [loaded, setLoaded] = useState(false);

  // Restore saved progress / open the URL's mode after hydration.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (params.get("practice")) {
      history.replaceState(null, "", location.pathname);
      startPractice();
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== "groups") throw new Error("not a groups challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed, challengeId);
          if (p.date === date) return openDaily(challengeId);
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily())
        .finally(() => setLoaded(true));
      return;
    } else if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      openArchive(archiveDate).finally(() => setLoaded(true));
      return;
    } else {
      openDaily();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from local storage / URL
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, [date, dailyKey]);

  function openDaily(challengeId?: string) {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    if (saved && saved.key === dailyKey && isPuzzle(saved.state?.puzzle)) setGame(challengeId ? { ...saved, challengeId } : saved);
    else if (challengeId) setGame((g) => ({ ...g, challengeId }));
  }

  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId && isPuzzle(saved.state?.puzzle)) return setGame(saved);
    try {
      const res = await fetch(`/api/daily-puzzle?game=groups&date=${day}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(String(res.status));
      const { puzzle } = (await res.json()) as { puzzle: GroupsPuzzle };
      if (!isPuzzle(puzzle)) throw new Error("bad puzzle");
      setGame({ key: `archive:${day}`, mode: "archive", date: day, challengeId, state: fresh(puzzle, `groups:${day}`), elapsed: 0 });
    } catch {
      openDaily();
    }
  }

  function openPractice(seed: string, challengeId?: string) {
    const puzzle = BANK_BY_ID[seed.replace(/^groups-practice:/, "")];
    if (!puzzle) return openDaily(challengeId);
    setGame({ key: `${seed}:${challengeId ?? ""}`, mode: "practice", challengeId, state: fresh(puzzle, seed), elapsed: 0 });
  }

  function startPractice() {
    countPractice("groups");
    const played = readJson<string[]>(PLAYED_KEY, []);
    const puzzle = practicePick(date, played, Math.random);
    writeJson(PLAYED_KEY, [...played.filter((id) => id !== puzzle.id), puzzle.id].slice(-200));
    const seed = PRACTICE_SEED(puzzle.id);
    const next: Saved = { key: `${seed}:${crypto.randomUUID()}`, mode: "practice", state: fresh(puzzle, seed), elapsed: 0 };
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done && isPuzzle(saved.state?.puzzle)) setGame(saved);
    else startPractice();
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey && isPuzzle(saved.state?.puzzle) ? saved : dailySaved(date, daily));
  };

  if (!loaded) return <Board game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Board key={game.key} game={game} date={game.date ?? date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

type Coach = { hint: GroupsHint; rung: 1 | 2 | 3 };

const FEEDBACK: Record<string, string> = {
  "one-away": "One away…",
  wrong: "Not a group. Try again.",
  already: "Already guessed",
  correct: "",
};

function Board({
  game,
  date,
  inert = false,
  onPractice,
  onResumePractice,
  onDaily,
}: {
  game: Saved;
  date: string;
  inert?: boolean;
  onPractice?: () => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer(reducer, game.state);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("groups-extra-hint", "groups", outOfHints && !finish && !inert);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [cursor, setCursor] = useState(0);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const over = isOver(state);
  const timer = useTimer(!inert && !paused && !over && !finish, game.elapsed);
  const started = useRef(false);
  const rating = getRating("groups").rating;
  const puzzle = state.puzzle;
  const day = new Date(`${date}T00:00:00Z`);
  const dayLabel = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const subtitle = game.mode === "practice" ? "Practice" : game.mode === "archive" ? `Archive · ${dayLabel}` : `${dayLabel} · Daily`;
  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);

  // Save progress on every change.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // timer.now is read on purpose without re-running every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "groups", { mode: game.mode });
  }, [inert, finish, game.mode]);

  // Submit feedback: a short message, and a shake for a miss.
  useEffect(() => {
    const f = state.feedback;
    if (!f || inert) return;
    const text = FEEDBACK[f.kind];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the reducer's feedback
    setToast(text || null);
    if (f.kind === "one-away" || f.kind === "wrong") setShake((n) => n + 1);
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [state.feedback, inert]);

  // A coach hint about a group the player has just found is no longer needed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the coach when its group is gone
    if (coach && coach.rung < 3 && state.solved.includes(coach.hint.group)) setCoach(null);
  }, [coach, state.solved]);

  // Finish: rating, stats/skills, today's rank (wins only), then the recap.
  useEffect(() => {
    if (!over || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const won = isWon(state);
    const base = { hints: state.hints, mistakes: state.mistakes };
    track("game_complete", "groups", { mode: game.mode, won, mistakes: state.mistakes, hints: state.hints, timeMs });
    const skills = earnedSkills({ won, ...base, timeMs, solveOrder: state.solved, coached: state.coached });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.key}`;
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating("groups").rating, delta: 0 }
          : recordMatch("groups", key, { puzzleRating: GROUPS_PUZZLE_RATING, won, percentile: percentile ?? undefined, ...base });
      recordFinish("groups", { won, timeMs, hints: base.hints, level: game.mode, skills });
      setFinish({ won, timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current, skills });
    };
    // Let the last group (or the reveal) land before the recap opens.
    const open = setTimeout(() => setShowRecap(true), won ? 700 : 1600);
    if (game.mode === "daily" && won) {
      submitResult({ game: "groups", date, timeMs, ...base }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else {
      finalize();
    }
    return () => clearTimeout(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const at = () => Math.round(timer.now());
  const submit = () => {
    if (state.selected.length === 4 && !over) dispatch({ type: "submit", at: at() });
  };
  const shuffle = () => dispatch({ type: "shuffle", seed: Math.floor(Math.random() * 2 ** 32) });
  const deselect = () => dispatch({ type: "deselect" });

  const openHint = () => {
    if (finish || over || coach || outOfHints) return;
    const hint = hintFor(puzzle, state.solved, state.board);
    if (!hint) return;
    dispatch({ type: "hint-used" });
    track("hint_used", "groups", { level: hint.level, mode: game.mode });
    setCoach({ hint, rung: 1 });
  };

  // The bonus hint opens as soon as the rewarded ad has been watched.
  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  const reveal = () => {
    if (!coach) return;
    dispatch({ type: "coach-reveal", group: coach.hint.group, at: at() });
    setCoach({ ...coach, rung: 3 });
  };

  // Keyboard: arrows move between tiles, Space toggles the focused tile,
  // Enter submits four, Escape deselects, S shuffles, H asks the coach.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      const n = state.board.length;
      const move: Record<string, number> = { ArrowUp: -4, ArrowDown: 4, ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in move && n) {
        e.preventDefault();
        const next = Math.min(n - 1, Math.max(0, cursor + move[e.key]));
        setCursor(next);
        tiles.current[next]?.focus();
      } else if (e.key === "Enter" && state.selected.length === 4) {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        deselect();
      } else if (e.key.toLowerCase() === "s" && !e.shiftKey) {
        shuffle();
      } else if (e.key.toLowerCase() === "h") {
        openHint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <GroupsRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Solved! Comparing with today’s players…</p>
      </div>
    );
  }

  const pointed = coach && coach.rung < 3 ? coach.hint.word : null;
  const mistakesLeft = MAX_MISTAKES - state.mistakes;

  return (
    <GameShell
      tint={GAME.tint}
      title="Groups"
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>
            <span className="sr-only">
              {mistakesLeft} of {MAX_MISTAKES} mistakes left
            </span>
            <span aria-hidden="true" className="flex items-center gap-1.5">
              Mistakes
              {Array.from({ length: MAX_MISTAKES }, (_, i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < mistakesLeft ? "bg-[#111111]" : "border border-[#111111]/40"}`} />
              ))}
            </span>
          </Chip>
        </>
      }
    >
      <style>{`
        @keyframes fz-groups-in { from { transform: translateY(28px) scale(.98); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes fz-groups-shake { 0%,100% { transform: none } 20%,60% { transform: translateX(-6px) } 40%,80% { transform: translateX(6px) } }
        @media (prefers-reduced-motion: reduce) { .fz-groups-anim { animation: none !important } }
      `}</style>

      <div className="flex flex-col gap-2 px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        {state.solved.map((g) => (
          <GroupBar key={g} puzzle={puzzle} group={g} tag={state.coached.includes(g) ? "Coach" : undefined} />
        ))}
        {state.revealed.map((g) => (
          <GroupBar key={`r${g}`} puzzle={puzzle} group={g} tag="Revealed" faded />
        ))}

        {state.board.length > 0 && (
          <div
            key={shake}
            role="group"
            aria-label="Words. Select four that share a link."
            className="fz-groups-anim grid grid-cols-4 gap-2"
            style={shake ? { animation: "fz-groups-shake .4s ease" } : undefined}
          >
            {state.board.map((w, i) => {
              const on = state.selected.includes(w);
              const longest = Math.max(...w.split(/[ -]/).map((t) => t.length));
              return (
                <button
                  key={w}
                  ref={(el) => {
                    tiles.current[i] = el;
                  }}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${w.toUpperCase()}${on ? ", selected" : ""}${pointed === w ? ", the coach points here" : ""}`}
                  tabIndex={i === Math.min(cursor, state.board.length - 1) ? 0 : -1}
                  onFocus={() => setCursor(i)}
                  onClick={() => dispatch({ type: "toggle", word: w })}
                  disabled={inert}
                  className={`flex aspect-[1.15] min-h-[60px] items-center justify-center rounded-[14px] px-1 text-center font-bold uppercase leading-[1.1] tracking-[-0.01em] transition-colors [container-type:inline-size] ${
                    on ? "bg-ink text-ground" : "bg-soft-2 text-ink"
                  }`}
                  style={pointed === w ? { boxShadow: "inset 0 0 0 3px #F26B1D" } : undefined}
                >
                  <span className="block w-full break-words" style={{ fontSize: `min(17px, ${(100 / (longest * 0.74 + 0.6)).toFixed(1)}cqw)` }}>
                    {w}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p aria-live="polite" className="m-0 min-h-6 px-4 text-center text-sm font-semibold">
        {toast ?? (over && !isWon(state) ? "Out of mistakes. Here are the groups." : "")}
      </p>

      {!over && (
        <div className="grid grid-cols-3 gap-2 px-4">
          <ToolButton icon="refresh" label="Shuffle" onClick={shuffle} disabled={inert || state.board.length < 2} />
          <ToolButton icon="close" label="Deselect" onClick={deselect} disabled={inert || !state.selected.length} />
          <button
            type="button"
            onClick={submit}
            disabled={inert || state.selected.length !== 4}
            className="min-h-[52px] rounded-[14px] bg-violet text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      )}

      <div className="px-4">
        {coach ? (
          <CoachPanel coach={coach} hintsLeft={hintsLeft} onMore={() => setCoach({ ...coach, rung: 2 })} onReveal={reveal} onClose={() => setCoach(null)} />
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              over || finish
                ? undefined
                : hintsLeft
                  ? { label: "Get a hint", onClick: openHint }
                  : bonusOffer.ready
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
            {over || finish
              ? "Done. Open the recap to see how you did."
              : hintsLeft
                ? "Stuck? I’ll point to a word in the easiest group left, then give a clue to its theme, then show the group."
                : "You’ve used this puzzle’s hints. Try saying each word out loud: sound-alikes and hidden words are common in level 4."}
          </CoachCard>
        )}
      </div>

      {finish && (
        <div className="px-4">
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-ink text-base font-semibold text-ground">
            See recap
          </button>
        </div>
      )}

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          {game.mode === "daily" ? (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice?.();
              }}
            >
              Practice boards
            </SheetButton>
          ) : (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                New practice board
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Groups
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

/** A found (or revealed) group: a bar in its level color with the link and the words. */
function GroupBar({ puzzle, group, tag, faded = false, order }: { puzzle: GroupsPuzzle; group: number; tag?: string; faded?: boolean; order?: number }) {
  const g = puzzle.groups[group];
  return (
    <div
      role="status"
      aria-label={`${LEVEL_NAME[g.level]} group${order !== undefined ? `, found ${ORDINAL[order]}` : ""}: ${g.title}. ${g.words.join(", ")}${tag ? `. ${tag}` : ""}`}
      className="fz-groups-anim flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[14px] px-3 py-2 text-center text-[#111111]"
      style={{ background: LEVEL_COLOR[g.level], animation: "fz-groups-in .35s ease-out", opacity: faded ? 0.85 : 1 }}
    >
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#33334A]">
        {order !== undefined && <span>{ORDINAL[order]} ·</span>}
        {LEVEL_NAME[g.level]}
        {tag && <span className="rounded-full bg-white/70 px-1.5 py-px normal-case tracking-normal">{tag}</span>}
      </span>
      <span className="font-display text-[17px] font-extrabold leading-tight tracking-[-0.01em]">{g.title}</span>
      <span className="text-[13px] font-semibold uppercase leading-snug">{g.words.join(", ")}</span>
    </div>
  );
}

function CoachPanel({
  coach,
  hintsLeft,
  onMore,
  onReveal,
  onClose,
}: {
  coach: Coach;
  hintsLeft: number;
  onMore: () => void;
  onReveal: () => void;
  onClose: () => void;
}) {
  const { hint, rung } = coach;
  const tag = LEVEL_NAME[hint.level];
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }}>
        {hint.nudge}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={{ label: "Show the group", onClick: onReveal }}>
        {hint.theme}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: "Got it", onClick: onClose }}>
      {hint.answer}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this puzzle.</span>}
    </CoachCard>
  );
}

function GroupsRecap({
  game,
  date,
  state,
  finish,
  onClose,
  onPractice,
}: {
  game: Saved;
  date: string;
  state: PlayState;
  finish: Finish;
  onClose: () => void;
  onPractice?: () => void;
}) {
  const puzzle = state.puzzle;
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const found = state.solved.length;
  const { won, percentile } = finish;
  const mode = game.mode === "practice" ? "Practice" : game.mode === "archive" ? "Archive" : "Daily";
  const top = percentile === null || percentile === undefined ? null : 100 - percentile;

  const rankLine = !won
    ? `Found ${found} of 4 groups`
    : game.mode === "practice"
      ? "Practice board"
      : game.mode === "archive"
        ? "Archive puzzle"
        : percentile === null
          ? "First to finish today. Nice."
          : percentile === undefined
            ? "Solved"
            : `Ahead of ${percentile}% of today’s players`;

  const coachRecap = (() => {
    const mine = state.solved.filter((g) => !state.coached.includes(g));
    let keyMove: string;
    if (!won) {
      const missed = state.revealed[state.revealed.length - 1] ?? 3;
      const g = puzzle.groups[missed];
      keyMove = `the one that got away was ${LEVEL_NAME[g.level].toLowerCase()}, “${g.title}”: ${g.words.map((w) => w.toUpperCase()).join(", ")}. ${g.hint}.`;
    } else if (!mine.length) {
      keyMove = "the coach showed every group this time. Next time try one rung less of help.";
    } else {
      const best = mine.reduce((a, b) => (puzzle.groups[b].level > puzzle.groups[a].level ? b : a));
      const g = puzzle.groups[best];
      const idx = state.solved.indexOf(best);
      const when = state.solvedAt[idx];
      keyMove =
        best === state.solved[0] && g.level === 4
          ? `you found the trickiest group, “${g.title}”, first${when ? `, at ${formatTime(when)}` : ""}. That’s the hardest read on the board.`
          : `you cracked ${LEVEL_NAME[g.level].toLowerCase()}, “${g.title}”, ${ORDINAL[idx]}${when ? ` at ${formatTime(when)}` : ""}${state.mistakes ? ` with ${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"} along the way` : " without a single mistake"}.`;
    }
    return { keyMove, nextSkill: nextSkill(finish.skills, gameStats("groups").skills), learn: LEARN };
  })();

  const imageParams = new URLSearchParams({
    g: "groups",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    m: String(state.mistakes),
    h: String(state.hints),
    lv: mode,
    map: guessMap(state),
    f: String(found),
  });
  if (top !== null && game.mode === "daily" && won) imageParams.set("top", String(top));
  const text = [
    `Funzzle Groups · ${game.mode === "practice" ? "Practice" : short}`,
    ...guessRows(state),
    `${won ? "Solved" : `${found} of 4 groups`} · ${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"} · ${formatTime(finish.timeMs)}`,
    "funzzle.com/play/groups",
  ].join("\n");

  const order = [...state.solved.map((g, i) => ({ g, i, tag: state.coached.includes(g) ? "Coach" : undefined })), ...state.revealed.map((g) => ({ g, i: undefined, tag: "Not found" }))];

  return (
    <Recap
      game="groups"
      heading={game.mode === "practice" ? "Groups practice" : `Groups · ${short}${game.mode === "archive" ? " · archive" : ""}`}
      title={won ? (state.mistakes ? "Solved." : "Perfect.") : "So close."}
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" && won ? percentile : undefined}
      stats={won ? finish.stats : undefined}
      rankLine={rankLine}
      tiles={[
        { label: "Mistakes", value: String(state.mistakes), note: `of ${MAX_MISTAKES} allowed`, good: won && !state.mistakes },
        { label: "Hints", value: String(state.hints), note: `of ${MAX_HINTS} used` },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${game.mode === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      details={
        <section aria-label="Your groups" className="flex flex-col gap-2">
          <h2 className="m-0 text-sm font-semibold">The groups, in the order you found them</h2>
          {order.map(({ g, i, tag }) => (
            <GroupBar key={g} puzzle={puzzle} group={g} order={i} tag={tag} faded={i === undefined} />
          ))}
        </section>
      }
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: PRACTICE_SEED(puzzle.id), level: "practice" } : { kind: "daily", date },
        label: game.mode === "practice" ? "Groups practice" : `Groups · ${short}`,
        result: { timeMs: finish.timeMs, mistakes: state.mistakes, hints: state.hints },
        activeId: game.challengeId,
      }}
      coach={coachRecap}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game="groups" href="/play/groups?practice=1" label="Play a practice board" />}
    />
  );
}
