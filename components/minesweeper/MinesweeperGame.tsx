"use client";

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { hint, minesLeft, solveLayout, TECHNIQUES, type Board, type Difficulty, type GameState, type Hint, type Technique } from "@/lib/games/minesweeper";
import { MINESWEEPER_DAILY_LEVEL, MINESWEEPER_LABEL, MINESWEEPER_PUZZLE_RATING, type MinesweeperLevel } from "@/lib/games/dailySchedule";
import { recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak, markDone, setStatus } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { isLevel, isPortraitScreen, levelOf, LEVELS, practiceBoard } from "./boards";
import { cellLabel, cellView, initialState, MAX_HINTS, moveCursor, reducer, safeLeft, type PlayState } from "./state";
import { TECHNIQUE_GUIDE } from "./techniqueGuide";

interface Saved {
  key: string;
  /** archive = a past day's daily board (/archive): unranked, no streak. */
  mode: "daily" | "practice" | "archive";
  /** The archive board's date. */
  date?: string;
  /** Opened from a friend's challenge link (lib/games/kit/challenge.ts). */
  challengeId?: string;
  level: MinesweeperLevel;
  /** The board as played: "expert-mobile" is Expert stood upright. */
  difficulty: Difficulty;
  seed: string;
  firstClick: number;
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
}

type Coach = { hint: Hint; rung: 1 | 2 | 3; teach?: boolean };

const GAME = GAME_BY_SLUG.minesweeper;
const DAILY_KEY = (date: string) => `fz:minesweeper:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:minesweeper:archive:${date}`;
const PRACTICE_KEY = "fz:minesweeper:practice";
const ZOOM_KEY = (level: MinesweeperLevel) => `fz:minesweeper:zoom:${level}`;
/** Touch target for beginner and intermediate cells (design/DESIGN.md: ≥ 44px). */
const TOUCH = 44;
const LONG_PRESS_MS = 380;
const COACH_ORANGE = "#F26B1D";
/** Grout between cells: thinner on the dense boards. */
const gapFor = (cell: number) => (cell >= 26 ? 2 : 1);

function fromBoard(board: Board, base: Pick<Saved, "key" | "mode"> & Partial<Saved>): Saved {
  return {
    level: levelOf(board.difficulty),
    difficulty: board.difficulty,
    seed: board.seed,
    firstClick: board.firstClick,
    state: initialState(board),
    elapsed: 0,
    ...base,
  };
}

const dailyKeyOf = (date: string, board: Board) => `${date}:${board.seed}:${board.attempts}`;

export default function MinesweeperGame({ date, daily }: { date: string; daily: Board }) {
  const dailyKey = dailyKeyOf(date, daily);
  const [game, setGame] = useState<Saved>(() => fromBoard(daily, { key: dailyKey, mode: "daily" }));
  const [loaded, setLoaded] = useState(false);

  // Restore saved progress after hydration (local storage isn't on the server).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // "Try again" / "Play a practice board" loads /play/minesweeper?practice=<level>
    // as a new page view (components/kit/PracticeAction).
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (isLevel(want)) {
      history.replaceState(null, "", location.pathname);
      startPractice(want);
    } else if (challengeId) {
      // A friend's challenge: the same board they played.
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== "minesweeper") throw new Error("not a minesweeper challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPractice(p.seed, isLevel(p.level) ? p.level : "intermediate", challengeId);
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
    // Already finished today's board? The recap adds that result to the challenge.
    if (saved && saved.key === dailyKey) setGame(challengeId ? { ...saved, challengeId } : saved);
    else if (challengeId) setGame((g) => ({ ...g, challengeId }));
  }

  /** A past day's daily board (the stored one, or regenerated from its seed). */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setGame(saved);
    const res = await fetch(`/api/daily-puzzle?game=minesweeper&date=${day}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return openDaily();
    const board = (await res.json()) as Board;
    setGame(fromBoard(board, { key: `archive:${day}`, mode: "archive", date: day, challengeId }));
  }

  function openPractice(seed: string, level: MinesweeperLevel, challengeId: string) {
    const board = practiceBoard(seed, level, isPortraitScreen());
    setGame(fromBoard(board, { key: `${seed}:${challengeId}`, mode: "practice", challengeId }));
  }

  function startPractice(level: MinesweeperLevel) {
    countPractice("minesweeper");
    const seed = `minesweeper-practice:${crypto.randomUUID()}`;
    const next = fromBoard(practiceBoard(seed, level, isPortraitScreen()), { key: seed, mode: "practice" });
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice("beginner");
  };
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey ? saved : fromBoard(daily, { key: dailyKey, mode: "daily" }));
  };

  if (!loaded) return <Play game={game} date={date} key={`pre-${game.key}`} inert />;
  return <Play key={game.key} game={game} date={game.date ?? date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

function Play({
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
  onPractice?: (level: MinesweeperLevel) => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const [state, dispatch] = useReducer(reducer, game.state);
  const g = state.game;
  const [flagMode, setFlagMode] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [cursor, setCursor] = useState(game.firstClick);
  // Opt-in rewarded ad: one more hint after the free ones (lib/ads/useRewardedOffer).
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const playing = g.status === "playing";
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("minesweeper-extra-hint", "minesweeper", outOfHints && playing && !finish && !inert);
  // Second chance: after a mine, an opt-in rewarded ad rewinds the click. No ad, no offer: the loss stands.
  const lostPending = g.status === "lost" && !finish && !inert;
  const secondChance = useRewardedOffer("minesweeper-second-chance", "minesweeper", lostPending);
  // Once an ad has been offered, the player decides ("No thanks"); it never times out on them.
  const [offered, setOffered] = useState(false);
  if (secondChance.ready && !offered) setOffered(true);
  const [showRecap, setShowRecap] = useState(!!game.done?.won);
  const [loadingStats, setLoadingStats] = useState(false);
  const timer = useTimer(!inert && !paused && playing && !finish, game.elapsed);
  const started = useRef(false);
  const rating = getRating("minesweeper").rating;
  const label = MINESWEEPER_LABEL[game.level];
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? `Practice · ${label}`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${label}`;
  const left = minesLeft(g);

  // Save progress (and the homepage's "In play" line) on every change.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    if (game.mode === "daily" && !finish && playing && g.moves > 1) {
      setStatus("minesweeper", date, { state: "playing", meta: `${label} · ${left} mines left · ${formatClock(timer.now())}` });
    }
    // timer.now is read on purpose without re-running every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "minesweeper", { mode: game.mode, difficulty: game.level });
  }, [inert, finish, game.mode, game.level]);

  const ratingKey = game.mode === "daily" ? date : `practice:${game.seed}`;
  const base = { hints: state.hints, mistakes: state.explosions };

  // Win: rank against today's players, update rating, stats and skills.
  useEffect(() => {
    if (g.status !== "won" || finish || inert) return;
    const timeMs = Math.round(timer.now());
    track("game_complete", "minesweeper", { mode: game.mode, difficulty: game.level, timeMs, ...base });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      // Archive boards are unrated: the day's field has moved on.
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating("minesweeper").rating, delta: 0 }
          : recordMatch("minesweeper", ratingKey, { puzzleRating: MINESWEEPER_PUZZLE_RATING[game.level], won: true, percentile: percentile ?? undefined, ...base });
      recordFinish("minesweeper", {
        won: true,
        timeMs,
        hints: base.hints,
        level: game.level,
        skills: Object.keys(solveLayout(g, game.firstClick).techniques),
      });
      if (game.mode === "daily") markDone("minesweeper", date, { timeMs, ...base, percentile: percentile ?? undefined, ratingDelta: delta, label });
      setFinish({ won: true, timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
      setLoadingStats(false);
    };
    // The win is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    if (game.mode === "daily") {
      setLoadingStats(true);
      submitResult({ game: "minesweeper", date, variant: MINESWEEPER_DAILY_LEVEL, timeMs, ...base, moves: g.moves }).then((res) =>
        finalize(res ? res.percentile : undefined, res)
      );
    } else {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.status]);

  /** A loss stands once the player declines the second chance, or no ad is available. */
  const acceptLoss = useCallback(() => {
    if (finish || inert || g.status !== "lost") return;
    const timeMs = Math.round(timer.now());
    const { rating: r, delta } =
      game.mode === "archive"
        ? { rating: getRating("minesweeper").rating, delta: 0 }
        : recordMatch("minesweeper", ratingKey, { puzzleRating: MINESWEEPER_PUZZLE_RATING[game.level], won: false, ...base });
    recordFinish("minesweeper", { won: false, timeMs, hints: base.hints, level: game.level });
    if (game.mode === "daily") markDone("minesweeper", date, { timeMs, ...base, ratingDelta: delta, label: `${label} · mine hit` });
    setFinish({ won: false, timeMs, ratingDelta: delta, rating: r, streak: getStreak().current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, inert, g.status]);

  // No rewarded ad came: the offer stays hidden and the loss stands.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the ad network answered "none"
    if (lostPending && secondChance.settled && !offered) acceptLoss();
  }, [lostPending, secondChance.settled, offered, acceptLoss]);

  const takeSecondChance = async () => {
    if (await secondChance.watch()) dispatch({ type: "second-chance" });
  };

  // A hint goes stale once its answer cell is settled some other way.
  useEffect(() => {
    if (!coach || coach.rung === 3) return;
    const h = coach.hint;
    const c = h.answer.cell;
    const settled = h.mistakeCell !== undefined ? !g.flagged[c] : h.answer.kind === "safe" ? g.revealed[c] : g.flagged[c];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the board moved past the hint
    if (settled || !playing) setCoach(null);
  }, [g, coach, playing]);

  const activate = useCallback(
    (cell: number) => {
      if (finish || inert) return;
      setCursor(cell);
      dispatch({ type: "activate", cell, flagMode });
      setCoach((c) => (c?.rung === 3 ? null : c));
    },
    [finish, inert, flagMode]
  );
  const flag = useCallback(
    (cell: number) => {
      if (finish || inert) return;
      setCursor(cell);
      dispatch({ type: "flag", cell });
      setCoach((c) => (c?.rung === 3 ? null : c));
    },
    [finish, inert]
  );

  const openHint = () => {
    if (finish || coach || !playing || inert) return;
    if (state.hints >= MAX_HINTS + bonusHints) return;
    const h = hint(g);
    if (!h) return;
    dispatch({ type: "hint-used", technique: h.technique });
    track("hint_used", "minesweeper", { technique: h.technique, mode: game.mode });
    setCoach({ hint: h, rung: 1 });
  };

  // The bonus hint opens as soon as the rewarded ad has been watched.
  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  const showAnswer = () => {
    if (!coach) return;
    const h = coach.hint;
    dispatch({ type: "coach-apply", cell: h.answer.cell, kind: h.answer.kind, mistake: h.mistakeCell !== undefined });
    setCursor(h.answer.cell);
    setCoach({ ...coach, rung: 3, teach: false });
  };

  // Keyboard outside the board: H hint, Ctrl/Cmd+Z undo the last flag. (Arrows, Space and F live on the board.)
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: "undo-flag" });
      } else if (!mod && e.key.toLowerCase() === "h") {
        openHint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Board sizing: cells fill the column ("fit"), or zoom to the 44px touch target and pan.
  const outerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<number | null>(null);
  const [coarse, setCoarse] = useState(false);
  const [zoomPref, setZoomPref] = useState<boolean | null>(null);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setAvail(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4);
    };
    measure();
    setCoarse(matchMedia("(pointer: coarse)").matches);
    setZoomPref(readJson<boolean | null>(ZOOM_KEY(game.level), null));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [game.level]);
  const focus = useMemo(() => coachFocus(coach), [coach]);
  const fitWith = (gap: number) => Math.floor(((avail ?? 0) - (g.width - 1) * gap) / g.width);
  const fit = avail === null ? null : Math.max(12, fitWith(2) >= 26 ? fitWith(2) : fitWith(1));
  const canZoom = fit !== null && fit < TOUCH;
  // Beginner and intermediate default to touch-size cells on touch screens; expert to the whole board.
  const zoom = canZoom && (zoomPref ?? (coarse && game.level !== "expert"));
  const cell = fit === null ? null : zoom ? TOUCH : fit;
  const setZoom = (z: boolean) => {
    setZoomPref(z);
    writeJson(ZOOM_KEY(game.level), z);
  };

  // Zoomed in: start with the opening (or the cursor) in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !zoom || cell === null) return;
    const step = cell + gapFor(cell);
    const r = Math.floor(cursor / g.width);
    const c = cursor % g.width;
    el.scrollTo({ left: c * step - el.clientWidth / 2 + cell / 2, top: r * step - el.clientHeight / 2 + cell / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the zoom changes
  }, [zoom, cell === null]);

  if (showRecap && finish?.won) {
    return <MinesweeperRecap game={game} date={date} state={state} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Cleared! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);

  return (
    <GameShell
      tint={GAME.tint}
      title={game.mode === "practice" ? "Minesweeper" : "Daily Minesweeper"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>
            <span aria-hidden="true">
              <MineGlyph size={14} />
            </span>
            {left} mine{left === 1 ? "" : "s"} left
          </Chip>
          <Chip dark={flagMode} onClick={() => setFlagMode((v) => !v)} pressed={flagMode}>
            Flag mode {flagMode ? "on" : "off"}
          </Chip>
        </>
      }
    >
      <div ref={outerRef} className="px-4">
        <div
          ref={scrollRef}
          className="mx-auto w-fit max-w-full overflow-auto overscroll-contain rounded-[14px] border-2 border-ink"
          style={{
            maxHeight: zoom ? "min(62dvh, 640px)" : undefined,
            background: "color-mix(in srgb, #8b93b5 40%, var(--ground))",
            visibility: paused ? "hidden" : undefined,
            pointerEvents: inert ? "none" : undefined,
          }}
        >
          <Grid
            game={g}
            cell={cell}
            gap={cell === null ? 1 : gapFor(cell)}
            cursor={cursor}
            focus={focus}
            answer={coach?.rung === 3 ? coach.hint.answer.cell : null}
            onActivate={activate}
            onFlag={flag}
            onCursor={setCursor}
          />
        </div>
      </div>

      {g.status === "lost" && (
        <div className="px-4">
          <LossCard
            game={game}
            finish={finish}
            pending={lostPending}
            offer={secondChance.ready}
            offered={offered}
            onWatch={takeSecondChance}
            onAccept={acceptLoss}
          />
        </div>
      )}

      {g.status !== "lost" && (
        <div className="px-4">
          {coach ? (
            <CoachPanel
              coach={coach}
              onMore={() => setCoach({ ...coach, rung: 2 })}
              onAnswer={showAnswer}
              onTeach={() => setCoach({ ...coach, teach: true })}
              onClose={() => setCoach(null)}
              hintsLeft={hintsLeft}
            />
          ) : (
            <CoachCard
              heading="Coach"
              tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
              primary={
                hintsLeft && !finish
                  ? { label: "Get a hint", onClick: openHint }
                  : !finish && bonusOffer.ready
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
                ? "Cleared. Open the recap to see how you did."
                : hintsLeft
                  ? "Stuck? I’ll find the next cell logic can settle: where to look, then why, then the answer. Every board can be solved without guessing."
                  : "You’ve used this board’s three hints. Look for two numbers whose hidden cells overlap and compare what each one still needs."}
            </CoachCard>
          )}
        </div>
      )}

      <div className={`grid ${canZoom ? "grid-cols-4" : "grid-cols-3"} gap-2 px-4`}>
        <ToolButton icon="undo" label="Undo flag" onClick={() => dispatch({ type: "undo-flag" })} disabled={state.lastFlag === null || !playing} />
        <ToolButton icon="flag" label="Flag mode" active={flagMode} onClick={() => setFlagMode((v) => !v)} />
        {canZoom && <ToolButton icon={zoom ? "zoomOut" : "zoomIn"} label={zoom ? "Whole board" : "Zoom in"} onClick={() => setZoom(!zoom)} />}
        <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={openHint} disabled={!hintsLeft || !!coach || !!finish || !playing} />
      </div>

      <p className="m-0 px-4 text-center text-xs text-muted">
        {coarse ? "Tap to open · long-press or Flag mode to flag · tap a number to chord" : "Click to open · right-click or F to flag · click a number to chord · arrow keys move"}
        {playing ? ` · ${safeLeft(g)} safe cell${safeLeft(g) === 1 ? "" : "s"} to go` : ""}
      </p>

      {finish?.won && (
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
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setPaused(false);
                      onPractice?.(l);
                    }}
                    className="min-h-11 rounded-full border border-line-strong text-sm font-semibold text-ink"
                  >
                    {MINESWEEPER_LABEL[l]}
                  </button>
                ))}
              </div>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Daily Minesweeper
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

/** Cells the coach outlines: the numbers to look at, then everything the step uses. */
function coachFocus(coach: Coach | null): Set<number> {
  if (!coach || coach.rung === 3) return new Set();
  const h = coach.hint;
  if (h.mistakeCell !== undefined) return new Set(coach.rung === 2 ? [h.mistakeCell] : []);
  if (coach.rung === 1) return new Set(h.deduction?.clues ?? []);
  return new Set(h.cells);
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

/** Classic number colors, mixed with ink so they hold 4.5:1 in light and dark themes. */
const NUMBER_COLORS = ["", "#2563EB", "#15803D", "#DC2626", "#7C3AED", "#B45309", "#0F766E", "var(--ink)", "var(--muted)"];
const numberColor = (n: number) => (n >= 7 ? NUMBER_COLORS[n] : `color-mix(in srgb, ${NUMBER_COLORS[n]} 78%, var(--ink))`);
const HIDDEN_BG = "color-mix(in srgb, #8FE3CF 58%, var(--ground))";

const Grid = memo(function Grid({
  game: g,
  cell,
  gap,
  cursor,
  focus,
  answer,
  onActivate,
  onFlag,
  onCursor,
}: {
  game: GameState;
  /** Cell size in px; null before the board is measured (then columns share the width). */
  cell: number | null;
  gap: number;
  cursor: number;
  focus: Set<number>;
  answer: number | null;
  onActivate: (cell: number) => void;
  onFlag: (cell: number) => void;
  onCursor: (cell: number) => void;
}) {
  const press = useRef<{ cell: number; x: number; y: number; timer: number | null; fired: boolean } | null>(null);
  const pointerType = useRef("mouse");
  const gridRef = useRef<HTMLDivElement>(null);
  const clear = () => {
    if (press.current?.timer) window.clearTimeout(press.current.timer);
    if (press.current) press.current.timer = null;
  };
  const font = cell === null ? 14 : Math.max(10, Math.round(cell * 0.56));

  const focusCell = (i: number) => {
    onCursor(i);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${i}"]`)?.focus();
  };

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={`Minesweeper board, ${g.width} columns by ${g.height} rows`}
      className="select-none"
      style={{
        display: "grid",
        gridTemplateColumns: cell === null ? `repeat(${g.width}, minmax(0, 1fr))` : `repeat(${g.width}, ${cell}px)`,
        gap,
        width: cell === null ? "100%" : "max-content",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
      }}
      onKeyDown={(e) => {
        if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          focusCell(moveCursor(g.width, g.height, cursor, e.key));
        } else if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onFlag(cursor);
        }
      }}
    >
      {Array.from({ length: g.height }, (_, row) => (
        <div key={row} role="row" className="contents">
          {Array.from({ length: g.width }, (_, col) => {
            const i = row * g.width + col;
            const v = cellView(g, i);
            const inFocus = focus.has(i);
            const isAnswer = answer === i;
            const open = v.kind === "open";
            const style: CSSProperties = {
              width: cell ?? undefined,
              height: cell ?? undefined,
              fontSize: font,
              touchAction: "manipulation",
              background:
                v.kind === "mine" && v.exploded
                  ? "var(--card-red)"
                  : open || v.kind === "mine"
                    ? inFocus
                      ? `color-mix(in srgb, ${COACH_ORANGE} 18%, var(--ground))`
                      : "var(--ground)"
                    : inFocus
                      ? `color-mix(in srgb, ${COACH_ORANGE} 30%, var(--ground))`
                      : HIDDEN_BG,
              boxShadow: inFocus || isAnswer ? `inset 0 0 0 ${cell !== null && cell < 22 ? 2 : 3}px ${COACH_ORANGE}` : undefined,
              color: open ? numberColor(v.n) : "var(--ink)",
            };
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                data-cell={i}
                tabIndex={i === cursor ? 0 : -1}
                aria-label={cellLabel(g, i)}
                className={`relative flex items-center justify-center p-0 font-display font-extrabold leading-none outline-none focus-visible:z-10 focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-violet ${cell === null ? "aspect-square" : ""} ${g.width > 16 && (cell ?? 0) < 22 ? "rounded-[2px]" : "rounded-[4px]"}`}
                style={style}
                onPointerDown={(e) => {
                  pointerType.current = e.pointerType;
                  clear();
                  if (e.pointerType === "mouse") {
                    press.current = null;
                    return;
                  }
                  // Long-press flags on touch screens.
                  const p = { cell: i, x: e.clientX, y: e.clientY, timer: null as number | null, fired: false };
                  p.timer = window.setTimeout(() => {
                    p.fired = true;
                    p.timer = null;
                    onFlag(i);
                    try {
                      navigator.vibrate?.(12);
                    } catch {
                      // Not supported.
                    }
                  }, LONG_PRESS_MS);
                  press.current = p;
                }}
                onPointerMove={(e) => {
                  const p = press.current;
                  if (p && p.timer && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) clear();
                }}
                onPointerUp={clear}
                onPointerCancel={() => {
                  clear();
                  press.current = null;
                }}
                onPointerLeave={clear}
                onClick={() => {
                  const p = press.current;
                  press.current = null;
                  if (p && p.cell === i && p.fired) return;
                  onActivate(i);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  // Touch long-presses are handled by the timer; the context menu is for the mouse.
                  if (pointerType.current === "mouse") onFlag(i);
                }}
              >
                <CellFace v={v} cell={cell} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

function CellFace({ v, cell }: { v: ReturnType<typeof cellView>; cell: number | null }) {
  const icon = Math.max(10, Math.round((cell ?? 24) * 0.62));
  if (v.kind === "open") return v.n ? <span aria-hidden="true">{v.n}</span> : null;
  if (v.kind === "flag") {
    return (
      <span aria-hidden="true" className="relative flex">
        <FlagGlyph size={icon} />
        {v.wrong && (
          <svg className="absolute inset-0" width={icon} height={icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4l16 16" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        )}
      </span>
    );
  }
  if (v.kind === "mine") return <MineGlyph size={icon} light={v.exploded} />;
  return null;
}

function FlagGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 21V4" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 4h11l-3 4.5 3 4.5H7z" fill="var(--card-red)" />
      <path d="M4 21h7" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function MineGlyph({ size, light = false }: { size: number; light?: boolean }) {
  const c = light ? "#FFFFFF" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="6" fill={c} />
      <path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5M5.3 5.3l2.5 2.5M16.2 16.2l2.5 2.5M18.7 5.3l-2.5 2.5M7.8 16.2l-2.5 2.5" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Coach, loss and recap
// ---------------------------------------------------------------------------

function CoachPanel({
  coach,
  onMore,
  onAnswer,
  onTeach,
  onClose,
  hintsLeft,
}: {
  coach: Coach;
  onMore: () => void;
  onAnswer: () => void;
  onTeach: () => void;
  onClose: () => void;
  hintsLeft: number;
}) {
  const { hint: h, rung } = coach;
  const tag = h.mistakeCell !== undefined ? "Check your flags" : h.title;
  const guide = TECHNIQUE_GUIDE[h.technique];
  if (coach.teach) {
    return (
      <CoachCard heading={`Coach · ${guide.title}`} tag="How it works" onClose={onClose} primary={rung < 3 ? { label: "Show the answer", onClick: onAnswer } : undefined}>
        {guide.body}
      </CoachCard>
    );
  }
  if (rung === 1) {
    return (
      <CoachCard heading="Coach · Hint 1 of 3" tag={tag} onClose={onClose} primary={{ label: "More help", onClick: onMore }} secondary={{ label: "Teach me this", onClick: onTeach }}>
        {h.direction}
      </CoachCard>
    );
  }
  if (rung === 2) {
    return (
      <CoachCard heading="Coach · Hint 2 of 3" tag={tag} onClose={onClose} primary={{ label: "Show the answer", onClick: onAnswer }} secondary={{ label: "Teach me this", onClick: onTeach }}>
        {h.specific}
      </CoachCard>
    );
  }
  return (
    <CoachCard heading="Coach · Hint 3 of 3" tag={tag} onClose={onClose} primary={{ label: "Got it", onClick: onClose }} secondary={{ label: "Teach me this", onClick: onTeach }}>
      {h.answerText} {h.answer.kind === "safe" && h.mistakeCell === undefined ? "I opened it for you." : h.mistakeCell !== undefined ? "I took the flag off." : "I flagged it for you."}
      {hintsLeft === 0 && <span className="mt-1 block text-muted">That was your last hint for this board.</span>}
    </CoachCard>
  );
}

function LossCard({
  game,
  finish,
  pending,
  offer,
  offered,
  onWatch,
  onAccept,
}: {
  game: Saved;
  finish: Finish | null;
  pending: boolean;
  offer: boolean;
  offered: boolean;
  onWatch: () => void;
  onAccept: () => void;
}) {
  const label = MINESWEEPER_LABEL[game.level];
  const isDaily = game.mode !== "practice";
  return (
    <section aria-label="Mine hit" aria-live="polite" className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-soft px-4 py-3.5">
      <span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.02em]">Boom.</span>
      {pending ? (
        <>
          <p className="m-0 text-sm leading-[1.45]">
            That was a mine.
            {offer || offered ? " Watch a short ad for a second chance: the board goes back to just before that click." : ""}
          </p>
          {(offer || offered) && (
            <div className="flex flex-wrap gap-2">
              {offer && (
                <button type="button" onClick={onWatch} className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-ground">
                  Watch an ad for a second chance
                </button>
              )}
              <button type="button" onClick={onAccept} className="min-h-11 rounded-full border border-line-strong bg-ground px-4 text-sm font-semibold text-ink">
                No thanks
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="m-0 text-sm leading-[1.45]">
            {isDaily
              ? `That was a mine, so ${game.mode === "archive" ? "this board" : "today’s board"} ends here. The board shows where every mine was.`
              : "That was a mine. The board shows where every mine was."}
            {finish && game.mode !== "archive" ? ` Rating ${finish.rating.toLocaleString("en-US")} (${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta}).` : ""}
          </p>
          <PracticeAction
            game="minesweeper"
            href={`/play/minesweeper?practice=${game.level}`}
            label={isDaily ? "Try again on a practice board" : `Try again: a new ${label.toLowerCase()} board`}
          />
        </>
      )}
    </section>
  );
}

function MinesweeperRecap({
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
  onPractice?: (level: MinesweeperLevel) => void;
}) {
  const label = MINESWEEPER_LABEL[game.level];
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const g = state.game;

  // Coach recap: the hardest technique on this board's logical solve path.
  const coach = useMemo(() => {
    const { hardest, techniques } = solveLayout(g, game.firstClick);
    const hard: Technique = hardest ?? "single-safe";
    const guide = TECHNIQUE_GUIDE[hard];
    const steps = Object.values(techniques).reduce((n, k) => n + (k ?? 0), 0);
    const helped = state.coachedTechniques.includes(hard);
    const keyMove = helped
      ? `this board’s hardest step needed ${guide.phrase}. The coach helped there; try spotting it yourself next time.`
      : `you cleared ${g.width}×${g.height} without a guess, about ${steps} logical steps, the hardest of them ${guide.phrase}.`;
    const rank = TECHNIQUES.indexOf(hard);
    const nextTech = TECHNIQUES[Math.min(TECHNIQUES.length - 1, rank + 1)];
    const next = TECHNIQUE_GUIDE[nextTech];
    return {
      keyMove,
      nextSkill: nextTech === hard ? `${next.title}, again. You’ve reached the hardest technique the boards use.` : `${next.title}. You’ll need it for ${next.unlocks}.`,
      learn: { title: `Learn ${next.title} in 2 minutes`, body: next.body },
    };
  }, [g, game.firstClick, state.coachedTechniques]);

  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const isDaily = game.mode === "daily";
  const imageParams = new URLSearchParams({
    g: "minesweeper",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    m: String(state.explosions),
    h: String(state.hints),
    lv: game.mode === "practice" ? `Practice ${label}` : label,
  });
  if (top !== null && isDaily) imageParams.set("top", String(top));
  const hit = state.explosions;
  const text = [
    `Funzzle ${game.mode === "practice" ? "Minesweeper practice" : "Daily Minesweeper"} · ${short} · ${label}`,
    `${formatTime(finish.timeMs)}${top !== null && isDaily ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${hit ? `${hit} mine${hit === 1 ? "" : "s"} hit` : "No mines hit"} · ${state.hints} hint${state.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/minesweeper",
  ].join("\n");

  return (
    <Recap
      game="minesweeper"
      heading={game.mode === "practice" ? `Minesweeper practice · ${label}` : `Daily Minesweeper · ${short}${game.mode === "archive" ? " · archive" : ""}`}
      title="Cleared."
      timeMs={finish.timeMs}
      percentile={isDaily ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Hints", value: String(state.hints), note: `of ${MAX_HINTS} used` },
        { label: "Mines hit", value: String(hit), note: hit ? "Second chance used" : "Clean clear", good: !hit },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive boards are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: game.mode === "practice" ? { kind: "practice", seed: game.seed, level: game.level } : { kind: "daily", date, variant: MINESWEEPER_DAILY_LEVEL },
        label: game.mode === "practice" ? `Minesweeper practice · ${label}` : `Daily Minesweeper · ${short} · ${label}`,
        result: { timeMs: finish.timeMs, mistakes: hit, hints: state.hints, moves: g.moves },
        activeId: game.challengeId,
      }}
      coach={coach}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={
        onPractice && (
          <PracticeAction
            game="minesweeper"
            href={`/play/minesweeper?practice=${game.level}`}
            label={`Play ${game.level === "beginner" ? "a" : "an"} ${label.toLowerCase()} practice board`}
          />
        )
      }
    />
  );
}
