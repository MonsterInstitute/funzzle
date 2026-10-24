import { describe, expect, it } from "vitest";
import { isWord } from "@/lib/games/words/lexicon";
import { BANK, BANK_BY_ID } from "./bank";
import { bankPuzzleFor, practicePick, RECENT_DAYS } from "./index";
import { groupOf, initialOrder, wordKey, type GroupsPuzzle } from "./puzzle";
import { puzzleErrors } from "./validate";

/**
 * Wordplay groups, checked mechanically so a word that also fits the trick
 * can't slip in elsewhere on the board (the meaning-based groups were
 * checked by hand when written).
 */
type Rule =
  | { group: number; kind: "suffix" | "prefix"; part: string }
  | { group: number; kind: "contains" | "starts" | "ends"; list: string[] }
  | { group: number; kind: "anagram" };

const BODY = "arm leg ear eye lip hip toe shin chin knee chest hand foot nose neck rib jaw head hair heel palm thumb wrist brow lung gum cheek nail back skin bone liver heart belly tooth mouth waist elbow ankle".split(" ");
const ANIMALS =
  "cat rat bat owl ant ape bear boar eel emu hen cow pig dog fox yak elk ram ewe gnu cod crow hare deer mole mule wolf lion seal toad wren lark crab duck goat frog swan hog doe colt pony moth gnat newt bee eagle hawk kiwi lamb mouse puma tiger zebra sheep horse camel coot".split(" ");
const NUMBERS = "one two three four five six seven eight nine ten eleven twelve".split(" ");
const VEHICLES = "car bus van ship cab sub tram train jet boat taxi truck ark raft yacht kart bike sled canoe ferry plane limo".split(" ");

const RULES: Record<string, Rule> = {
  b01: { group: 3, kind: "suffix", part: "ball" },
  b02: { group: 3, kind: "contains", list: BODY },
  b03: { group: 3, kind: "suffix", part: "fish" },
  b04: { group: 3, kind: "contains", list: ANIMALS },
  b05: { group: 3, kind: "suffix", part: "fly" },
  b07: { group: 3, kind: "contains", list: NUMBERS },
  b09: { group: 3, kind: "prefix", part: "green" },
  b10: { group: 3, kind: "contains", list: VEHICLES },
  b13: { group: 3, kind: "suffix", part: "stick" },
  b14: { group: 3, kind: "starts", list: BODY },
  b15: { group: 3, kind: "suffix", part: "fall" },
  b16: { group: 3, kind: "prefix", part: "pine" },
  b17: { group: 3, kind: "suffix", part: "man" },
  b18: { group: 3, kind: "anagram" },
  b20: { group: 3, kind: "prefix", part: "butter" },
  b21: { group: 3, kind: "suffix", part: "board" },
  b22: { group: 3, kind: "ends", list: BODY },
  b23: { group: 3, kind: "suffix", part: "line" },
  b25: { group: 3, kind: "prefix", part: "hand" },
  b26: { group: 3, kind: "anagram" },
  b27: { group: 3, kind: "prefix", part: "moon" },
  b28: { group: 3, kind: "ends", list: NUMBERS },
  b30: { group: 2, kind: "suffix", part: "room" },
  b31: { group: 3, kind: "suffix", part: "print" },
};

const sorted = (w: string) => [...wordKey(w)].sort().join("");

function ruleMatches(rule: Rule, word: string): boolean {
  const w = wordKey(word);
  switch (rule.kind) {
    case "suffix":
      return isWord(w + rule.part);
    case "prefix":
      return isWord(rule.part + w);
    case "contains":
      return rule.list.some((x) => w.includes(x));
    case "starts":
      return rule.list.some((x) => w.startsWith(x) && w !== x);
    case "ends":
      return rule.list.some((x) => w.endsWith(x) && w !== x);
    case "anagram":
      return false;
  }
}

describe("groups fallback bank", () => {
  it("has at least 30 puzzles with unique ids", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(30);
    expect(new Set(BANK.map((p) => p.id)).size).toBe(BANK.length);
    expect(Object.keys(BANK_BY_ID)).toHaveLength(BANK.length);
  });

  it.each(BANK.map((p) => [p.id, p] as const))("%s passes full validation", (_id, p) => {
    expect(puzzleErrors(p)).toEqual([]);
  });

  it.each(Object.entries(RULES))("%s: the wordplay group fits only its own words", (id, rule) => {
    const p = BANK_BY_ID[id];
    const members = p.groups[rule.group].words;
    const others = p.groups.filter((_, i) => i !== rule.group).flatMap((g) => g.words);
    if (rule.kind === "anagram") {
      expect(new Set(members.map(sorted)).size).toBe(1);
      expect(others.filter((w) => sorted(w) === sorted(members[0]))).toEqual([]);
      return;
    }
    if (rule.kind !== "suffix" && rule.kind !== "prefix") {
      for (const w of members) expect(ruleMatches(rule, w), `${w} should fit`).toBe(true);
    }
    expect(others.filter((w) => ruleMatches(rule, w))).toEqual([]);
  });

  it("never reuses a whole group across puzzles", () => {
    const seen = new Map<string, string>();
    for (const p of BANK) {
      for (const g of p.groups) {
        const key = g.words.map(wordKey).sort().join(",");
        expect(seen.get(key), `${p.id} ${g.title}`).toBeUndefined();
        seen.set(key, p.id);
      }
    }
  });
});

describe("groups daily and practice picks", () => {
  it("picks a bank puzzle per date deterministically, cycling through the whole bank", () => {
    expect(bankPuzzleFor("2026-10-24").id).toBe(bankPuzzleFor("2026-10-24").id);
    const ids = new Set<string>();
    for (let i = 0; i < BANK.length; i++) {
      const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
      ids.add(bankPuzzleFor(d).id);
    }
    expect(ids.size).toBe(BANK.length);
  });

  it("practice avoids the recent daily fallbacks and puzzles already played", () => {
    const today = "2026-10-24";
    const recent = new Set(Array.from({ length: RECENT_DAYS + 1 }, (_, i) => bankPuzzleFor(new Date(Date.parse(today) - (i - 1) * 86_400_000).toISOString().slice(0, 10)).id));
    const played = BANK.slice(0, 10).map((p) => p.id);
    for (let i = 0; i < 50; i++) {
      const p = practicePick(today, played, Math.random);
      expect(recent.has(p.id)).toBe(false);
      expect(played).not.toContain(p.id);
    }
    // Everything played: it still returns a puzzle.
    expect(practicePick(today, BANK.map((p) => p.id), () => 0)).toBeTruthy();
  });

  it("starts every board with no complete group in a row", () => {
    for (const p of BANK as GroupsPuzzle[]) {
      const order = initialOrder(p, `groups:${p.id}`);
      expect(new Set(order)).toEqual(new Set(p.groups.flatMap((g) => g.words)));
      for (let r = 0; r < 16; r += 4) expect(new Set(order.slice(r, r + 4).map((w) => groupOf(p, w))).size).toBeGreaterThan(1);
    }
  });
});
