import { describe, expect, it } from "vitest";
import {
  applyMatch,
  bestMove,
  dailyDeal,
  freeTiles,
  generateDeal,
  geometry,
  isFree,
  isWon,
  matchingPairs,
  newGame,
  tilesMatch,
  type State,
} from "@/lib/games/mahjong";
import {
  blockedText,
  FREE_HINTS,
  hintsLeft,
  keyMoveText,
  nextSkillText,
  shuffleCost,
  skillsFor,
  tapTile,
  tileLabel,
  topCleared,
} from "@/components/mahjong/play";

const quick = () => generateDeal("quick", "play-test").state;

describe("mahjong taps", () => {
  it("selects a free tile, deselects it, and matches its pair", () => {
    const s = quick();
    const [a, b] = matchingPairs(s)[0];
    expect(tapTile(s, null, a)).toEqual({ kind: "select", p: a });
    expect(tapTile(s, a, a)).toEqual({ kind: "deselect" });
    expect(tapTile(s, a, b)).toEqual({ kind: "match", pair: [a, b] });
    const next = applyMatch(s, [a, b]);
    expect(tapTile(next, null, a)).toEqual({ kind: "none" });
  });

  it("switches the selection to a free tile that doesn't match", () => {
    const s = quick();
    const free = freeTiles(s);
    let pick: [number, number] | null = null;
    for (const a of free) for (const b of free) if (!pick && a !== b && !tilesMatch(s.tiles[a], s.tiles[b])) pick = [a, b];
    expect(pick).not.toBeNull();
    expect(tapTile(s, pick![0], pick![1])).toEqual({ kind: "select", p: pick![1] });
  });

  it("explains blocked tiles: covered or closed on both sides", () => {
    const s = quick();
    const g = geometry("quick");
    const covered = s.tiles.findIndex((_, p) => g.above[p].length > 0);
    const r = tapTile(s, null, covered);
    expect(r.kind).toBe("blocked");
    expect(blockedText(s, covered)).toMatch(/covered/);
    const sides = s.tiles.findIndex((_, p) => g.above[p].length === 0 && !isFree(s, p));
    expect(sides).toBeGreaterThanOrEqual(0);
    expect(blockedText(s, sides)).toMatch(/both sides/);
  });

  it("labels tiles for screen readers", () => {
    const s = newGame("quick", quick().tiles);
    const p = freeTiles(s)[0];
    expect(tileLabel(s, p, { selected: true })).toMatch(/, free, selected$/);
    const blocked = s.tiles.findIndex((_, q) => !isFree(s, q));
    expect(tileLabel(s, blocked)).toMatch(/, blocked$/);
  });
});

describe("mahjong hint budget", () => {
  it("gives three free hints plus earned ones", () => {
    expect(hintsLeft(0, 0)).toBe(FREE_HINTS);
    expect(hintsLeft(3, 0)).toBe(0);
    expect(hintsLeft(3, 1)).toBe(1);
    expect(hintsLeft(9, 1)).toBe(0);
  });

  it("the first practice shuffle is free; daily shuffles always cost a hint", () => {
    expect(shuffleCost("practice", false)).toBe(0);
    expect(shuffleCost("practice", true)).toBe(1);
    expect(shuffleCost("daily", false)).toBe(1);
  });
});

describe("mahjong recap and skills", () => {
  function clear(state: State): State {
    let s = state;
    while (!isWon(s)) s = applyMatch(s, bestMove(s)!.pair);
    return s;
  }

  it("follows the coach to a clear and notices when the top layer goes", () => {
    const { state } = dailyDeal("2026-10-24", "turtle");
    expect(topCleared(state)).toBe(false);
    const done = clear(state);
    expect(topCleared(done)).toBe(true);
    expect(keyMoveText(done, 61_000)).toMatch(/at 1:01 you took the top/);
    expect(keyMoveText(done)).toMatch(/all 144 tiles in 72 matches/);
  });

  it("awards layout, unaided, fast and all-layout skills", () => {
    const base = { hints: 0, shuffles: 0, timeMs: 7 * 60_000, clearedBefore: {} };
    expect(skillsFor({ ...base, layout: "turtle" })).toEqual(["clear-turtle", "no-hint", "no-shuffle", "fast", "turtle-unaided"]);
    expect(skillsFor({ ...base, layout: "quick", hints: 2, shuffles: 1 })).toEqual(["clear-quick"]);
    const all = { turtle: 1, pyramid: 2, fortress: 1, bridge: 1 };
    expect(skillsFor({ ...base, layout: "quick", hints: 1, clearedBefore: all })).toContain("all-layouts");
    expect(skillsFor({ ...base, layout: "turtle", timeMs: 9 * 60_000, hints: 1 })).not.toContain("fast");
  });

  it("suggests the next skill from how the game went", () => {
    const done = clear(quick());
    expect(nextSkillText(done, 2, 100_000)).toMatch(/no hints/);
    expect(nextSkillText(done, 0, 100_000)).toMatch(/Turtle/);
  });
});
