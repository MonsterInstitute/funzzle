import { describe, expect, it } from "vitest";
import {
  dailyJigsaw,
  drawPicture,
  makeCut,
  PIECE_COUNTS,
  pieceBox,
  PIC_H,
  PIC_W,
  SIZES,
  snapRadius,
  snaps,
  suggestPiece,
  THEMES,
  trayOrder,
  type Cut,
} from "./index";

/** The numbers of a path, in order. */
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

/** The 10 points of the shared edge as traced inside one piece's path (after its M). */
function sideSegment(cut: Cut, id: number, side: "top" | "right" | "bottom" | "left"): number[] {
  const p = cut.pieces[id];
  // Split the path into its four sides: each starts at a corner.
  const parts = p.path.slice(1, -1).split(/(?=[LC])/);
  const sides: string[][] = [[], [], [], []];
  let i = 0;
  const corners = [
    [p.x + cut.cellW, p.y],
    [p.x + cut.cellW, p.y + cut.cellH],
    [p.x, p.y + cut.cellH],
    [p.x, p.y],
  ].map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
  for (const part of parts.slice(1)) {
    sides[i].push(part);
    const n = nums(part);
    if (n[n.length - 2] === corners[i][0] && n[n.length - 1] === corners[i][1]) i++;
  }
  return nums(sides[["top", "right", "bottom", "left"].indexOf(side)].join(""));
}

describe("jigsaw cut", () => {
  it("has the right grid for every size", () => {
    for (const n of PIECE_COUNTS) {
      const cut = makeCut("t", n);
      expect(cut.pieces).toHaveLength(n);
      expect(cut.cols * cut.rows).toBe(n);
      expect(cut.cellW * cut.cols).toBeCloseTo(PIC_W);
      expect(cut.cellH * cut.rows).toBeCloseTo(PIC_H);
    }
  });

  it("is deterministic per seed and differs between seeds", () => {
    expect(makeCut("jigsaw:2026-10-24", 24)).toEqual(makeCut("jigsaw:2026-10-24", 24));
    expect(makeCut("jigsaw:2026-10-24", 24).pieces.map((p) => p.path)).not.toEqual(makeCut("jigsaw:2026-10-25", 24).pieces.map((p) => p.path));
  });

  it("gives neighbours complementary tab/blank sides and flat borders", () => {
    for (const n of PIECE_COUNTS) {
      const cut = makeCut(`edges:${n}`, n);
      for (const p of cut.pieces) {
        expect(p.sides.top === 0).toBe(p.row === 0);
        expect(p.sides.bottom === 0).toBe(p.row === cut.rows - 1);
        expect(p.sides.left === 0).toBe(p.col === 0);
        expect(p.sides.right === 0).toBe(p.col === cut.cols - 1);
        if (p.col < cut.cols - 1) expect(cut.pieces[p.id + 1].sides.left).toBe(-p.sides.right);
        if (p.row < cut.rows - 1) expect(cut.pieces[p.id + cut.cols].sides.top).toBe(-p.sides.bottom);
        expect(p.border).toBe(p.row === 0 || p.col === 0 || p.row === cut.rows - 1 || p.col === cut.cols - 1);
      }
      expect(cut.pieces.filter((p) => p.corner)).toHaveLength(4);
    }
  });

  it("traces a shared edge with exactly the same curve in both pieces", () => {
    const cut = makeCut("shared", 24);
    const a = sideSegment(cut, 7, "right");
    const b = sideSegment(cut, 8, "left");
    expect(a.length).toBe(18); // 3 cubic segments
    // b is a reversed: compare as point lists.
    const pts = (n: number[]) => Array.from({ length: n.length / 2 }, (_, i) => `${n[2 * i]},${n[2 * i + 1]}`);
    const startA = `${cut.pieces[7].x + cut.cellW},${cut.pieces[7].y}`;
    const fullA = [startA, ...pts(a)];
    const fullB = [`${cut.pieces[8].x},${cut.pieces[8].y + cut.cellH}`, ...pts(b)];
    expect(fullB).toEqual([...fullA].reverse());
  });

  it("writes valid closed paths whose tabs stay inside the piece box", () => {
    const cut = makeCut("paths", 96);
    for (const p of cut.pieces) {
      expect(p.path).toMatch(/^M[-\d. ]+([LC][-\d. ]+)+Z$/);
      const box = pieceBox(cut, p);
      const n = nums(p.path);
      for (let i = 0; i < n.length; i += 2) {
        expect(n[i]).toBeGreaterThanOrEqual(box.x - 0.01);
        expect(n[i]).toBeLessThanOrEqual(box.x + box.w + 0.01);
        expect(n[i + 1]).toBeGreaterThanOrEqual(box.y - 0.01);
        expect(n[i + 1]).toBeLessThanOrEqual(box.y + box.h + 0.01);
      }
      // Tabs stick out past the cell only on tab sides.
      if (p.sides.top === 1) expect(Math.min(...n.filter((_, i) => i % 2 === 1))).toBeLessThan(p.y - cut.knob * 0.2);
    }
  });

  it("snaps within the radius only", () => {
    const cut = makeCut("snap", 24);
    const p = cut.pieces[9];
    const cx = p.x + cut.cellW / 2;
    const cy = p.y + cut.cellH / 2;
    expect(snaps(cut, p, cx, cy)).toBe(true);
    expect(snaps(cut, p, cx + snapRadius(cut) * 0.9, cy)).toBe(true);
    expect(snaps(cut, p, cx + snapRadius(cut) * 1.1, cy)).toBe(false);
    expect(snaps(cut, p, cx + cut.cellW, cy)).toBe(false);
  });

  it("shuffles the tray as a seeded permutation", () => {
    const t = trayOrder("tray", 48);
    expect([...t].sort((a, b) => a - b)).toEqual(Array.from({ length: 48 }, (_, i) => i));
    expect(trayOrder("tray", 48)).toEqual(t);
    expect(t).not.toEqual(Array.from({ length: 48 }, (_, i) => i));
  });

  it("makes the daily 24 pieces from the date", () => {
    expect(dailyJigsaw("2026-10-24")).toEqual({ date: "2026-10-24", seed: "jigsaw:2026-10-24", pieces: 24, ...SIZES[24] });
  });

  it("cuts 96 pieces and draws the picture quickly", () => {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      makeCut(`speed:${i}`, 96);
      drawPicture(`speed:${i}`);
    }
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });
});

describe("jigsaw picture", () => {
  it("is deterministic, self-contained and varied", () => {
    expect(drawPicture("jigsaw:2026-10-24")).toEqual(drawPicture("jigsaw:2026-10-24"));
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const p = drawPicture(`pic:${i}`);
      seen.add(p.theme);
      expect(p.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(p.svg.endsWith("</svg>")).toBe(true);
      // No outside images or links: everything is drawn.
      expect(p.svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/https?:|<image|href/);
      expect(p.svg).not.toMatch(/NaN|undefined/);
      expect(p.name.length).toBeGreaterThan(3);
    }
    expect(seen.size).toBe(THEMES.length);
  });
});

describe("jigsaw coach", () => {
  const cut = makeCut("coach", 24);
  const none = () => new Array<boolean>(24).fill(false);

  it("starts with a corner", () => {
    const h = suggestPiece(cut, none())!;
    expect(cut.pieces[h.pieceId].corner).toBe(true);
    expect(h.reason).toBe("corner-start");
    expect(h.text).toMatch(/corner/);
  });

  it("then picks a piece that touches the placed ones, frame first", () => {
    const placed = none();
    placed[0] = true;
    const h = suggestPiece(cut, placed)!;
    const p = cut.pieces[h.pieceId];
    expect(p.border).toBe(true);
    expect([1, cut.cols]).toContain(p.id);
    expect(h.text).toMatch(/tab|blank/);
  });

  it("prefers a piece with more placed neighbours", () => {
    const placed = none();
    // Place (0,0), (0,1), (1,0): (1,1) now touches two placed pieces.
    for (const id of [0, 1, cut.cols]) placed[id] = true;
    // Finish the frame so border pieces get no bonus.
    for (const p of cut.pieces) if (p.border) placed[p.id] = true;
    const h = suggestPiece(cut, placed)!;
    expect(h.pieceId).toBe(cut.cols + 1);
    expect(h.text).toMatch(/between 2 placed pieces/);
  });

  it("returns the last piece and null when done", () => {
    const placed = new Array<boolean>(24).fill(true);
    placed[13] = false;
    expect(suggestPiece(cut, placed)).toMatchObject({ pieceId: 13, reason: "last" });
    expect(suggestPiece(cut, new Array<boolean>(24).fill(true))).toBeNull();
  });

  it("only picks among the given candidates (edge filter)", () => {
    const placed = none();
    placed[0] = true;
    const inside = cut.pieces.filter((p) => !p.border).map((p) => p.id);
    const h = suggestPiece(cut, placed, inside)!;
    expect(cut.pieces[h.pieceId].border).toBe(false);
  });
});
