import { parseISODate } from "./dates";

/** Difficulty level → color. 0 yellow (easy) … 3 purple (hardest). */
export type Level = 0 | 1 | 2 | 3;

export interface ConnCategory {
  name: string;
  level: Level;
  words: string[];
}

export interface ConnPuzzle {
  categories: ConnCategory[];
}

/** Seven puzzles, one per day of the week. */
export const CONNECTIONS_PUZZLES: ConnPuzzle[] = [
  {
    categories: [
      { name: "Dog sounds & actions", level: 0, words: ["BARK", "BITE", "GROWL", "WOOF"] },
      { name: "Board games", level: 1, words: ["CHESS", "CHECKERS", "GO", "REVERSI"] },
      { name: "Wading birds", level: 2, words: ["CRANE", "HERON", "STORK", "IBIS"] },
      { name: "Parts of a window", level: 3, words: ["PANE", "FRAME", "SASH", "SILL"] },
    ],
  },
  {
    categories: [
      { name: "Fruits", level: 0, words: ["APPLE", "GRAPE", "MANGO", "PEAR"] },
      { name: "Planets", level: 1, words: ["MARS", "VENUS", "EARTH", "SATURN"] },
      { name: "Colors", level: 2, words: ["AMBER", "CORAL", "IVORY", "JADE"] },
      { name: "Ways to run", level: 3, words: ["SPRINT", "JOG", "DASH", "BOLT"] },
    ],
  },
  {
    categories: [
      { name: "Cat sounds & actions", level: 0, words: ["PURR", "HISS", "MEOW", "CLAW"] },
      { name: "Card games", level: 1, words: ["POKER", "BRIDGE", "SNAP", "WAR"] },
      { name: "Trees", level: 2, words: ["OAK", "ELM", "ASH", "YEW"] },
      { name: "Move fast", level: 3, words: ["BOLT", "FLASH", "DART", "ZOOM"] },
    ],
  },
  {
    categories: [
      { name: "Ocean features", level: 0, words: ["WAVE", "TIDE", "REEF", "KELP"] },
      { name: "Breakfast foods", level: 1, words: ["TOAST", "BACON", "EGGS", "OATS"] },
      { name: "Blue things", level: 2, words: ["SKY", "OCEAN", "JEANS", "INK"] },
      { name: "Jumps", level: 3, words: ["LEAP", "BOUND", "VAULT", "SPRING"] },
    ],
  },
  {
    categories: [
      { name: "Music genres", level: 0, words: ["JAZZ", "ROCK", "SOUL", "FOLK"] },
      { name: "Kitchen tools", level: 1, words: ["WHISK", "LADLE", "TONGS", "GRATER"] },
      { name: "Night sky & creatures", level: 2, words: ["MOON", "STAR", "OWL", "BAT"] },
      { name: "Small amounts", level: 3, words: ["DROP", "DASH", "PINCH", "TRACE"] },
    ],
  },
  {
    categories: [
      { name: "Sports", level: 0, words: ["GOLF", "POLO", "CREW", "FENCING"] },
      { name: "Weather", level: 1, words: ["HAIL", "SLEET", "FROST", "SMOG"] },
      { name: "Animal sounds", level: 2, words: ["ROAR", "BRAY", "BLEAT", "NEIGH"] },
      { name: "Track & field", level: 3, words: ["RELAY", "HURDLE", "CROSS", "TRACK"] },
    ],
  },
  {
    categories: [
      { name: "Dances", level: 0, words: ["WALTZ", "TANGO", "FOXTROT", "JIVE"] },
      { name: "Gemstones", level: 1, words: ["RUBY", "OPAL", "JADE", "ONYX"] },
      { name: "Fire-related", level: 2, words: ["SPARK", "EMBER", "FLAME", "ASH"] },
      { name: "Writing tools", level: 3, words: ["PEN", "QUILL", "CHALK", "STYLUS"] },
    ],
  },
];

/** Pick the puzzle for a date by day of the week (0 Sun … 6 Sat). */
export function puzzleForDate(iso: string): ConnPuzzle {
  const dow = parseISODate(iso).getUTCDay();
  return CONNECTIONS_PUZZLES[dow % CONNECTIONS_PUZZLES.length];
}

/** Deterministic 32-bit seed from a YYYY-MM-DD string. */
export function seedFromDate(iso: string): number {
  let h = 2166136261;
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded shuffle — same date yields the same board on server and client. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let state = seed || 1;
  const rand = () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const LEVEL_EMOJI: Record<Level, string> = {
  0: "🟨",
  1: "🟩",
  2: "🟦",
  3: "🟪",
};

export const LEVEL_BG: Record<Level, string> = {
  0: "bg-[#eab308]",
  1: "bg-[#16a34a]",
  2: "bg-[#3b82f6]",
  3: "bg-[#8b5cf6]",
};
