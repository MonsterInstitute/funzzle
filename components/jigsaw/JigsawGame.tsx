"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip, ToolButton } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import {
  drawPicture,
  isPieceCount,
  makeCut,
  PIC_H,
  PIC_W,
  PIECE_COUNTS,
  pieceBox,
  snaps,
  suggestPiece,
  trayOrder,
  type Cut,
  type DailyJigsaw,
  type Piece,
  type PieceCount,
  type PieceHint,
} from "@/lib/games/jigsaw";
import { JIGSAW_PUZZLE_RATING } from "@/lib/games/dailySchedule";
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
import { edgesFirst, frameDoneAt, initialState, isComplete, placedCount, reducer, skillsFor, type PlayState } from "./state";

interface Saved {
  key: string;
  /** archive = a past day's daily puzzle (/archive): unranked. */
  mode: "daily" | "practice" | "archive";
  /** The archive puzzle's date. */
  date?: string;
  /** Opened from a friend's challenge link (lib/games/kit/challenge.ts). */
  challengeId?: string;
  seed: string;
  count: PieceCount;
  state: PlayState;
  elapsed: number;
  done?: Finish;
}

interface Finish {
  timeMs: number;
  percentile?: number | null;
  stats?: DayStats | null;
  ratingDelta: number;
  rating: number;
  streak: number;
}

const GAME = GAME_BY_SLUG.jigsaw;
const DAILY_KEY = (date: string) => `fz:jigsaw:daily:${date}`;
const ARCHIVE_KEY = (date: string) => `fz:jigsaw:archive:${date}`;
const PRACTICE_KEY = "fz:jigsaw:practice";
/** Free "Show a piece" hints per puzzle; more via an opt-in rewarded ad. */
export const MAX_HINTS = 3;

function fresh(key: string, mode: Saved["mode"], seed: string, count: PieceCount, extra: Partial<Saved> = {}): Saved {
  return { key, mode, seed, count, state: initialState(count), elapsed: 0, ...extra };
}

export default function JigsawGame({ date, daily }: { date: string; daily: DailyJigsaw }) {
  const dailyKey = `${date}:${daily.seed}:${daily.pieces}`;
  const [game, setGame] = useState<Saved>(() => fresh(dailyKey, "daily", daily.seed, daily.pieces));
  const [loaded, setLoaded] = useState(false);
  // The URL is read once: a second effect run (dev Strict Mode) must not undo ?practice=.
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const params = new URLSearchParams(location.search);
    // "Play a practice puzzle" on the recap loads /play/jigsaw?practice=<pieces>
    // as a new page view (components/kit/PracticeAction).
    const want = Number(params.get("practice"));
    const archiveDate = params.get("date");
    const challengeId = challengeFromUrl();
    if (params.get("practice") && isPieceCount(want)) {
      history.replaceState(null, "", location.pathname);
      startPractice(want);
    } else if (challengeId) {
      // A friend's challenge: the same picture and cut they played.
      fetchChallenge(challengeId)
        .then((c) => {
          if (c.game !== "jigsaw") throw new Error("not a jigsaw challenge");
          const p = c.puzzle;
          if (p.kind === "practice") {
            const n = Number(p.level);
            return setGame(fresh(`${p.seed}:${challengeId}`, "practice", p.seed, isPieceCount(n) ? n : 24, { challengeId }));
          }
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
    if (saved && saved.key === dailyKey) setGame(challengeId ? { ...saved, challengeId } : saved);
    else setGame(fresh(dailyKey, "daily", daily.seed, daily.pieces, challengeId ? { challengeId } : {}));
  }

  /** A past day's daily puzzle (the stored one, or regenerated from its seed). */
  async function openArchive(day: string, challengeId?: string) {
    const saved = readJson<Saved | null>(ARCHIVE_KEY(day), null);
    if (saved && !challengeId) return setGame(saved);
    try {
      const res = await fetch(`/api/daily-puzzle?game=jigsaw&date=${day}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return openDaily();
      const p = (await res.json()) as DailyJigsaw;
      setGame(fresh(`archive:${day}`, "archive", p.seed, isPieceCount(p.pieces) ? p.pieces : 24, { date: day, challengeId }));
    } catch {
      openDaily();
    }
  }

  function startPractice(count: PieceCount) {
    countPractice("jigsaw");
    const seed = `jigsaw-practice:${crypto.randomUUID()}`;
    const next = fresh(seed, "practice", seed, count);
    writeJson(PRACTICE_KEY, next);
    setGame(next);
  }
  const resumePractice = () => {
    const saved = readJson<Saved | null>(PRACTICE_KEY, null);
    if (saved && !saved.done) setGame(saved);
    else startPractice(24);
  };

  if (!loaded) return <Board key={`pre-${game.key}`} game={game} date={date} inert />;
  return (
    <Board key={game.key} game={game} date={game.date ?? date} onPractice={startPractice} onResumePractice={resumePractice} onDaily={() => openDaily()} />
  );
}

/** The picture as an object URL: one short href shared by every piece. */
function usePictureUrl(svg: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL only exists in the browser
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [svg]);
  return url;
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
  onPractice?: (n: PieceCount) => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const storageKey = game.mode === "daily" ? DAILY_KEY(date) : game.mode === "archive" ? ARCHIVE_KEY(date) : PRACTICE_KEY;
  const cut = useMemo(() => makeCut(game.seed, game.count), [game.seed, game.count]);
  const picture = useMemo(() => drawPicture(game.seed), [game.seed]);
  const picUrl = usePictureUrl(picture.svg);
  const uid = useId().replace(/:/g, "");
  const [state, dispatch] = useReducer(reducer, game.state);
  const [tray, setTray] = useState<number[]>(() => trayOrder(game.seed, game.count));
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [hint, setHint] = useState<PieceHint | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(game.done ?? null);
  const [showRecap, setShowRecap] = useState(!!game.done);
  const [loadingStats, setLoadingStats] = useState(false);
  // Opt-in rewarded ad: one more hint after the free ones, only when an ad is ready.
  const [bonusHints, setBonusHints] = useState(0);
  const [hintAfterAd, setHintAfterAd] = useState(false);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("jigsaw-extra-hint", "jigsaw", outOfHints && !finish && !inert);
  const complete = isComplete(state);
  const timer = useTimer(!inert && !paused && !complete && !finish, game.elapsed);
  const started = useRef(false);
  const ranked = game.mode === "daily";
  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const rating = getRating("jigsaw").rating;

  // Board scale (px per picture unit) follows the container width.
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardW, setBoardW] = useState(358);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoardW(el.clientWidth));
    ro.observe(el);
    setBoardW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = boardW / PIC_W;
  const boxW = cut.cellW + 2 * cut.pad;
  const trayScale = Math.max(60 / boxW, Math.min(scale, 104 / boxW));

  const day = new Date(`${date}T00:00:00Z`);
  const subtitle =
    game.mode === "practice"
      ? `Practice · ${game.count} pieces`
      : `${game.mode === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${game.count} pieces`;

  // Save progress on every change.
  useEffect(() => {
    if (inert) return;
    writeJson(storageKey, { ...game, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer.now is read on purpose
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "jigsaw", { mode: game.mode, pieces: game.count });
  }, [inert, finish, game.mode, game.count]);

  // Finish: rank against today's players, rating, stats and skills.
  useEffect(() => {
    if (!complete || finish || inert) return;
    const timeMs = Math.round(timer.now());
    const hints = state.hints;
    track("game_complete", "jigsaw", { mode: game.mode, pieces: game.count, timeMs, hints });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const key = game.mode === "daily" ? date : `practice:${game.seed}`;
      // Archive puzzles are unrated: the day's field has moved on.
      const { rating: r, delta } =
        game.mode === "archive"
          ? { rating: getRating("jigsaw").rating, delta: 0 }
          : recordMatch("jigsaw", key, { puzzleRating: JIGSAW_PUZZLE_RATING[game.count], won: true, percentile: percentile ?? undefined, hints, mistakes: 0 });
      recordFinish("jigsaw", { won: true, timeMs, hints, level: String(game.count), skills: skillsFor(cut, state, timeMs) });
      setFinish({ timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
      setLoadingStats(false);
    };
    // Completion is detected from state, so the recap opens from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRecap(true);
    setHint(null);
    if (ranked) {
      setLoadingStats(true);
      submitResult({ game: "jigsaw", date, timeMs, mistakes: 0, hints, moves: game.count }).then((res) => finalize(res ? res.percentile : undefined, res));
    } else finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const place = (id: number, coached = false) => {
    if (state.placed[id] || finish) return;
    dispatch({ type: "place", id, at: Math.round(timer.now()), coached });
    setSelected(null);
    setNote(null);
    if (hint?.pieceId === id) setHint(null);
    setCursor(id);
  };

  const trayRefs = useRef(new Map<number, HTMLButtonElement>());
  const loose = tray.filter((id) => !state.placed[id]);
  const visible = edgesOnly ? loose.filter((id) => cut.pieces[id].border) : loose;

  const showHint = () => {
    if (finish || inert || outOfHints) return;
    const h = suggestPiece(cut, state.placed);
    if (!h) return;
    dispatch({ type: "hint-used" });
    track("hint_used", "jigsaw", { reason: h.reason, mode: game.mode });
    if (edgesOnly && !cut.pieces[h.pieceId].border) setEdgesOnly(false);
    setHint(h);
    setSelected(h.pieceId);
    setNote(null);
    requestAnimationFrame(() => trayRefs.current.get(h.pieceId)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
  };

  // The bonus hint opens as soon as the rewarded ad has been watched.
  useEffect(() => {
    if (!hintAfterAd || outOfHints) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot after the ad
    setHintAfterAd(false);
    showHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintAfterAd, outOfHints]);

  const togglePreview = () => {
    if (!preview) dispatch({ type: "preview-opened" });
    setPreview((v) => !v);
  };

  /** Tap or Enter on a board spot with a piece selected. */
  const trySlot = (slot: number) => {
    if (finish) return;
    setCursor(slot);
    if (state.placed[slot]) return setNote("That spot is already filled.");
    if (selected === null) return setNote("Pick a piece from the tray first, then choose its spot.");
    if (selected === slot) place(slot);
    else setNote("That piece doesn’t go there. Check its flat sides and colors, and try another spot.");
  };

  // ----- Pointer: drag a tray piece onto the board; tap to select -----
  const drag = useRef<{ id: number; startX: number; startY: number; touch: boolean; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragView, setDragView] = useState<{ id: number; x: number; y: number; touch: boolean } | null>(null);
  /** On touch the piece rides above the finger so it stays visible. */
  const liftFor = (touch: boolean) => (touch ? (cut.cellH / 2 + cut.pad) * scale + 28 : 0);

  const onPieceDown = (e: ReactPointerEvent, id: number) => {
    if (paused || finish || inert || e.button > 0) return;
    // A mouse drag shouldn't select text; touch keeps its default so the tray can scroll.
    if (e.pointerType === "mouse") e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, startX: e.clientX, startY: e.clientY, touch: e.pointerType !== "mouse", moved: false };
  };
  const onPieceMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 8) d.moved = true;
    if (d.moved) setDragView({ id: d.id, x: e.clientX, y: e.clientY, touch: d.touch });
  };
  const onPieceUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragView(null);
    if (!d || !d.moved) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    const rect = boardRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / scale;
    const cy = (e.clientY - liftFor(d.touch) - rect.top) / scale;
    const p = cut.pieces[d.id];
    if (snaps(cut, p, cx, cy)) place(d.id);
    else if (cx > -20 && cy > -20 && cx < PIC_W + 20 && cy < PIC_H + 20) {
      setSelected(d.id);
      setNote("Not quite there: the piece went back to the tray. Tap a spot on the board to try it there, or drag again.");
    }
  };
  const onPieceCancel = () => {
    drag.current = null;
    setDragView(null);
  };

  // Keyboard: H hint, E edge filter, P preview.
  useEffect(() => {
    if (inert) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused || showRecap || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "h") showHint();
      else if (k === "e") setEdgesOnly((v) => !v);
      else if (k === "p") togglePreview();
      else if (k === "escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onSlotKey = (e: React.KeyboardEvent, i: number) => {
    const p = cut.pieces[i];
    const go: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (!(e.key in go)) return;
    e.preventDefault();
    const [dr, dc] = go[e.key];
    const r = Math.min(cut.rows - 1, Math.max(0, p.row + dr));
    const c = Math.min(cut.cols - 1, Math.max(0, p.col + dc));
    const next = r * cut.cols + c;
    setCursor(next);
    slotRefs.current[next]?.focus();
  };

  if (showRecap && finish) {
    return <JigsawRecap game={game} date={date} cut={cut} pictureName={picture.name} state={state} finish={finish} onClose={() => setShowRecap(false)} canPractice={!!onPractice} />;
  }
  if (showRecap) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center" style={{ background: GAME.tint }}>
        <p className="text-lg font-semibold text-[#111111]">Done! Comparing with today’s players{loadingStats ? "…" : ""}</p>
      </div>
    );
  }

  const n = placedCount(state);
  const placedPieces = cut.pieces.filter((p) => state.placed[p.id]);
  const hintPiece = hint ? cut.pieces[hint.pieceId] : null;
  const dragPiece = dragView ? cut.pieces[dragView.id] : null;
  const borderLeft = loose.some((id) => cut.pieces[id].border);

  return (
    <GameShell
      tint={GAME.tint}
      fullTint
      title={game.mode === "practice" ? "Jigsaw" : "Daily Jigsaw"}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>
            Placed {n} / {game.count}
          </Chip>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip dark={edgesOnly} onClick={() => setEdgesOnly((v) => !v)} pressed={edgesOnly}>
            Edges only
          </Chip>
        </>
      }
    >
      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div ref={boardRef} className="relative w-full select-none overflow-hidden rounded-[14px] border-2 border-[#111111]" style={{ aspectRatio: `${PIC_W} / ${PIC_H}`, background: "#DCE7F8" }}>
          <svg viewBox={`0 0 ${PIC_W} ${PIC_H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <pattern id={`${uid}-dots`} width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1.6" fill="#B7C8E6" />
              </pattern>
              <clipPath id={`${uid}-placed`}>
                {placedPieces.map((p) => (
                  <path key={p.id} d={p.path} />
                ))}
              </clipPath>
            </defs>
            <rect width={PIC_W} height={PIC_H} fill={`url(#${uid}-dots)`} />
            {preview && picUrl && <image href={picUrl} width={PIC_W} height={PIC_H} opacity={0.22} />}
            <g clipPath={`url(#${uid}-placed)`}>
              {picUrl ? <image href={picUrl} width={PIC_W} height={PIC_H} /> : <rect width={PIC_W} height={PIC_H} fill="#C9D6EE" />}
            </g>
            {placedPieces.map((p) => (
              <path key={p.id} d={p.path} fill="none" stroke="rgba(17,17,17,0.22)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {hintPiece && <path d={hintPiece.path} fill="rgba(242,107,29,0.18)" stroke="#F26B1D" strokeWidth={3} strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />}
          </svg>
          {/* One spot per piece: tap (or Enter) to place the selected piece there. */}
          <div role="grid" aria-label="Jigsaw board" className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cut.cols}, 1fr)`, gridTemplateRows: `repeat(${cut.rows}, 1fr)` }}>
            {Array.from({ length: cut.rows }, (_, r) => (
              <div key={r} role="row" className="contents">
                {Array.from({ length: cut.cols }, (_, c) => {
                  const i = r * cut.cols + c;
                  return (
                    <button
                      key={i}
                      ref={(el) => {
                        slotRefs.current[i] = el;
                      }}
                      type="button"
                      role="gridcell"
                      tabIndex={i === cursor ? 0 : -1}
                      aria-label={`Row ${r + 1}, column ${c + 1}${state.placed[i] ? ", filled" : ""}`}
                      onClick={() => trySlot(i)}
                      onKeyDown={(e) => onSlotKey(e, i)}
                      className="m-0 border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-[#5B3DF5]"
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="select-none px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div className="flex items-center justify-between pb-1.5 text-[13px] font-semibold text-[#2A3A5C]">
          <span>{edgesOnly ? "Edge pieces" : "Pieces"} · {visible.length}</span>
          <span className="text-xs font-medium">Drag up onto the board, or tap a piece then its spot</span>
        </div>
        <div className="overflow-x-auto overscroll-x-contain rounded-[18px] bg-white/70 p-2" aria-label="Piece tray" role="region">
          {visible.length ? (
            <div className="grid w-max grid-flow-col grid-rows-2 gap-1.5">
              {visible.map((id, k) => {
                const p = cut.pieces[id];
                const isSel = selected === id;
                const isHint = hint?.pieceId === id;
                const hidden = dragView?.id === id;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      if (el) trayRefs.current.set(id, el);
                      else trayRefs.current.delete(id);
                    }}
                    type="button"
                    data-id={id}
                    aria-pressed={isSel}
                    aria-label={`Piece ${k + 1} of ${visible.length}, ${p.corner ? "corner" : p.border ? "edge" : "inside"} piece`}
                    onPointerDown={(e) => onPieceDown(e, id)}
                    onPointerMove={onPieceMove}
                    onPointerUp={onPieceUp}
                    onPointerCancel={onPieceCancel}
                    onClick={() => {
                      if (suppressClick.current) return;
                      setSelected(isSel ? null : id);
                      setNote(null);
                    }}
                    className="flex items-center justify-center rounded-xl p-0"
                    style={{
                      width: boxW * trayScale,
                      height: (cut.cellH + 2 * cut.pad) * trayScale,
                      touchAction: "pan-x",
                      opacity: hidden ? 0.25 : 1,
                      background: isHint ? "rgba(242,107,29,0.16)" : isSel ? "rgba(91,61,245,0.14)" : "transparent",
                      boxShadow: isHint ? "inset 0 0 0 2px #F26B1D" : isSel ? "inset 0 0 0 2px #5B3DF5" : undefined,
                    }}
                  >
                    <PieceSvg cut={cut} piece={p} picUrl={picUrl} px={trayScale} clipId={`${uid}-t${id}`} />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="m-0 px-2 py-4 text-sm font-semibold text-[#2A3A5C]">
              {edgesOnly && loose.length ? "Every edge piece is placed. Turn off Edges only for the rest." : "All pieces placed."}
            </p>
          )}
        </div>
      </div>

      {dragView && dragPiece && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-50"
          style={{
            transform: `translate(${dragView.x - (cut.cellW / 2 + cut.pad) * scale}px, ${dragView.y - liftFor(dragView.touch) - (cut.cellH / 2 + cut.pad) * scale}px) scale(1.03)`,
          }}
        >
          <PieceSvg cut={cut} piece={dragPiece} picUrl={picUrl} px={scale} clipId={`${uid}-drag`} lifted />
        </div>
      )}

      <div className="px-4">
        {hint ? (
          <CoachCard
            heading="Coach · Show a piece"
            tag={`${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left`}
            onClose={() => setHint(null)}
            primary={{ label: "Place it", onClick: () => place(hint.pieceId, true) }}
          >
            {hint.text} It’s highlighted in the tray, and its spot is outlined on the board.
          </CoachCard>
        ) : note ? (
          <CoachCard heading="Coach" onClose={() => setNote(null)}>
            {note}
          </CoachCard>
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              hintsLeft && !finish
                ? { label: "Show a piece", onClick: showHint }
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
              ? "Done. Open the recap to see how you did."
              : n === 0
                ? "Start with the corners and edges: turn on Edges only to see just the border pieces."
                : borderLeft
                  ? "Finish the frame, then fill in by color. Stuck? I’ll show you a piece that fits next to the ones you’ve placed."
                  : "Frame done. Fill in by color and shape. Stuck? I’ll show you a piece that fits."}
          </CoachCard>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 px-4">
        <ToolButton surface="white" icon="copy" label="Edges" active={edgesOnly} onClick={() => setEdgesOnly((v) => !v)} />
        <ToolButton surface="white" icon="search" label="Preview" active={preview} onClick={togglePreview} />
        <ToolButton surface="white" icon="refresh" label="Shuffle" onClick={() => setTray((t) => [...t].sort(() => Math.random() - 0.5))} disabled={!!finish} />
        <ToolButton surface="white" icon="hint" label={`Hint · ${hintsLeft}`} accent onClick={showHint} disabled={!hintsLeft || !!finish} />
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
          <p className="m-0 text-sm font-semibold">New practice puzzle</p>
          <div className="grid grid-cols-4 gap-2">
            {PIECE_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setPaused(false);
                  onPractice?.(c);
                }}
                className="min-h-11 rounded-full border border-line-strong text-sm font-semibold text-ink"
              >
                {c} pieces
              </button>
            ))}
          </div>
          {game.mode === "daily" ? (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice?.();
              }}
            >
              Resume my practice puzzle
            </SheetButton>
          ) : (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onDaily?.();
              }}
            >
              Back to today’s Daily Jigsaw
            </SheetButton>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

/** One piece, drawn at `px` pixels per picture unit: the picture clipped to its outline. */
function PieceSvg({ cut, piece, picUrl, px, clipId, lifted = false }: { cut: Cut; piece: Piece; picUrl: string | null; px: number; clipId: string; lifted?: boolean }) {
  const b = pieceBox(cut, piece);
  return (
    <svg
      width={b.w * px}
      height={b.h * px}
      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
      aria-hidden="true"
      style={{ filter: lifted ? "drop-shadow(0 6px 8px rgba(0,0,0,0.35))" : "drop-shadow(0 1px 1.5px rgba(0,0,0,0.3))", overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={piece.path} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {picUrl ? <image href={picUrl} width={PIC_W} height={PIC_H} /> : <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#C9D6EE" />}
      </g>
      <path d={piece.path} fill="none" stroke="rgba(17,17,17,0.55)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function JigsawRecap({
  game,
  date,
  cut,
  pictureName,
  state,
  finish,
  onClose,
  canPractice,
}: {
  game: Saved;
  date: string;
  cut: Cut;
  pictureName: string;
  state: PlayState;
  finish: Finish;
  onClose: () => void;
  canPractice: boolean;
}) {
  const isDaily = game.mode !== "practice";
  const short = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const hints = state.hints;
  const label = `${game.count} pieces`;
  const params = new URLSearchParams({
    g: "jigsaw",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(hints),
    mv: String(game.count),
    lv: isDaily ? label : `Practice · ${label}`,
  });
  if (top !== null && game.mode === "daily") params.set("top", String(top));
  const text = [
    `Funzzle ${isDaily ? "Daily Jigsaw" : "Jigsaw practice"} · ${short} · ${label}`,
    `${formatTime(finish.timeMs)}${top !== null && game.mode === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `${hints} hint${hints === 1 ? "" : "s"}`,
    "funzzle.com/play/jigsaw",
  ].join("\n");

  const frameAt = frameDoneAt(cut, state);
  const first = edgesFirst(cut, state);
  const borderCount = cut.pieces.filter((p) => p.border).length;
  const insideBeforeFrame = frameAt === null ? 0 : state.order.filter((id) => !cut.pieces[id].border && state.placedAt[id] < frameAt).length;
  const coached = state.coached.length;
  const keyMove =
    (first && frameAt !== null
      ? `you built the whole frame first (all ${borderCount} edge pieces by ${formatTime(frameAt)}), then filled in the middle. That’s the method that keeps big puzzles manageable.`
      : frameAt !== null
        ? `your frame was complete at ${formatTime(frameAt)}, with ${insideBeforeFrame} inside piece${insideBeforeFrame === 1 ? "" : "s"} placed before it.`
        : "you finished the picture.") + (coached ? ` The coach placed ${coached} piece${coached === 1 ? "" : "s"}.` : "");
  const nextSkill = !first
    ? "Edges first. Turn on Edges only and build the frame before anything else: it gives every other piece a place to start from."
    : state.previewUsed
      ? "From memory. Try the next one without opening the preview: look at each piece’s colors and shapes instead."
      : hints > 0
        ? "Unaided. Before asking for a piece, look for one with a tab that matches a blank on the board’s edge."
        : game.count < 96
          ? `A bigger puzzle. You’ve got ${game.count} pieces down; try ${PIECE_COUNTS[PIECE_COUNTS.indexOf(game.count) + 1]} in practice.`
          : "Speed. You can do 96 pieces unaided; now try to beat " + formatTime(finish.timeMs) + ".";
  const nextSize = (game.count === 96 ? 96 : PIECE_COUNTS[PIECE_COUNTS.indexOf(game.count) + 1]) as PieceCount;

  return (
    <Recap
      game="jigsaw"
      heading={isDaily ? `Daily Jigsaw · ${short}${game.mode === "archive" ? " · archive" : ""}` : `Jigsaw practice · ${label}`}
      title="Done."
      timeMs={finish.timeMs}
      percentile={game.mode === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      tiles={[
        { label: "Pieces", value: String(game.count), note: pictureName },
        { label: "Hints", value: String(hints), note: hints ? "Coach helped" : "No help needed", good: !hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: game.mode === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${isDaily ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: isDaily ? { kind: "daily", date } : { kind: "practice", seed: game.seed, level: String(game.count) },
        label: isDaily ? `Daily Jigsaw · ${short} · ${label}` : `Jigsaw practice · ${label}`,
        result: { timeMs: finish.timeMs, mistakes: 0, hints, moves: game.count },
        activeId: game.challengeId,
      }}
      coach={{
        keyMove,
        nextSkill,
        learn: {
          title: "How to solve any jigsaw",
          body: "1. Corners and edges first: turn on Edges only and build the frame. 2. Sort the rest by color and region: sky, hills, water, shapes. 3. Read the shape: a piece with two tabs on opposite sides fits only between two blanks.",
        },
      }}
      share={{ imageUrl: `/api/share-card?${params}`, text }}
      onClose={onClose}
      extraActions={canPractice && <PracticeAction game="jigsaw" href={`/play/jigsaw?practice=${nextSize}`} label={`Play a ${nextSize}-piece practice puzzle`} />}
    />
  );
}
