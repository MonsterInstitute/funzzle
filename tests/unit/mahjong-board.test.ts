import { describe, expect, it } from "vitest";
import { getLayout, LAYOUT_IDS } from "@/lib/games/mahjong";
import { COMFORT_TILE_W, computeBoard, fitTileWidth, MAX_TILE_W, TILE_RATIO } from "@/components/mahjong/board";

describe("mahjong board layout", () => {
  it("fits every layout inside a phone's width", () => {
    for (const id of LAYOUT_IDS) {
      const b = computeBoard(id, 358);
      expect(b.width).toBeLessThanOrEqual(358);
      expect(b.tiles).toHaveLength(getLayout(id).cells.length);
      for (const t of b.tiles) {
        expect(t.left).toBeGreaterThanOrEqual(0);
        expect(t.top).toBeGreaterThanOrEqual(0);
        expect(t.left + b.tileW).toBeLessThanOrEqual(b.width + 0.01);
        expect(t.top + b.tileH).toBeLessThanOrEqual(b.height + 0.01);
      }
    }
  });

  it("keeps tiles taller than wide and caps their size on big screens", () => {
    const b = computeBoard("quick", 4000);
    expect(b.tileW).toBe(MAX_TILE_W);
    expect(b.tileH / b.tileW).toBeCloseTo(TILE_RATIO, 1);
  });

  it("respects a height limit", () => {
    const tall = computeBoard("turtle", 728);
    const short = computeBoard("turtle", 728, 360);
    expect(short.height).toBeLessThanOrEqual(360);
    expect(short.tileW).toBeLessThan(tall.tileW);
  });

  it("draws higher layers up and to the left, in drawing order", () => {
    const b = computeBoard("turtle", 700);
    const cells = getLayout("turtle").cells;
    const top = b.tiles.find((t) => t.z === 4)!;
    const c = cells[top.p];
    expect(top.left).toBeCloseTo(b.step * 4 + (c.x / 2) * b.tileW - 4 * b.step);
    for (let i = 1; i < b.tiles.length; i++) expect(b.tiles[i].z).toBeGreaterThanOrEqual(b.tiles[i - 1].z);
  });

  it("the Turtle on a phone is small enough to offer zoom, and zoom enlarges it", () => {
    expect(fitTileWidth("turtle", 358)).toBeLessThan(COMFORT_TILE_W);
    expect(fitTileWidth("quick", 358)).toBeGreaterThanOrEqual(COMFORT_TILE_W);
    const zoomed = computeBoard("turtle", 358, Infinity, 1.6);
    expect(zoomed.width).toBeGreaterThan(358);
    expect(zoomed.tileW).toBeLessThanOrEqual(MAX_TILE_W);
  });
});
