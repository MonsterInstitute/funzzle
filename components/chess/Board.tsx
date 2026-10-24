"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { pieceLabel, squareLabel, type PieceCode, type Promotion, type UiMove } from "@/lib/games/chess";
import { PieceSvg } from "./Pieces";

const LIGHT = "#EFE4CF";
const DARK = "#B79C74";

export interface BoardProps {
  board: (PieceCode | null)[];
  /** Whose side is at the bottom. */
  orientation: "w" | "b";
  /** Legal moves for the side that may move now (empty when the board is locked). */
  legal: UiMove[];
  lastMove?: { from: number; to: number } | null;
  /** Square of a king in check, or -1. */
  check?: number;
  /** Coach highlight: squares to look at / the move to play. */
  hint?: { from: number; to?: number } | null;
  /** Briefly shown wrong move (puzzles). */
  wrong?: { from: number; to: number } | null;
  onMove: (move: UiMove) => void;
  label: string;
}

/**
 * Chess board: tap a piece then a square, or drag it. Legal targets show as
 * dots (rings for captures); the last move, check and the coach's squares are
 * tinted. Every square is a button ("e4, white knight"), arrow keys move
 * between squares and Enter/Space picks up and drops.
 */
export default function Board({ board, orientation, legal, lastMove, check = -1, hint, wrong, onMove, label }: BoardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [focus, setFocus] = useState<number>(orientation === "w" ? 12 : 52);
  const [promo, setPromo] = useState<{ moves: UiMove[]; to: number } | null>(null);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number } | null>(null);
  const dragRef = useRef<{ from: number; startX: number; startY: number; moved: boolean; pointerId: number } | null>(null);
  const suppressClick = useRef(false);
  const squares = useRef<(HTMLButtonElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  const movesFrom = (sq: number) => legal.filter((m) => m.from === sq);
  const targets = selected === null ? [] : movesFrom(selected);
  const targetSet = new Set(targets.map((m) => m.to));
  const canPick = (sq: number) => legal.some((m) => m.from === sq);

  // A new position (move made, undo) drops any selection.
  const legalKey = legal.map((m) => m.uci).join(",");
  const [seenKey, setSeenKey] = useState(legalKey);
  if (seenKey !== legalKey) {
    setSeenKey(legalKey);
    setSelected(null);
    setPromo(null);
  }

  const tryMove = (from: number, to: number): boolean => {
    const options = legal.filter((m) => m.from === from && m.to === to);
    if (!options.length) return false;
    if (options.length > 1 && options[0].promotion) {
      setPromo({ moves: options, to });
      return true;
    }
    setSelected(null);
    onMove(options[0]);
    return true;
  };

  const choose = (sq: number) => {
    if (promo) return;
    if (selected !== null && selected !== sq && tryMove(selected, sq)) return;
    if (selected === sq) setSelected(null);
    else if (canPick(sq)) setSelected(sq);
    else setSelected(null);
  };

  // Display order: rank 8 at the top for white, rank 1 for black.
  const order: number[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = orientation === "w" ? 7 - row : row;
      const file = orientation === "w" ? col : 7 - col;
      order.push(rank * 8 + file);
    }
  }

  const squareAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-square]");
    return el ? Number(el.dataset.square) : null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, sq: number) => {
    if (e.button !== 0 || promo || !canPick(sq)) return;
    dragRef.current = { from: sq, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
      d.moved = true;
      setSelected(d.from);
    }
    if (d.moved) setDrag({ from: d.from, x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || !d.moved) return;
    suppressClick.current = true;
    const to = squareAt(e.clientX, e.clientY);
    if (to !== null && to !== d.from && tryMove(d.from, to)) return;
    // Dropped somewhere else: keep the piece selected for a tap.
    setSelected(d.from);
  };

  const onKeyDown = (e: ReactKeyboardEvent, sq: number) => {
    const dir: Record<string, [number, number]> = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = dir[e.key];
    if (d) {
      e.preventDefault();
      const flip = orientation === "w" ? 1 : -1;
      const rank = Math.min(7, Math.max(0, (sq >> 3) + d[0] * flip));
      const file = Math.min(7, Math.max(0, (sq & 7) + d[1] * flip));
      const next = rank * 8 + file;
      setFocus(next);
      squares.current[next]?.focus();
    } else if (e.key === "Escape") {
      setSelected(null);
      setPromo(null);
    }
  };

  // Square size for the dragged piece.
  const [size, setSize] = useState(44);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth / 8));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative select-none">
      <div
        ref={gridRef}
        role="grid"
        aria-label={label}
        className="grid aspect-square w-full touch-none grid-cols-8 overflow-hidden rounded-[14px] border-2 border-[#111111]"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
          setDrag(null);
        }}
      >
        {Array.from({ length: 8 }, (_, row) => (
          <div key={row} role="row" className="contents">
            {order.slice(row * 8, row * 8 + 8).map((sq, col) => {
              const piece = board[sq];
              const dark = ((sq >> 3) + (sq & 7)) % 2 === 0;
              const isSel = selected === sq;
              const isTarget = targetSet.has(sq);
              const isLast = !!lastMove && (lastMove.from === sq || lastMove.to === sq);
              const isHint = !!hint && (hint.from === sq || hint.to === sq);
              const isWrong = !!wrong && (wrong.from === sq || wrong.to === sq);
              const dragging = drag?.from === sq;
              const labelParts = [squareLabel(sq), piece ? pieceLabel(piece) : "empty"];
              if (sq === check) labelParts.push("in check");
              if (isSel) labelParts.push("selected");
              if (isTarget) labelParts.push(piece ? "capture" : "move here");
              if (isLast) labelParts.push("last move");
              if (isHint) labelParts.push("coach");
              let bg = dark ? DARK : LIGHT;
              if (isLast) bg = dark ? "#C9B15C" : "#EDDC8E";
              if (isSel) bg = dark ? "#9C8BE0" : "#C6BAF5";
              if (isWrong) bg = "#E8828F";
              return (
                <button
                  key={sq}
                  ref={(el) => {
                    squares.current[sq] = el;
                  }}
                  type="button"
                  role="gridcell"
                  data-square={sq}
                  tabIndex={sq === focus ? 0 : -1}
                  aria-label={labelParts.join(", ")}
                  aria-selected={isSel}
                  onFocus={() => setFocus(sq)}
                  onKeyDown={(e) => onKeyDown(e, sq)}
                  onPointerDown={(e) => onPointerDown(e, sq)}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    choose(sq);
                  }}
                  className="relative flex aspect-square items-center justify-center p-0 outline-none focus-visible:z-10 focus-visible:shadow-[inset_0_0_0_3px_#5B3DF5]"
                  style={{ background: bg, cursor: canPick(sq) || isTarget ? "pointer" : "default" }}
                >
                  {sq === check && (
                    <span aria-hidden="true" className="absolute inset-0" style={{ background: "radial-gradient(circle, rgba(200,16,46,0.85) 0%, rgba(200,16,46,0.45) 45%, transparent 72%)" }} />
                  )}
                  {isHint && <span aria-hidden="true" className="absolute inset-[2px] rounded-[4px]" style={{ boxShadow: "inset 0 0 0 3px #F26B1D" }} />}
                  {piece && (
                    <span className="relative z-[1] h-[88%] w-[88%]" style={{ opacity: dragging ? 0.25 : 1 }}>
                      <PieceSvg code={piece} size="100%" />
                    </span>
                  )}
                  {isTarget && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute z-[2] rounded-full"
                      style={
                        piece
                          ? { inset: "6%", boxShadow: "inset 0 0 0 4px rgba(17,17,17,0.38)" }
                          : { width: "30%", height: "30%", background: "rgba(17,17,17,0.32)" }
                      }
                    />
                  )}
                  {col === 0 && (
                    <span aria-hidden="true" className="pointer-events-none absolute left-[3px] top-[1px] font-mono text-[10px] font-semibold" style={{ color: dark ? LIGHT : DARK }}>
                      {(sq >> 3) + 1}
                    </span>
                  )}
                  {row === 7 && (
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-[3px] font-mono text-[10px] font-semibold" style={{ color: dark ? LIGHT : DARK }}>
                      {"abcdefgh"[sq & 7]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {drag && board[drag.from] && (
        <div aria-hidden="true" className="pointer-events-none fixed z-50" style={{ left: drag.x - size * 0.55, top: drag.y - size * 0.75, width: size * 1.1, height: size * 1.1 }}>
          <PieceSvg code={board[drag.from]!} size="100%" />
        </div>
      )}

      {promo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[14px] bg-black/45" role="dialog" aria-modal="true" aria-label="Choose a piece to promote to">
          <div className="flex flex-col items-center gap-3 rounded-[22px] bg-ground p-4 text-ink">
            <span className="text-sm font-semibold">Promote to</span>
            <div className="flex gap-2">
              {(["q", "r", "b", "n"] as Promotion[]).map((p, i) => {
                const move = promo.moves.find((m) => m.promotion === p)!;
                const color = board[move.from]![0] as "w" | "b";
                const code = `${color}${p.toUpperCase()}` as PieceCode;
                return (
                  <button
                    key={p}
                    type="button"
                    autoFocus={i === 0}
                    aria-label={`Promote to ${pieceLabel(code).split(" ")[1]}`}
                    onClick={() => {
                      setPromo(null);
                      setSelected(null);
                      onMove(move);
                    }}
                    className="flex h-14 w-14 items-center justify-center rounded-[14px] p-1"
                    style={{ background: LIGHT }}
                  >
                    <PieceSvg code={code} size="100%" />
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setPromo(null)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
