/**
 * Per-game signature colors — the way NYT Games gives each puzzle its own hue.
 *
 * Each game maps to:
 *   - primary:   the saturated signature color (buttons, icon tiles, accents)
 *   - onPrimary: readable text/!icon color ON the primary fill (white or near-black)
 *   - text:      a darker shade of the hue that stays readable on a WHITE page
 *   - tint:      a very light wash of the hue for card icon backgrounds / chips
 *
 * Colors are applied via inline styles (not Tailwind classes) because the game
 * key is only known at runtime and Tailwind can't generate classes from dynamic
 * strings.
 */

export type GameKey =
  | "mini"
  | "wordle"
  | "connections"
  | "spelling-bee"
  | "strands"
  | "letter-boxed"
  | "quordle"
  | "worldle"
  | "nerdle";

export interface GameColor {
  primary: string;
  onPrimary: string;
  text: string;
  tint: string;
}

export const GAME_COLORS: Record<GameKey, GameColor> = {
  // Mini Crossword — slate / near-black
  mini: { primary: "#1a1a1a", onPrimary: "#ffffff", text: "#1a1a1a", tint: "#f3f4f6" },
  // Wordle — green
  wordle: { primary: "#6aaa64", onPrimary: "#ffffff", text: "#15803d", tint: "#e8f3e6" },
  // Connections — purple
  connections: { primary: "#8b5cf6", onPrimary: "#ffffff", text: "#6d28d9", tint: "#f1ebfd" },
  // Spelling Bee — yellow (needs dark text on the fill)
  "spelling-bee": { primary: "#f7da21", onPrimary: "#1a1a1a", text: "#a16207", tint: "#fef9c3" },
  // Strands — teal
  strands: { primary: "#5eb3a6", onPrimary: "#ffffff", text: "#0f766e", tint: "#e3f2ef" },
  // Letter Boxed — red
  "letter-boxed": { primary: "#e4572e", onPrimary: "#ffffff", text: "#c0341d", tint: "#fce9e3" },
  // Quordle — blue
  quordle: { primary: "#3b82f6", onPrimary: "#ffffff", text: "#1d4ed8", tint: "#e6effe" },
  // Worldle — sky blue
  worldle: { primary: "#0ea5e9", onPrimary: "#ffffff", text: "#0369a1", tint: "#e0f2fe" },
  // Nerdle — orange (light fill → dark text reads better)
  nerdle: { primary: "#f59e0b", onPrimary: "#1a1a1a", text: "#b45309", tint: "#fef3c7" },
};

/** Aliases so DB answer `type`s and route slugs resolve to a color. */
const ALIASES: Record<string, GameKey> = {
  "nyt-mini": "mini",
  "mini-crossword": "mini",
  connection: "connections",
  "spelling-bee": "spelling-bee",
  spellingbee: "spelling-bee",
  "letter-boxed": "letter-boxed",
  letterboxed: "letter-boxed",
};

/** Resolve any game key / slug / answer-type to its color (defaults to Mini). */
export function gameColor(key: string): GameColor {
  const normalized = (ALIASES[key] ?? key) as GameKey;
  return GAME_COLORS[normalized] ?? GAME_COLORS.mini;
}
