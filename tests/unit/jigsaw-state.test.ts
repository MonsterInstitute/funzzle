import { describe, expect, it } from "vitest";
import { makeCut } from "@/lib/games/jigsaw";
import { edgesFirst, frameDoneAt, initialState, isComplete, placedCount, reducer, skillsFor, type PlayState } from "@/components/jigsaw/state";

const cut = makeCut("state", 24);
const border = cut.pieces.filter((p) => p.border).map((p) => p.id);
const inside = cut.pieces.filter((p) => !p.border).map((p) => p.id);

function placeAll(ids: number[], s: PlayState = initialState(24), step = 1000): PlayState {
  return ids.reduce((acc, id, i) => reducer(acc, { type: "place", id, at: (i + 1) * step }), s);
}

describe("jigsaw play state", () => {
  it("places each piece once, in order, with its time", () => {
    let s = reducer(initialState(24), { type: "place", id: 5, at: 1200 });
    s = reducer(s, { type: "place", id: 5, at: 9000 });
    s = reducer(s, { type: "place", id: 99, at: 9000 });
    expect(s.order).toEqual([5]);
    expect(s.placedAt[5]).toBe(1200);
    expect(placedCount(s)).toBe(1);
    expect(isComplete(s)).toBe(false);
  });

  it("counts hints, coach placements and the preview", () => {
    let s = reducer(initialState(24), { type: "hint-used" });
    s = reducer(s, { type: "place", id: 0, at: 10, coached: true });
    s = reducer(s, { type: "preview-opened" });
    expect(s.hints).toBe(1);
    expect(s.coached).toEqual([0]);
    expect(s.previewUsed).toBe(true);
    expect(reducer(s, { type: "preview-opened" })).toBe(s);
  });

  it("knows when the frame was finished and whether it came first", () => {
    const framed = placeAll([...border, ...inside]);
    expect(isComplete(framed)).toBe(true);
    expect(edgesFirst(cut, framed)).toBe(true);
    expect(frameDoneAt(cut, framed)).toBe(border.length * 1000);

    const mixed = placeAll([inside[0], ...border, ...inside.slice(1)]);
    expect(edgesFirst(cut, mixed)).toBe(false);
    expect(frameDoneAt(cut, mixed)).toBe((border.length + 1) * 1000);
    expect(frameDoneAt(cut, placeAll(border.slice(1)))).toBeNull();
  });

  it("awards the matching skills", () => {
    const clean = placeAll([...border, ...inside]);
    expect(skillsFor(cut, clean, 200_000).sort()).toEqual(["edges-first", "fast", "no-preview", "solve-24", "unaided"]);
    const helped = reducer(reducer(placeAll([inside[0], ...border, ...inside.slice(1)]), { type: "hint-used" }), { type: "preview-opened" });
    expect(skillsFor(cut, helped, 400_000)).toEqual(["solve-24"]);
    const big = makeCut("state", 96);
    expect(skillsFor(big, placeAll(big.pieces.map((p) => p.id), initialState(96)), 900_000)).toContain("solve-96");
  });
});
