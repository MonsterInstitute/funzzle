/**
 * Jigsaw play state: which pieces are placed, in what order and when, plus
 * hints and whether the preview was ever opened. Pure, so it's unit-tested
 * (tests/unit/jigsaw-state.test.ts) and saved to local storage as is.
 */
import type { Cut } from "@/lib/games/jigsaw";

export interface PlayState {
  count: number;
  placed: boolean[];
  /** Piece ids in the order they were placed. */
  order: number[];
  /** Elapsed ms when each piece was placed (-1 = loose). */
  placedAt: number[];
  /** Pieces the coach placed ("Place it"). */
  coached: number[];
  hints: number;
  previewUsed: boolean;
}

export type Action =
  | { type: "place"; id: number; at: number; coached?: boolean }
  | { type: "hint-used" }
  | { type: "preview-opened" };

export function initialState(count: number): PlayState {
  return {
    count,
    placed: new Array<boolean>(count).fill(false),
    order: [],
    placedAt: new Array<number>(count).fill(-1),
    coached: [],
    hints: 0,
    previewUsed: false,
  };
}

export function reducer(s: PlayState, a: Action): PlayState {
  switch (a.type) {
    case "place": {
      if (a.id < 0 || a.id >= s.count || s.placed[a.id]) return s;
      const placed = [...s.placed];
      placed[a.id] = true;
      const placedAt = [...s.placedAt];
      placedAt[a.id] = a.at;
      return { ...s, placed, placedAt, order: [...s.order, a.id], coached: a.coached ? [...s.coached, a.id] : s.coached };
    }
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
    case "preview-opened":
      return s.previewUsed ? s : { ...s, previewUsed: true };
  }
}

export const placedCount = (s: PlayState) => s.order.length;
export const isComplete = (s: PlayState) => s.order.length === s.count;

/** Elapsed ms when the last border piece went in, or null while the frame is open. */
export function frameDoneAt(cut: Cut, s: PlayState): number | null {
  const border = cut.pieces.filter((p) => p.border);
  if (!border.every((p) => s.placed[p.id])) return null;
  return Math.max(...border.map((p) => s.placedAt[p.id]));
}

/** True when the whole frame was placed before any inside piece. */
export function edgesFirst(cut: Cut, s: PlayState): boolean {
  const borderCount = cut.pieces.filter((p) => p.border).length;
  return s.order.length >= borderCount && s.order.slice(0, borderCount).every((id) => cut.pieces[id].border);
}

/** Skill ids (SKILL_TREES.jigsaw) a finished puzzle earned. */
export function skillsFor(cut: Cut, s: PlayState, timeMs: number): string[] {
  const n = cut.count;
  return [
    ...(edgesFirst(cut, s) ? ["edges-first"] : []),
    ...(n === 24 ? ["solve-24"] : []),
    ...(n === 48 ? ["solve-48"] : []),
    ...(n === 96 ? ["solve-96"] : []),
    ...(s.hints === 0 ? ["unaided"] : []),
    ...(n >= 24 && timeMs < 240_000 ? ["fast"] : []),
    ...(!s.previewUsed && n >= 24 ? ["no-preview"] : []),
  ];
}
