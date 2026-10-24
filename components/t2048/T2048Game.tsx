"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import { Icon } from "@/components/kit/Icons";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { bestMove, maxTile, valueOf, WHY, type Daily2048, type Dir, type Hint } from "@/lib/games/t2048";
import { T2048_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getStreak } from "@/lib/games/kit/daily";
import { recordFinish } from "@/lib/games/kit/achievements";
import { challengeFromUrl, fetchChallenge } from "@/lib/games/kit/challenge";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatScore, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { countPractice } from "@/lib/games/kit/practiceQuota";
import { readJson, writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import { canUndo, cornerShare, initialState, MAX_HINTS, reducer, skillsFor, stuck, undosLeft, type PlayState } from "./state";

interface Saved {
  key: string;
  /** archive = a past day's daily (/archive): unranked. */
  mode: "daily" | "practice" | "archive";
  date?: string;
  /** Opened from a friend's challenge link (lib/games/kit/challenge.ts). */
  challengeId?: string;
  seed: string;
  play: PlayState;
  elapsed: number;
  done?: Finish;
}

interface Finish {
  timeMs: number;
  score: number;
  percentile?: number | null;
  stats?: DayStats | null;
  ratingDelta: number;
  rating: number;
  streak: number;
}

const GAME = GAME_BY_SLUG["2048"];
const DAILY_KEY = (date: string) => `fz:2048:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:2048:archive:${date}`;
const PRACTICE_KEY = "fz:2048:practice";
const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};
const ARROW_ROTATE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** Tile colors by exponent: a warm ramp from the 2048 signature color (shared with the share card). */
const TILE_BG = ["#FFF4DD", "#FFF4DD", "#FFE9B8", "#FFD98A", "#FFC857", "#FFB547", "#FF9F43", "#FF8A3D", "#F7B32B", "#F29E1F", "#EC8A12", "#E07A00", "#111111"];
const tileBg = (v: number) => TILE_BG[Math.min(TILE_BG.length - 1, v)];

const fresh = (key: string, mode: Saved["mode"], seed: string, extra: Partial<Saved> = {}): Saved => ({ key, mode, seed, play: initialState(seed), elapsed: 0, ...extra });

export default function T2048Game({ date, daily }: { date: string; daily: Daily2048 }) {
  const dailyKey = `${date}:${daily.seed}`;
  const [game, setGame] = useState<Saved>(() => fresh(dailyKey, "daily", daily.seed));
  const [loaded, setLoaded] = useState(false);

  const ran = useRef(false);
  useEffect(() => {
    // Once per page view (the URL's ?practice= is consumed on the first run).
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(location.search);
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (params.get("practice")) {
      // "Play a practice game" on the recap loads /play/2048?practice=1 as a new page view.
      history.replaceState(null, "", location.pathname);
      startPractice();
    } else if (challengeId) {
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== "2048") throw new Error("not a 2048 challenge");
          const p = c.puzzle;
          if (p.kind === "practice") return setGame(fresh(`${p.seed}:${challengeId}`, "practice", p.seed, { challengeId }));
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

  /** Restore today's saved daily (the initial state is already a fresh one). */
  function openDaily(challengeId?: string) {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    if (saved && saved.key === dailyKey) setGame(challengeId ? { ...saved, challengeId } : saved);
    else if (challengeId) setGame((g) => ({ ...g, challengeId }));
  }
  /** Switch back to today's daily from practice. */
  const backToDaily = () => {
    const saved = readJson<Saved | null>(DAILY_KEY(date), null);
    setGame(saved && saved.key === dailyKey ? saved : fresh(dailyKey, "daily", daily.seed));
  };

  /** A past day's daily game (the stored row, or the same seed regenerated). */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setGame(saved);
    const res = await fetch(`/api/daily-puzzle?game=2048&date=${day}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res?.ok) return openDaily();
    const d = (await res.json()) as Daily2048;
    setGame(fresh(`archive:${day}:${d.seed}`, "archive", d.seed, { date: day, challengeId }));
  }

  function startPractice() {
    countPractice("2048");
    const seed = `2048-practice:${crypto.randomUUID()}`;
    const next = fresh(seed, "practice", seed);
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice();
  };

  if (!loaded) return <Board key={`pre-${game.key}`} game={game} date={date} inert />;
  return <Board key={game.key} game={game} date={game.date ?? date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={backToDaily} />;
}

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
  const [play, dispatch] = useReducer(reducer, game.play);
  const [hint, setHint] = useState<Hint | null>(null);
  const [why, setWhy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  const [bonusHints, setBonusHints] = useState(0);
  const [announce, setAnnounce] = useState("");
  const s = play.game;
  const over = stuck(play);
  const ended = play.ended;
  const timer = useTimer(!inert && !paused && !ended && !over && !finish, game.elapsed);
  const started = useRef(false);
  const ranked = game.mode === "daily";
  const isDaily = game.mode !== "practice";
  const best = maxTile(s);
  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - play.hints);
  const undos = undosLeft(play);

  // Opt-in rewarded ads, offered only when one is actually available.
  const hintOffer = useRewardedOffer("2048-extra-hint", "2048", hintsLeft === 0 && !ended && !inert);
  const undoOffer = useRewardedOffer("2048-extra-undo", "2048", undos === 0 && play.past.length > 0 && !ended && !inert);

  // Board size follows the container width.
  const boardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(358);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const gap = Math.max(6, Math.round(width * 0.028));
  const cell = (width - gap * 5) / 4;

  // Save progress on every change.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, play, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "2048", { mode: game.mode });
  }, [inert, finish, game.mode]);

  // Stuck with no undo to offer (none left and no rewarded ad): the game ends.
  useEffect(() => {
    if (inert || ended || !over || canUndo(play)) return;
    if (undos === 0 && play.past.length > 0 && !undoOffer.settled) return;
    const t = setTimeout(() => dispatch({ type: "end" }), 900);
    return () => clearTimeout(t);
  }, [inert, ended, over, play, undos, undoOffer.settled]);

  // Finish: rank today's score, update rating and skills.
  useEffect(() => {
    if (!ended || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const score = s.score;
    track("game_complete", "2048", { mode: game.mode, timeMs, score, moves: s.moves, best: valueOf(best), hints: play.hints, undos: play.undosUsed });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = isDaily ? date : `practice:${game.seed}`;
      // Archive games are unrated: the day's field has moved on.
      const { rating, delta } =
        game.mode === "archive"
          ? { rating: getRating("2048").rating, delta: 0 }
          : recordMatch("2048", key, { puzzleRating: T2048_PUZZLE_RATING, won: true, percentile: percentile ?? undefined, hints: play.hints, mistakes: 0 });
      recordFinish("2048", { won: true, score, hints: play.hints, level: "classic", skills: skillsFor(play) });
      setFinish({ timeMs, score, percentile, stats, ratingDelta: delta, rating, streak: getStreak().current });
      setLoadingStats(false);
    };
    // The end is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    if (ranked) {
      setLoadingStats(true);
      submitResult({ game: "2048", date, timeMs, mistakes: 0, hints: play.hints, moves: s.moves, score }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const doMove = (dir: Dir) => {
    if (inert || paused || ended || finish) return;
    dispatch({ type: "move", dir, at: Math.round(timer.now()) });
    setHint(null);
    setWhy(false);
  };
  useEffect(() => {
    if (inert) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- live region text follows the score
    setAnnounce(`Score ${formatScore(s.score)}. Biggest tile ${valueOf(best)}.${over ? " No moves left." : ""}`);
  }, [s.score, best, over, inert]);

  const undo = async () => {
    if (canUndo(play)) {
      dispatch({ type: "undo" });
      setHint(null);
      return;
    }
    if (undos === 0 && play.past.length > 0 && undoOffer.ready && (await undoOffer.watch())) {
      dispatch({ type: "grant-undo" });
      dispatch({ type: "undo" });
      setHint(null);
    }
  };

  const showHint = () => {
    if (ended || finish || over) return;
    if (hintsLeft <= 0) return;
    const h = bestMove(s);
    if (!h) return;
    dispatch({ type: "hint-used" });
    track("hint_used", "2048", { reason: h.reason, mode: game.mode });
    setHint(h);
    setWhy(false);
  };

  // Keyboard: arrows / WASD slide, H hint, U or Ctrl+Z undo.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap) return;
      if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undo();
        return;
      }
      if (mod || e.altKey) return;
      const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      } else if (e.key.toLowerCase() === "h") showHint();
      else if (e.key.toLowerCase() === "u") void undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipe: one direction per gesture, decided on release.
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onDown = (e: ReactPointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onUp = (e: ReactPointerEvent) => {
    const st = swipe.current;
    swipe.current = null;
    if (!st || st.id !== e.pointerId) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  if (showRecap && finish) {
    return <T2048Recap game={game} date={date} play={play} finish={finish} onClose={() => setShowRecap(false)} />;
  }
  if (showRecap) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Game over. Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? "Practice"
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}`;
  const pos = (c: number) => ({ x: gap + (c % 4) * (cell + gap), y: gap + Math.floor(c / 4) * (cell + gap) });
  const undoLabel = undos > 0 ? `Undo · ${undos} left` : undoOffer.ready && play.past.length ? "Undo · ad" : "Undo · 0 left";

  return (
    <GameShell
      tint={GAME.tint}
      title={isDaily ? "Daily 2048" : "2048"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Score {formatScore(s.score)}</Chip>
          <Chip>Best tile {valueOf(Math.max(1, best))}</Chip>
          {isDaily && <Chip dark>Same tiles for everyone</Chip>}
        </>
      }
    >
      <style>{`@keyframes t2048-pop{0%{transform:scale(.4)}60%{transform:scale(1.1)}100%{transform:scale(1)}}`}</style>
      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div
          ref={boardRef}
          role="application"
          aria-label="2048 board. Swipe or use the arrow keys to slide the tiles."
          aria-roledescription="game board"
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (swipe.current = null)}
          className="relative w-full touch-none select-none rounded-[14px]"
          style={{ height: width, background: "color-mix(in srgb, #E0A23A 45%, var(--ground))" }}
        >
          {Array.from({ length: 16 }, (_, c) => (
            <div
              key={`cell-${c}`}
              aria-hidden="true"
              className="absolute rounded-[10px]"
              style={{ left: pos(c).x, top: pos(c).y, width: cell, height: cell, background: "color-mix(in srgb, #FFC857 22%, var(--ground))" }}
            />
          ))}
          {s.tiles.map((t) => {
            const p = pos(t.cell);
            const n = valueOf(t.v);
            const digits = String(n).length;
            return (
              <div
                key={t.id}
                className="absolute left-0 top-0"
                style={{ width: cell, height: cell, transform: `translate(${p.x}px, ${p.y}px)`, transition: "transform 110ms ease-out", zIndex: t.kind === "merge" ? 2 : 1 }}
              >
                <div
                  key={`${t.id}-${t.born}`}
                  aria-hidden="true"
                  className="flex h-full w-full items-center justify-center rounded-[10px] font-display font-extrabold tracking-[-0.03em]"
                  style={{
                    background: tileBg(t.v),
                    color: t.v >= 12 ? "#FFFFFF" : "#111111",
                    boxShadow: t.v >= 12 ? "0 0 0 2px #FFC857 inset" : t.v >= 8 ? "0 0 0 2px rgba(17,17,17,.12) inset" : undefined,
                    fontSize: cell * (digits <= 2 ? 0.44 : digits === 3 ? 0.36 : digits === 4 ? 0.29 : 0.23),
                    animation: t.born > 0 && t.born === s.moves ? "t2048-pop 140ms ease-out" : undefined,
                  }}
                >
                  {n}
                </div>
              </div>
            );
          })}
          {hint && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute flex h-14 w-14 items-center justify-center rounded-full bg-coach text-white"
              style={{ left: width / 2 - 28, top: width / 2 - 28, zIndex: 5, boxShadow: "0 4px 14px rgba(242,107,29,.45)" }}
            >
              <span style={{ transform: `rotate(${ARROW_ROTATE[hint.dir]}deg)`, display: "flex" }}>
                <Icon name="arrowRight" size={30} strokeWidth={2.6} />
              </span>
            </div>
          )}
          {over && !ended && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-black/55 p-6 text-center text-white">
              <span className="font-display text-[28px] font-extrabold">No moves left</span>
              <span className="text-sm">Score {formatScore(s.score)}</span>
              {canUndo(play) && (
                <button type="button" onClick={undo} className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-[#111111]">
                  Undo last move
                </button>
              )}
              {!canUndo(play) && undoOffer.ready && play.past.length > 0 && (
                <button type="button" onClick={undo} className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-[#111111]">
                  Watch a short ad to undo
                </button>
              )}
              <button type="button" onClick={() => dispatch({ type: "end" })} className="min-h-11 rounded-full border border-white px-5 text-sm font-semibold text-white">
                Finish game
              </button>
            </div>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>

      <div className="px-4">
        {hint ? (
          <CoachCard
            heading="Coach · Best move"
            tag={`${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left`}
            onClose={() => setHint(null)}
            primary={{ label: "Make this move", onClick: () => doMove(hint.dir) }}
            secondary={why ? undefined : { label: "Why this one?", onClick: () => setWhy(true) }}
          >
            {hint.text}
            {why && <span className="mt-2 block">{whyText(hint)}</span>}
          </CoachCard>
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              ended || over
                ? undefined
                : hintsLeft
                  ? { label: "Show best move", onClick: showHint }
                  : hintOffer.ready
                    ? {
                        label: "Watch an ad for one more hint",
                        onClick: async () => {
                          if (await hintOffer.watch()) setBonusHints((b) => b + 1);
                        },
                      }
                    : undefined
            }
          >
            {ended
              ? "Game over. Open the recap to see how you did."
              : hintsLeft
                ? "Swipe or use the arrow keys. Stuck? I’ll look a few moves ahead and pick the safest slide."
                : "You’ve used this game’s hints. Keep your biggest tile in a corner and fill the row next to it."}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 px-4">
        <ToolButton icon="undo" label={undoLabel} onClick={undo} disabled={ended || !play.past.length || (undos === 0 && !undoOffer.ready)} />
        <ToolButton icon="hint" label={`Hint · ${hintsLeft} left`} accent onClick={showHint} disabled={!hintsLeft || ended || over || !!hint} />
        <ToolButton icon="refresh" label="New game" onClick={() => (game.mode === "practice" ? onPractice?.() : onResumePractice?.())} disabled={inert} />
        <ToolButton icon="menu" label="Options" onClick={() => setPaused(true)} />
      </div>

      {finish && (
        <div className="px-4">
          <button type="button" onClick={() => setShowRecap(true)} className="min-h-[52px] w-full rounded-full bg-ink text-base font-semibold text-ground">
            See recap
          </button>
        </div>
      )}

      {paused && (
        <PauseSheet
          onResume={() => {
            setPaused(false);
            setConfirmEnd(false);
          }}
        >
          {!ended && (
            <SheetButton
              onClick={() => {
                if (!confirmEnd) return setConfirmEnd(true);
                setPaused(false);
                setConfirmEnd(false);
                dispatch({ type: "end" });
              }}
            >
              {confirmEnd ? `Tap again to end with ${formatScore(s.score)} points` : "End game"}
            </SheetButton>
          )}
          {game.mode === "practice" ? (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                New practice game
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s Daily 2048
              </SheetButton>
            </>
          ) : (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice?.();
              }}
            >
              Practice games
            </SheetButton>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

function whyText(h: Hint): string {
  return `${WHY[h.reason]} I looked two or three moves ahead, averaging over where the next tile could appear.`;
}

function T2048Recap({ game, date, play, finish, onClose }: { game: Saved; date: string; play: PlayState; finish: Finish; onClose: () => void }) {
  const s = play.game;
  const isDaily = game.mode !== "practice";
  const best = maxTile(s);
  const bestValue = valueOf(Math.max(1, best));
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const params = new URLSearchParams({
    g: "2048",
    d: date,
    t: String(Math.max(1000, finish.timeMs)),
    sc: String(finish.score),
    bt: String(bestValue < 2 ? 2 : bestValue),
    mv: String(s.moves),
    s: String(finish.streak),
    h: String(play.hints),
    lv: isDaily ? "" : "Practice",
  });
  if (top !== null && game.mode === "daily") params.set("top", String(top));
  const text = [
    `Funzzle ${isDaily ? "Daily 2048" : "2048 practice"} · ${short}`,
    `${formatScore(finish.score)} points · best tile ${bestValue}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${s.moves} moves · ${play.hints} hint${play.hints === 1 ? "" : "s"}`,
    "funzzle.com/play/2048",
  ].join("\n");

  const first = play.reached[best];
  const keyMove = first
    ? `${first.at ? `at ${formatTime(first.at)} ` : ""}(move ${first.move}) you made your ${bestValue}, the biggest tile of the game.`
    : `you built up to a ${bestValue} in ${s.moves} moves.`;
  const corner = cornerShare(play);
  const nextSkill =
    play.bigMoves >= 20 && corner < 0.7
      ? `Corner keeper. Your biggest tile sat in a corner ${Math.round(corner * 100)}% of the time; aim for 90%. Pick one corner and avoid the one slide that pulls the big tile out.`
      : best < 11
        ? `The ${bestValue * 2} tile. Keep the row along your corner full and ordered from big to small, so each new tile merges up the chain.`
        : "4096. Past 2048 the board is half-full of big tiles: plan two merges ahead before you slide.";

  return (
    <Recap
      game="2048"
      heading={isDaily ? `Daily 2048 · ${short}${game.mode === "archive" ? " · archive" : ""}` : "2048 practice"}
      title={best >= 11 ? "2048!" : "Game over."}
      timeMs={finish.timeMs}
      score={finish.score}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Best tile", value: String(bestValue), note: best >= 11 ? "You made 2048" : `Next: ${bestValue * 2}`, good: best >= 11 },
        { label: "Moves", value: String(s.moves), note: `${play.undosUsed} undo${play.undosUsed === 1 ? "" : "s"} · ${play.hints} hint${play.hints === 1 ? "" : "s"}`, good: !play.undosUsed && !play.hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive games are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: isDaily ? { kind: "daily", date } : { kind: "practice", seed: game.seed, level: "classic" },
        label: isDaily ? `Daily 2048 · ${short}` : "2048 practice",
        result: { timeMs: Math.max(1000, finish.timeMs), mistakes: 0, hints: play.hints, moves: s.moves, score: finish.score },
        activeId: game.challengeId,
      }}
      coach={{
        keyMove,
        nextSkill,
        learn: {
          title: "The corner strategy in 2 minutes",
          body: "1. Choose a corner, say bottom-left, and keep your biggest tile there. 2. Keep the bottom row full, ordered big to small away from the corner, so it can’t shift. 3. Slide mostly left and down; use right when you must, and up only when nothing else moves. 4. Merge small tiles early: empty squares are your safety margin.",
        },
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={<PracticeAction game="2048" href="/play/2048?practice=1" label="Play a practice game" />}
    />
  );
}
