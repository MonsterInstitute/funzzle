import { describe, expect, it } from "vitest";
import { LAYOUTS, LAYOUT_IDS, geometry, getLayout, type Layout } from "./index";

const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

/** Every half-tile cell of a tile's footprint is covered by some tile one layer down. */
function unsupported(layout: Layout): string[] {
  const bad: string[] = [];
  for (const c of layout.cells) {
    if (c.z === 0) continue;
    const under = layout.cells.filter((d) => d.z === c.z - 1);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (!under.some((d) => x >= d.x && x < d.x + 2 && y >= d.y && y < d.y + 2)) bad.push(`${c.x},${c.y},${c.z}`);
    }
  }
  return bad;
}

describe("layouts", () => {
  it("has the five layouts with the expected tile counts", () => {
    expect(LAYOUT_IDS).toEqual(["turtle", "pyramid", "fortress", "bridge", "quick"]);
    const counts = Object.fromEntries(LAYOUT_IDS.map((id) => [id, LAYOUTS[id].cells.length]));
    expect(counts).toEqual({ turtle: 144, pyramid: 134, fortress: 110, bridge: 118, quick: 72 });
    expect(getLayout("turtle").depth).toBe(5);
  });

  for (const id of LAYOUT_IDS) {
    describe(id, () => {
      const layout = LAYOUTS[id];

      it("has an even number of tiles, no more than one set", () => {
        expect(layout.cells.length % 2).toBe(0);
        expect(layout.cells.length).toBeLessThanOrEqual(144);
      });

      it("has no overlapping tiles on one layer", () => {
        const { cells } = layout;
        for (let i = 0; i < cells.length; i++) {
          for (let j = i + 1; j < cells.length; j++) {
            if (cells[i].z === cells[j].z) expect(overlap(cells[i], cells[j])).toBe(false);
          }
        }
      });

      it("supports every tile above the table", () => {
        expect(unsupported(layout)).toEqual([]);
      });

      it("sits on the grid origin, sorted for drawing", () => {
        expect(Math.min(...layout.cells.map((c) => c.x))).toBe(0);
        expect(Math.min(...layout.cells.map((c) => c.y))).toBe(0);
        for (let i = 1; i < layout.cells.length; i++) {
          const a = layout.cells[i - 1];
          const b = layout.cells[i];
          expect(a.z < b.z || (a.z === b.z && (a.y < b.y || (a.y === b.y && a.x < b.x)))).toBe(true);
        }
        expect(layout.width).toBe(Math.max(...layout.cells.map((c) => c.x)) + 2);
      });

      it("has consistent neighbour lists", () => {
        const g = geometry(id);
        for (let p = 0; p < g.size; p++) {
          for (const q of g.left[p]) expect(g.right[q]).toContain(p);
          for (const q of g.above[p]) expect(g.below[q]).toContain(p);
        }
      });
    });
  }

  it("rejects an unknown layout", () => {
    expect(() => getLayout("spiral" as never)).toThrow();
  });
});
