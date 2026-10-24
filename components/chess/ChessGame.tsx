"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { nextWithBreak } from "@/lib/ads/placements";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import {
  boardArray,
  captured,
  checkSquare,
  END_TEXT,
  legalUiMoves,
  LEVEL_INFO,
  LEVELS,
  materialBalance,
  PUZZLE_DIFFICULTY_LABEL,
  replay,
  sanList,
  START_FEN,
  status,
  THEME_INFO,
  type ChessHint,
  type ChessPuzzle,
  type GameReview,
  type Level,
  type PieceCode,
  type UiMove,
} from "@/lib/games/chess";
import { CHESS_LEVEL_RATING, CHESS_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import type { DailyChess } from "@/lib/games/dailyPuzzles";
import { recordFinish, skillProgress } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getStreak } from "@/lib/games/kit/daily";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import Board from "./Board";
import { ask, cancelEngine } from "./engine";
import { PieceSvg } from "./Pieces";
import { goalLabel, isCorrect, mainTheme, moveSquares, puzzleHint, solverColor, solverMoves } from "./puzzleState";

const GAME = GAME_BY_SLUG.chess;
/** Free coach hints per puzzle or game; then an opt-in rewarded ad for one more. */
const FREE_HINTS = 3;

interface Finish {
  timeMs: number;
  percentile?: number | null;
  stats?: DayStats | null;
  ratingDelta: number;
  rating: number;
  streak: number;
}

interface PuzzleSaved {
  key: string;
  /** archive = a past day's daily puzzle: unranked. */
  mode: "daily" | "archive" | "practice";
  date?: string;
  challengeId?: string;
  seed: string;
  puzzle: ChessPuzzle;
  /** Moves played so far (the solution prefix, or another mate at the end). */
  played: string[];
  mistakes: number;
  hints: number;
  elapsed: number;
  done?: Finish;
}

interface AiResult {
  outcome: "win" | "draw" | "loss";
  reason: string;
  timeMs: number;
  ratingDelta: number;
  rating: number;
  review?: GameReview | null;
}

interface AiSaved {
  key: string;
  level: Level;
  color: "w" | "b";
  fen: string;
  moves: string[];
  undos: number;
  hints: number;
  elapsed: number;
  result?: AiResult;
}

type View =
  | { kind: "puzzle"; game: PuzzleSaved }
  | { kind: "ai"; game: AiSaved }
  | { kind: "setup" }
  | { kind: "loading"; text: string };

const DAILY_KEY = (d: string) => `fz:chess:daily:${d}`;
const ARCHIVE_KEY = (d: string) => `fz:chess:archive:${d}`;
const PRACTICE_KEY = "fz:chess:practice";
const AI_KEY = "fz:chess:ai";
const MODE_KEY = "fz:chess:mode";
const SETUP_KEY = "fz:chess:setup";

interface Nav {
  daily: () => void;
  newPractice: () => void;
  resumePractice: () => void;
  playAi: () => void;
  setup: () => void;
  startAi: (level: Level, color: "w" | "b" | "random") => void;
}

function freshPuzzle(mode: PuzzleSaved["mode"], key: string, seed: string, puzzle: ChessPuzzle, extra: Partial<PuzzleSaved> = {}): PuzzleSaved {
  return { key, mode, seed, puzzle, played: [], mistakes: 0, hints: 0, elapsed: 0, ...extra };
}

export default function ChessGame({ date, daily }: { date: string; daily: DailyChess }) {
  const dailyKey = `${date}:${daily.puzzle.fen}:${daily.puzzle.solution.join("")}`;
  const freshDaily = useCallback(() => freshPuzzle("daily", dailyKey, `chess:${date}`, daily.puzzle), [dailyKey, date, daily.puzzle]);
  const [view, setView] = useState<View>(() => ({ kind: "puzzle", game: freshDaily() }));
  const [loaded, setLoaded] = useState(false);

  const openDaily = useCallback(
    (challengeId?: string) => {
      const saved = readJson<PuzzleSaved | null>(DAILY_KEY(date), null);
      const game = saved && saved.key === dailyKey ? saved : freshDaily();
      writeJson(MODE_KEY, "puzzle");
      setView({ kind: "puzzle", game: challengeId ? { ...game, challengeId } : game });
    },
    [date, dailyKey, freshDaily]
  );

  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<PuzzleSaved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setView({ kind: "puzzle", game: saved });
    setView({ kind: "loading", text: "Loading that day’s puzzle…" });
    try {
      const res = await fetch(`/api/daily-puzzle?game=chess&date=${day}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as DailyChess;
      setView({ kind: "puzzle", game: freshPuzzle("archive", `archive:${day}`, `chess:${day}`, d.puzzle, { date: day, challengeId }) });
    } catch {
      openDaily();
    }
  }

  async function openPracticeSeed(seed: string, challengeId?: string) {
    setView({ kind: "loading", text: "Setting up the puzzle…" });
    try {
      const puzzle = await ask<ChessPuzzle>({ type: "puzzle", seed });
      const game = freshPuzzle("practice", challengeId ? `${seed}:${challengeId}` : seed, seed, puzzle, { challengeId });
      if (!challengeId) writeJson(PRACTICE_KEY, game);
      writeJson(MODE_KEY, "puzzle");
      setView({ kind: "puzzle", game });
    } catch {
      openDaily();
    }
  }

  function newPractice() {
    countPractice("chess");
    void openPracticeSeed(`chess-practice:${crypto.randomUUID()}`);
  }

  function resumePractice() {
    const saved = readJson<PuzzleSaved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setView({ kind: "puzzle", game: saved });
    else newPractice();
  }

  function playAi() {
    writeJson(MODE_KEY, "ai");
    const saved = readJson<AiSaved | null>(AI_KEY, null);
    if (saved && !saved.result) setView({ kind: "ai", game: saved });
    else setView({ kind: "setup" });
  }

  function startAi(level: Level, choice: "w" | "b" | "random") {
    cancelEngine();
    const color = choice === "random" ? (Math.random() < 0.5 ? "w" : "b") : choice;
    writeJson(SETUP_KEY, { level, color: choice });
    writeJson(MODE_KEY, "ai");
    const game: AiSaved = { key: crypto.randomUUID(), level, color, fen: START_FEN, moves: [], undos: 0, hints: 0, elapsed: 0 };
    writeJson(AI_KEY, game);
    setView({ kind: "ai", game });
  }

  const nav: Nav = {
    daily: () => openDaily(),
    newPractice,
    resumePractice,
    playAi,
    setup: () => setView({ kind: "setup" }),
    startAi,
  };

  const initialized = useRef(false);
  useEffect(() => {
    // Once per page view (the URL is rewritten below, so a second run would differ).
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(location.search);
    // Recap actions load /play/chess?practice=puzzle|ai as a new page view.
    const want = params.get("practice");
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    const done = () => setLoaded(true);
    if (want === "puzzle" || want === "ai") {
      history.replaceState(null, "", location.pathname);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from the URL / local storage
      if (want === "puzzle") newPractice();
      else playAi();
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== "chess") throw new Error("not a chess challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return openPracticeSeed(p.seed, challengeId);
          if (p.date === date) return openDaily(challengeId);
          return openArchive(p.date, challengeId);
        })
        .catch(() => openDaily())
        .finally(done);
      return;
    } else if (archiveDate && /^\d{4}-\d{2}-\d{2}$/.test(archiveDate) && archiveDate < date) {
      openArchive(archiveDate).finally(done);
      return;
    } else if (readJson<string | null>(MODE_KEY, null) === "ai") {
      const saved = readJson<AiSaved | null>(AI_KEY, null);
      if (saved && !saved.result) setView({ kind: "ai", game: saved });
      else openDaily();
    } else {
      openDaily();
    }
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page view
  }, []);

  if (view.kind === "loading") {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center" style={{ background: GAME.tint }}>
        <p className="font-display text-2xl font-bold text-[#111111]" role="status">
          {view.text}
        </p>
      </div>
    );
  }
  if (view.kind === "setup") return <AiSetup nav={nav} />;
  if (view.kind === "ai") return <AiScreen key={view.game.key} game={view.game} date={date} nav={nav} />;
  return <PuzzleScreen key={`${loaded}:${view.game.key}`} game={view.game} date={view.game.date ?? date} inert={!loaded} nav={nav} />;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function MoveList({ fen, moves }: { fen: string; moves: string[] }) {
  const sans = useMemo(() => sanList(fen, moves), [fen, moves]);
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth });
  }, [sans.length]);
  const [, side, , , , full] = fen.split(" ");
  let no = Number(full) || 1;
  const rows: { no: number; w?: string; b?: string }[] = [];
  let i = 0;
  if (side === "b" && sans.length) {
    rows.push({ no, b: sans[0] });
    i = 1;
    no++;
  }
  for (; i < sans.length; i += 2, no++) rows.push({ no, w: sans[i], b: sans[i + 1] });
  if (!rows.length) return <p className="m-0 px-4 text-sm text-[#5C5246]">No moves yet.</p>;
  return (
    <ol ref={ref} aria-label="Moves" className="m-0 flex list-none gap-3 overflow-x-auto whitespace-nowrap px-4 py-1 font-mono text-[13px] text-[#111111]">
      {rows.map((r) => (
        <li key={r.no} className="flex gap-1.5">
          <span className="text-[#7A6D5C]">{r.no}.</span>
          <span>{r.w ?? "…"}</span>
          {r.b && <span>{r.b}</span>}
        </li>
      ))}
    </ol>
  );
}

function CapturedRow({ pieces, plus }: { pieces: PieceCode[]; plus: number }) {
  return (
    <div className="flex h-6 items-center gap-0.5 px-4" aria-label={pieces.length ? `Captured: ${pieces.length} pieces${plus > 0 ? `, up ${plus}` : ""}` : "No captures"}>
      {pieces.map((p, i) => (
        <span key={i} className="h-5 w-5">
          <PieceSvg code={p} size="100%" />
        </span>
      ))}
      {plus > 0 && <span className="ml-1 font-mono text-xs font-semibold text-[#5C5246]">+{plus}</span>}
    </div>
  );
}

function StatusLine({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="m-0 min-h-6 px-4 text-center text-[15px] font-semibold text-[#111111]">
      {children}
    </p>
  );
}

const colorName = (c: "w" | "b") => (c === "w" ? "White" : "Black");

function useHints(game: string, used: number, active: boolean) {
  const [bonus, setBonus] = useState(0);
  const left = Math.max(0, FREE_HINTS + bonus - used);
  const offer = useRewardedOffer(`${game}-extra-hint`, game, left === 0 && active);
  return { left, offer, addBonus: () => setBonus((b) => b + 1) };
}

// ---------------------------------------------------------------------------
// Puzzles: daily, archive, practice
// ---------------------------------------------------------------------------

type PuzzleCoach = { step: number; rung: 1 | 2 | 3 };

function PuzzleScreen({ game, date, inert, nav }: { game: PuzzleSaved; date: string; inert: boolean; nav: Nav }) {
  const p = game.puzzle;
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : game.challengeId ? null : PRACTICE_KEY;
  const [played, setPlayed] = useState<string[]>(game.played);
  const [mistakes, setMistakes] = useState(game.mistakes);
  const [hints, setHints] = useState(game.hints);
  const [orientation, setOrientation] = useState<"w" | "b">(solverColor(p));
  const [wrong, setWrong] = useState<{ moves: string[]; san: string } | null>(null);
  const [miss, setMiss] = useState<{ san: string; reply?: string } | null>(null);
  const [coach, setCoach] = useState<PuzzleCoach | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const solved = played.length >= p.solution.length;
  const timer = useTimer(!inert && !paused && !solved && !finish, game.elapsed);
  const started = useRef(false);
  const ranked = game.mode === "daily";
  const { left: hintsLeft, offer, addBonus } = useHints("chess", hints, !finish && !inert);
  const rating = getRating("chess").rating;
  const me = solverColor(p);

  const pos = useMemo(() => replay(p.fen, wrong ? wrong.moves : played), [p.fen, played, wrong]);
  const board = useMemo(() => boardArray(pos), [pos]);
  const playerTurn = played.length % 2 === 0 && !solved;
  const legal = useMemo(() => (playerTurn && !wrong && !inert && !paused ? legalUiMoves(pos) : []), [playerTurn, wrong, inert, paused, pos]);
  const shown = wrong ? wrong.moves : played;
  const lastMove = shown.length ? moveSquares(shown[shown.length - 1]) : p.lastMove ? moveSquares(p.lastMove) : null;

  // The opponent's forced reply follows a correct move.
  useEffect(() => {
    if (inert || solved || played.length % 2 === 0) return;
    const t = setTimeout(() => setPlayed((pl) => (pl.length % 2 === 1 && pl.length < p.solution.length ? [...pl, p.solution[pl.length]] : pl)), 550);
    return () => clearTimeout(t);
  }, [played, inert, solved, p.solution]);

  // Save progress.
  useEffect(() => {
    if (inert || !storageKey) return;
    writeJson(storageKey, { ...game, played, mistakes, hints, elapsed: timer.now(), done: finish ?? undefined } satisfies PuzzleSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer.now is read on purpose
  }, [played, mistakes, hints, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "chess", { mode: `puzzle-${game.mode}`, difficulty: p.difficulty });
  }, [inert, finish, game.mode, p.difficulty]);

  // Solved: rank (today's daily only), rating (not archive), stats and themes.
  useEffect(() => {
    if (!solved || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const base = { hints, mistakes };
    track("game_complete", "chess", { mode: `puzzle-${game.mode}`, difficulty: p.difficulty, timeMs, ...base });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating("chess").rating, delta: 0 }
          : recordMatch("chess", key, { puzzleRating: CHESS_PUZZLE_RATING[p.difficulty], won: true, percentile: percentile ?? undefined, ...base });
      recordFinish("chess", { won: true, timeMs, hints, level: `puzzle-${p.difficulty}`, skills: p.themes });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
    };
    // Completion is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    setCoach(null);
    if (ranked) {
      submitResult({ game: "chess", date, timeMs, ...base, moves: solverMoves(p) }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const onMove = (m: UiMove) => {
    if (!playerTurn || wrong) return;
    setMiss(null);
    if (isCorrect(p, played.length, m.uci)) {
      setCoach(null);
      setPlayed([...played, m.uci]);
      return;
    }
    setMistakes((n) => n + 1);
    const moves = [...played, m.uci];
    setWrong({ moves, san: m.san });
    setMiss({ san: m.san });
    // The refutation, for the coach line.
    ask<ChessHint | null>({ type: "hint", fen: p.fen, moves, timeMs: 250 })
      .then((h) => h && setMiss((cur) => (cur && cur.san === m.san ? { ...cur, reply: h.san } : cur)))
      .catch(() => {});
    setTimeout(() => setWrong(null), 900);
  };

  const openHint = () => {
    if (finish || solved || !playerTurn) return;
    if (coach && coach.step === played.length) return;
    if (hintsLeft <= 0) return;
    setHints((n) => n + 1);
    track("hint_used", "chess", { mode: `puzzle-${game.mode}`, theme: mainTheme(p) });
    setCoach({ step: played.length, rung: 1 });
  };

  useEffect(() => {
    if (!hintAfterAd || hintsLeft <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    openHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, hintsLeft]);

  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "h") openHint();
      else if (k === "f") setOrientation((o) => (o === "w" ? "b" : "w"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && finish) {
    return <PuzzleRecap game={game} date={date} played={played} mistakes={mistakes} hints={hints} finish={finish} onClose={() => setShowRecap(false)} />;
  }
  if (showRecap) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center" style={{ background: GAME.tint }}>
        <p className="text-lg font-semibold text-[#111111]">Solved! Comparing with today’s players…</p>
      </div>
    );
  }

  const activeCoach = coach && coach.step === played.length && playerTurn ? coach : null;
  const hint = activeCoach ? puzzleHint(p, played.length, activeCoach.rung) : null;
  const solutionMove = activeCoach?.rung === 3 ? legal.find((m) => m.uci === p.solution[played.length]) : undefined;
  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? `Practice · ${PUZZLE_DIFFICULTY_LABEL[p.difficulty]}`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${PUZZLE_DIFFICULTY_LABEL[p.difficulty]}`;
  const statusText = solved
    ? "Solved."
    : wrong
      ? `${wrong.san} isn’t it.`
      : playerTurn
        ? played.length
          ? "Correct. Keep going."
          : `${colorName(me)} to play: ${goalLabel(p).toLowerCase()}.`
        : `${colorName(me === "w" ? "b" : "w")} replies…`;

  return (
    <GameShell
      tint={GAME.tint}
      fullTint
      title={game.mode === "practice" ? "Chess Puzzle" : "Daily Chess Puzzle"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip dark>{goalLabel(p)}</Chip>
          <Chip>{colorName(me)} to move</Chip>
          <Chip>Mistakes {mistakes}</Chip>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
        </>
      }
    >
      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <Board
          board={board}
          orientation={orientation}
          legal={legal}
          lastMove={lastMove}
          check={checkSquare(pos)}
          hint={hint?.squares ?? null}
          wrong={wrong ? moveSquares(wrong.moves[wrong.moves.length - 1]) : null}
          onMove={onMove}
          label={`Chess board, ${orientation === "w" ? "white" : "black"} at the bottom`}
        />
      </div>
      <StatusLine>{statusText}</StatusLine>

      <div className="px-4">
        {hint && activeCoach ? (
          <CoachCard
            heading={`Coach · Hint ${activeCoach.rung} of 3`}
            tag={THEME_INFO[mainTheme(p)].name}
            onClose={() => setCoach(null)}
            primary={
              activeCoach.rung < 3
                ? { label: activeCoach.rung === 1 ? "More help" : "Show the move", onClick: () => setCoach({ ...activeCoach, rung: (activeCoach.rung + 1) as 2 | 3 }) }
                : solutionMove
                  ? { label: "Play it", onClick: () => onMove(solutionMove) }
                  : undefined
            }
          >
            {hint.text}
          </CoachCard>
        ) : miss ? (
          <CoachCard heading="Coach" tag="Not quite" onClose={() => setMiss(null)} primary={hintsLeft && !solved ? { label: "Get a hint", onClick: openHint } : undefined}>
            {miss.san} doesn’t work{miss.reply ? `: they answer ${miss.reply}` : ""}. The position is back; try another move. Look for checks, captures and threats first.
          </CoachCard>
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              finish || solved
                ? undefined
                : hintsLeft
                  ? { label: "Get a hint", onClick: openHint }
                  : offer.ready
                    ? {
                        label: "Watch an ad for one more hint",
                        onClick: async () => {
                          if (await offer.watch()) {
                            addBonus();
                            setHintAfterAd(true);
                          }
                        },
                      }
                    : undefined
            }
          >
            {finish
              ? "Solved. Open the recap to see how you did."
              : `There’s exactly one winning move here${p.kind === "mate" ? `: it forces mate in ${p.mate}` : ", and it wins material"}. Tap a piece, then a square, or drag it.`}
          </CoachCard>
        )}
      </div>

      <MoveList fen={p.fen} moves={played} />

      <div className="grid grid-cols-3 gap-2 px-4">
        <ToolButton surface="white" icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={openHint} disabled={!hintsLeft || !!finish || solved || !playerTurn} />
        <ToolButton surface="white" icon="refresh" label="Flip board" onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))} />
        <ToolButton surface="white" icon="menu" label="Options" onClick={() => setPaused(true)} />
      </div>

      {finish && (
        <div className="px-4">
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-[#111111] text-base font-semibold text-white">
            See recap
          </button>
        </div>
      )}

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          <ModeButtons current={game.mode === "practice" ? "practice" : "daily"} nav={nav} close={() => setPaused(false)} />
        </PauseSheet>
      )}
    </GameShell>
  );
}

function ModeButtons({ current, nav, close }: { current: "daily" | "practice" | "ai"; nav: Nav; close: () => void }) {
  const go = (fn: () => void) => () => {
    close();
    fn();
  };
  return (
    <>
      {current !== "daily" && <SheetButton onClick={go(nav.daily)}>Today’s daily puzzle</SheetButton>}
      {current === "practice" ? (
        <SheetButton onClick={go(nav.newPractice)}>New practice puzzle</SheetButton>
      ) : (
        <SheetButton onClick={go(nav.resumePractice)}>Practice puzzles</SheetButton>
      )}
      {current === "ai" ? <SheetButton onClick={go(nav.setup)}>New game against the computer</SheetButton> : <SheetButton onClick={go(nav.playAi)}>Play the computer</SheetButton>}
    </>
  );
}

function PuzzleRecap({
  game,
  date,
  played,
  mistakes,
  hints,
  finish,
  onClose,
}: {
  game: PuzzleSaved;
  date: string;
  played: string[];
  mistakes: number;
  hints: number;
  finish: Finish;
  onClose: () => void;
}) {
  const p = game.puzzle;
  const label = PUZZLE_DIFFICULTY_LABEL[p.difficulty];
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const isDaily = game.mode !== "practice";
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const theme = mainTheme(p);
  const sans = sanList(p.fen, played);
  const next = useMemo(() => {
    const progress = skillProgress("chess");
    return progress.find((s) => !s.mastered && s.skill.id !== theme) ?? null;
  }, [theme]);
  const params = new URLSearchParams({ g: "chess", d: date, t: String(finish.timeMs), s: String(finish.streak), m: String(mistakes), h: String(hints), lv: isDaily ? label : `Practice ${label}` });
  if (top !== null && game.mode === "daily") params.set("top", String(top));
  const text = [
    `Funzzle ${isDaily ? "Daily Chess Puzzle" : "Chess puzzle"} · ${short} · ${label}`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${mistakes} mistake${mistakes === 1 ? "" : "s"} · ${hints} hint${hints === 1 ? "" : "s"}`,
    "funzzle.com/play/chess",
  ].join("\n");
  const info = THEME_INFO[theme];
  const keyMove = (
    <>
      {sans[0]}
      {mistakes ? `, after ${mistakes} wrong tr${mistakes === 1 ? "y" : "ies"}` : ", first try"}. It’s {info.name.toLowerCase() === "win material" ? "a material win" : `a ${info.name.toLowerCase()}`}: {info.what.toLowerCase()}. The full line: {sans.join(" ")}.
    </>
  );
  return (
    <Recap
      game="chess"
      heading={isDaily ? `Daily Chess Puzzle · ${short}${game.mode === "archive" ? " · archive" : ""}` : `Chess puzzle · ${label}`}
      title="Solved."
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Mistakes", value: String(mistakes), note: mistakes ? "Wrong first moves" : "Clean solve", good: !mistakes },
        { label: "Hints", value: String(hints), note: hints ? `of ${FREE_HINTS} used` : "No help needed", good: !hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this puzzle"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: isDaily ? { kind: "daily", date } : { kind: "practice", seed: game.seed, level: p.difficulty },
        label: isDaily ? `Daily Chess Puzzle · ${short} · ${label}` : `Chess puzzle · ${label}`,
        result: { timeMs: finish.timeMs, mistakes, hints, moves: solverMoves(p) },
        activeId: game.challengeId,
      }}
      coach={{
        keyMove,
        nextSkill: next ? `${next.skill.name}: ${next.skill.what.toLowerCase()}. ${THEME_INFO[next.skill.id as keyof typeof THEME_INFO]?.tip ?? ""}` : "Every tactic in the tree mastered. Try the computer at a higher level.",
        learn: { title: `How to spot a ${info.name.toLowerCase()}`, body: info.tip },
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={
        <>
          <PracticeAction game="chess" href="/play/chess?practice=puzzle" label="Solve a practice puzzle" />
          <button type="button" onClick={() => nextWithBreak("/play/chess?practice=ai", "chess-ai")} className="min-h-[52px] rounded-full border border-line-strong px-4 text-[15px] font-semibold text-ink">
            Play the computer
          </button>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Play the computer
// ---------------------------------------------------------------------------

function AiSetup({ nav }: { nav: Nav }) {
  const saved = readJson<{ level: Level; color: "w" | "b" | "random" } | null>(SETUP_KEY, null);
  const [level, setLevel] = useState<Level>(saved?.level ?? 2);
  const [color, setColor] = useState<"w" | "b" | "random">(saved?.color ?? "w");
  const [paused, setPaused] = useState(false);
  return (
    <GameShell tint={GAME.tint} fullTint title="Chess" subtitle="Play the computer" timer="00:00" onTimerClick={() => setPaused(true)}>
      <fieldset className="m-0 flex flex-col gap-2 border-0 px-4">
        <legend className="mb-2 font-display text-xl font-bold text-[#111111]">Level</legend>
        <div className="grid grid-cols-2 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`flex min-h-[76px] flex-col items-start justify-center gap-0.5 rounded-[18px] px-3.5 py-2.5 text-left ${level === l ? "bg-[#111111] text-white" : "bg-white text-[#111111]"}`}
            >
              <span className="text-[15px] font-bold">
                {l} · {LEVEL_INFO[l].name}
              </span>
              <span className={`text-xs leading-snug ${level === l ? "text-white/80" : "text-[#5C5246]"}`}>{LEVEL_INFO[l].blurb}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="m-0 border-0 px-4">
        <legend className="mb-2 font-display text-xl font-bold text-[#111111]">Play as</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["w", "b", "random"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`min-h-11 rounded-full text-sm font-semibold ${color === c ? "bg-[#111111] text-white" : "bg-white text-[#111111]"}`}
            >
              {c === "random" ? "Random" : colorName(c)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2 px-4">
        <button type="button" onClick={() => nav.startAi(level, color)} className="min-h-[52px] rounded-full bg-[#111111] text-base font-semibold text-white">
          Start game
        </button>
        <button type="button" onClick={nav.daily} className="min-h-[52px] rounded-full border border-[#111111]/20 bg-white text-base font-semibold text-[#111111]">
          Today’s daily puzzle
        </button>
        <p className="m-0 text-center text-xs text-[#5C5246]">Undo is unlimited. Your rating moves with each finished game, more for beating higher levels.</p>
      </div>
      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          <ModeButtons current="ai" nav={nav} close={() => setPaused(false)} />
        </PauseSheet>
      )}
    </GameShell>
  );
}

function AiScreen({ game, date, nav }: { game: AiSaved; date: string; nav: Nav }) {
  const [moves, setMoves] = useState<string[]>(game.moves);
  const [undos, setUndos] = useState(game.undos);
  const [hints, setHints] = useState(game.hints);
  const [result, setResult] = useState<AiResult | null>(game.result ?? null);
  const [orientation, setOrientation] = useState<"w" | "b">(game.color);
  const [hint, setHint] = useState<ChessHint | null>(null);
  const [hintFor, setHintFor] = useState(-1);
  const [why, setWhy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [showRecap, setShowRecap] = useState(!!game.result);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const started = useRef(false);
  const info = LEVEL_INFO[game.level];

  const pos = useMemo(() => replay(game.fen, moves), [game.fen, moves]);
  const st = useMemo(() => status(pos), [pos]);
  const over = !!st.end || !!result;
  const myTurn = st.turn === game.color && !over;
  const timer = useTimer(!paused && !over, game.elapsed);
  const { left: hintsLeft, offer, addBonus } = useHints("chess", hints, !over);
  const legal = useMemo(() => (myTurn && !paused ? legalUiMoves(pos) : []), [myTurn, paused, pos]);
  const board = useMemo(() => boardArray(pos), [pos]);
  const lost = useMemo(() => captured(pos), [pos]);
  const balance = materialBalance(pos) * (game.color === "w" ? 1 : -1);
  const rating = getRating("chess").rating;

  useEffect(() => {
    if (started.current || game.result) return;
    started.current = true;
    track("game_start", "chess", { mode: "ai", level: game.level, color: game.color });
  }, [game.result, game.level, game.color]);

  // The engine's move, from the worker; a minimum delay so replies don't feel instant.
  useEffect(() => {
    if (over || st.turn === game.color) return;
    let live = true;
    const n = moves.length;
    const t0 = performance.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- engine status follows the turn
    setThinking(true);
    ask<string | null>({ type: "move", fen: game.fen, moves, level: game.level, seed: game.key })
      .then(async (uci) => {
        const wait = 380 - (performance.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (live && uci) setMoves((m) => (m.length === n ? [...m, uci] : m));
      })
      .catch(() => {})
      .finally(() => live && setThinking(false));
    return () => {
      live = false;
    };
  }, [moves, over, st.turn, game.color, game.fen, game.level, game.key]);

  // Save progress.
  useEffect(() => {
    writeJson(AI_KEY, { ...game, moves, undos, hints, elapsed: timer.now(), result: result ?? undefined } satisfies AiSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer.now is read on purpose
  }, [moves, undos, hints, result]);

  const finishGame = useCallback(
    (outcome: AiResult["outcome"], reason: string) => {
      const timeMs = Math.round(timer.now());
      const { rating: r, delta } = recordMatch("chess", `ai:${game.key}`, {
        puzzleRating: CHESS_LEVEL_RATING[game.level],
        won: outcome !== "loss",
        // A win scores like the fastest finish, a draw like the slowest.
        percentile: outcome === "win" ? 100 : 0,
        hints,
        mistakes: undos,
      });
      recordFinish("chess", { won: outcome === "win", timeMs, hints, level: `ai-${game.level}` });
      track("game_complete", "chess", { mode: "ai", level: game.level, outcome, plies: moves.length, hints, undos, timeMs });
      const res: AiResult = { outcome, reason, timeMs, ratingDelta: delta, rating: r };
      setResult(res);
      setShowRecap(true);
      ask<GameReview>({ type: "review", fen: game.fen, moves, color: game.color === "w" ? 0 : 1 })
        .then((review) => setResult((cur) => (cur ? { ...cur, review } : cur)))
        .catch(() => setResult((cur) => (cur ? { ...cur, review: null } : cur)));
    },
    [timer, game, hints, undos, moves]
  );

  // Game over on the board: mate, stalemate or a draw rule.
  useEffect(() => {
    if (!st.end || result) return;
    const outcome = st.winner ? (st.winner === game.color ? "win" : "loss") : "draw";
    const t = setTimeout(() => finishGame(outcome, END_TEXT[st.end!]), 600);
    return () => clearTimeout(t);
  }, [st.end, st.winner, result, game.color, finishGame]);

  const onMove = (m: UiMove) => {
    if (!myTurn) return;
    setHint(null);
    setWhy(false);
    setConfirmResign(false);
    setMoves([...moves, m.uci]);
  };

  // While the engine thinks, undo takes back your last move; on your turn, the
  // engine's reply and your move (never the engine's opening move as white).
  const canUndo = !result && (thinking ? moves.length >= 1 : myTurn && moves.length >= (game.color === "w" ? 2 : 3));
  const undo = () => {
    if (!canUndo) return;
    setHint(null);
    if (thinking) {
      cancelEngine();
      setThinking(false);
      setMoves((m) => m.slice(0, -1));
    } else {
      // Take back the engine's reply and your move.
      setMoves((m) => m.slice(0, -2));
    }
    setUndos((u) => u + 1);
  };

  const showHint = () => {
    if (!myTurn || hintsLeft <= 0) return;
    if (hint && hintFor === moves.length) return;
    setHints((n) => n + 1);
    setHint(null);
    setHintFor(moves.length);
    track("hint_used", "chess", { mode: "ai", level: game.level });
    ask<ChessHint | null>({ type: "hint", fen: game.fen, moves, timeMs: 900 })
      .then((h) => setHint(h))
      .catch(() => {});
  };

  useEffect(() => {
    if (!hintAfterAd || hintsLeft <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    showHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, hintsLeft]);

  const resign = () => {
    if (over) return;
    if (!confirmResign) return setConfirmResign(true);
    cancelEngine();
    setThinking(false);
    setConfirmResign(false);
    finishGame("loss", "You resigned");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        undo();
      } else if (mod || e.altKey) return;
      else if (k === "h") showHint();
      else if (k === "f") setOrientation((o) => (o === "w" ? "b" : "w"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (showRecap && result) {
    return <AiRecap game={game} date={date} moves={moves} hints={hints} undos={undos} result={result} nav={nav} onClose={() => setShowRecap(false)} />;
  }

  const activeHint = hint && hintFor === moves.length && myTurn ? hint : null;
  const hintSquares = activeHint ? moveSquares(activeHint.uci) : null;
  const last = moves.length ? moveSquares(moves[moves.length - 1]) : null;
  const top = orientation === game.color ? (game.color === "w" ? "b" : "w") : game.color;
  // Pieces shown beside a player are the ones they've captured.
  const capturedBy = (c: "w" | "b") => (c === "w" ? lost.b : lost.w);
  const plusFor = (c: "w" | "b") => (c === game.color ? balance : -balance);
  const statusText = result
    ? `${result.reason}. ${result.outcome === "win" ? "You win." : result.outcome === "loss" ? "You lose." : "It’s a draw."}`
    : st.end
      ? END_TEXT[st.end]
      : thinking
        ? `Level ${game.level} is thinking…`
        : myTurn
          ? st.check
            ? "Check! Your move."
            : "Your move."
          : "";

  return (
    <GameShell
      tint={GAME.tint}
      fullTint
      title="Chess"
      subtitle={`vs Level ${game.level} · ${info.name}`}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip dark>You: {colorName(game.color)}</Chip>
          <Chip>Undos {undos}</Chip>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
        </>
      }
    >
      <div className="flex flex-col gap-1.5" style={{ visibility: paused ? "hidden" : undefined }}>
        <CapturedRow pieces={capturedBy(top)} plus={plusFor(top)} />
        <div className="px-4">
          <Board
            board={board}
            orientation={orientation}
            legal={legal}
            lastMove={last}
            check={checkSquare(pos)}
            hint={hintSquares}
            onMove={onMove}
            label={`Chess board, ${orientation === "w" ? "white" : "black"} at the bottom`}
          />
        </div>
        <CapturedRow pieces={capturedBy(top === "w" ? "b" : "w")} plus={plusFor(top === "w" ? "b" : "w")} />
      </div>
      <StatusLine>{statusText}</StatusLine>

      <div className="px-4">
        {activeHint ? (
          <CoachCard
            heading="Coach · Best move"
            tag={activeHint.mate && activeHint.mate > 0 ? `Mate in ${activeHint.mate}` : undefined}
            onClose={() => setHint(null)}
            primary={{
              label: "Make this move",
              onClick: () => {
                const m = legal.find((x) => x.uci === activeHint.uci);
                if (m) onMove(m);
              },
            }}
            secondary={why ? undefined : { label: "Why this one?", onClick: () => setWhy(true) }}
          >
            {activeHint.text}
            {why && (
              <span className="mt-2 block">
                {activeHint.why.join(" ")}
              </span>
            )}
          </CoachCard>
        ) : hintFor === moves.length && myTurn && !hint ? (
          <CoachCard heading="Coach">Looking for the best move…</CoachCard>
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              over
                ? { label: "See recap", onClick: () => setShowRecap(true) }
                : hintsLeft
                  ? { label: "Show best move", onClick: showHint }
                  : offer.ready
                    ? {
                        label: "Watch an ad for one more hint",
                        onClick: async () => {
                          if (await offer.watch()) {
                            addBonus();
                            setHintAfterAd(true);
                          }
                        },
                      }
                    : undefined
            }
          >
            {over
              ? "Game over. The recap has your best move and one to learn from."
              : "Tap a piece, then a square, or drag it. Stuck? I’ll show the engine’s best move and explain why."}
          </CoachCard>
        )}
      </div>

      <MoveList fen={game.fen} moves={moves} />

      <div className="grid grid-cols-5 gap-2 px-4">
        <ToolButton surface="white" icon="undo" label="Undo" onClick={undo} disabled={!canUndo} />
        <ToolButton surface="white" icon="hint" label="Hint" accent onClick={showHint} disabled={!myTurn || !hintsLeft} />
        <ToolButton surface="white" icon="refresh" label="Flip" onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))} />
        <ToolButton surface="white" icon="close" label={confirmResign ? "Sure?" : "Resign"} active={confirmResign} onClick={resign} disabled={over} />
        <ToolButton surface="white" icon="menu" label="Options" onClick={() => setPaused(true)} />
      </div>

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          <ModeButtons current="ai" nav={nav} close={() => setPaused(false)} />
        </PauseSheet>
      )}
    </GameShell>
  );
}

function AiRecap({
  game,
  date,
  moves,
  hints,
  undos,
  result,
  nav,
  onClose,
}: {
  game: AiSaved;
  date: string;
  moves: string[];
  hints: number;
  undos: number;
  result: AiResult;
  nav: Nav;
  onClose: () => void;
}) {
  const info = LEVEL_INFO[game.level];
  const fullMoves = Math.ceil(moves.length / 2);
  const word = result.outcome === "win" ? "Won." : result.outcome === "loss" ? "Lost." : "Draw.";
  const label = `Level ${game.level} · ${info.name}`;
  const params = new URLSearchParams({ g: "chess", d: date, t: String(result.timeMs), r: result.outcome, mv: String(fullMoves), h: String(hints), lv: label });
  const text = [
    `Funzzle Chess · ${result.outcome === "win" ? "Beat" : result.outcome === "loss" ? "Lost to" : "Drew with"} ${label}`,
    `${result.reason} · ${fullMoves} moves · ${formatTime(result.timeMs)}`,
    "funzzle.com/play/chess",
  ].join("\n");
  const review = result.review;
  const keyMove =
    review === undefined
      ? "Reviewing your game…"
      : review?.key
        ? `${review.key.moveNo}. ${review.key.san}: it gained about ${(review.key.swing / 100).toFixed(1)} pawns on the engine’s count.`
        : "no single move swung the game; it was decided slowly.";
  const nextLevel = Math.min(6, game.level + 1) as Level;
  const nextSkill = review?.worst
    ? `On move ${review.worst.moveNo}, ${review.worst.san} cost about ${(review.worst.loss / 100).toFixed(1)} pawns; ${review.worst.better} was stronger. Before each move, check every capture and check your opponent would have.`
    : result.outcome === "win" && game.level < 6
      ? `Level ${nextLevel} · ${LEVEL_INFO[nextLevel].name}. ${LEVEL_INFO[nextLevel].blurb}.`
      : "Daily puzzles: tactics decide most games at every level.";
  return (
    <Recap
      game="chess"
      heading={`Chess · ${label}`}
      title={word}
      timeMs={result.timeMs}
      rankLine={`${result.reason} · ${colorName(game.color)} vs ${label}`}
      tiles={[
        { label: "Moves", value: String(fullMoves), note: `${undos} undo${undos === 1 ? "" : "s"}`, good: !undos },
        { label: "Hints", value: String(hints), note: hints ? "Coach helped" : "No help needed", good: !hints },
        {
          label: "Rating",
          value: result.rating.toLocaleString("en-US"),
          note: `${result.ratingDelta >= 0 ? "+" : ""}${result.ratingDelta} this game`,
          good: result.ratingDelta >= 0,
        },
      ]}
      coach={{
        keyMove,
        nextSkill,
        learn: {
          title: "Three habits that win games",
          body: "1. Before every move, look at your opponent’s checks, captures and threats. 2. Develop knights and bishops early and castle before you attack. 3. When you’re ahead, trade pieces, not pawns.",
        },
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={
        <>
          <button
            type="button"
            onClick={() => nav.startAi(game.level, readJson<{ color: "w" | "b" | "random" } | null>(SETUP_KEY, null)?.color ?? game.color)}
            className="min-h-[52px] rounded-full bg-ink px-4 text-[15px] font-semibold text-ground"
          >
            Play again at level {game.level}
          </button>
          {result.outcome === "win" && game.level < 6 && (
            <button type="button" onClick={() => nav.startAi(nextLevel, game.color)} className="min-h-[52px] rounded-full border border-line-strong px-4 text-[15px] font-semibold text-ink">
              Try level {nextLevel}
            </button>
          )}
          <PracticeAction game="chess" href="/play/chess?practice=puzzle" label="Solve a practice puzzle" />
        </>
      }
    />
  );
}
