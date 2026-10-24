/**
 * Per-game stats, technique skill trees and badges, all kept on this device.
 *
 * Games call recordFinish() when a puzzle ends; skill trees and badges are
 * derived from the stored stats (plus streaks and the passport), so a new
 * badge never needs a migration. A game adds its skill tree to SKILL_TREES.
 */
import { fullSetDays, getStreak } from "./daily";
import { triedGames } from "./passport";
import { readJson, writeJson } from "./storage";

export interface GameStats {
  played: number;
  won: number;
  noHintWins: number;
  bestMs?: number;
  /** Wins per difficulty / variant label, e.g. {expert: 2, "draw-3": 5}. */
  levels: Record<string, number>;
  /** Puzzles solved that needed each skill (technique, pattern, …). */
  skills: Record<string, number>;
}

const KEY = "fz:stats";
const FLAGS = "fz:flags";

export function allStats(): Record<string, GameStats> {
  return readJson<Record<string, GameStats>>(KEY, {});
}

export function gameStats(game: string): GameStats {
  return allStats()[game] ?? { played: 0, won: 0, noHintWins: 0, levels: {}, skills: {} };
}

export interface FinishInput {
  won: boolean;
  timeMs?: number;
  hints?: number;
  level?: string;
  /** Skills this puzzle exercised, e.g. the Sudoku techniques its solve path needs. */
  skills?: string[];
}

export function recordFinish(game: string, f: FinishInput): void {
  const all = allStats();
  const s = all[game] ?? { played: 0, won: 0, noHintWins: 0, levels: {}, skills: {} };
  s.played++;
  if (f.won) {
    s.won++;
    if (!f.hints) s.noHintWins++;
    if (f.timeMs && (!s.bestMs || f.timeMs < s.bestMs)) s.bestMs = f.timeMs;
    if (f.level) s.levels[f.level] = (s.levels[f.level] ?? 0) + 1;
    for (const k of new Set(f.skills ?? [])) s.skills[k] = (s.skills[k] ?? 0) + 1;
  }
  all[game] = s;
  writeJson(KEY, all);
}

/** One-off things that count toward badges (challenge sent, league joined …). */
export function setFlag(flag: string): void {
  const flags = readJson<Record<string, boolean>>(FLAGS, {});
  if (flags[flag]) return;
  writeJson(FLAGS, { ...flags, [flag]: true });
}

// ---------------------------------------------------------------------------
// Skill trees
// ---------------------------------------------------------------------------

export interface Skill {
  id: string;
  name: string;
  /** Row in the tree: tier 0 skills come first. */
  tier: number;
  what: string;
}

/** Solves needed to master a skill. */
export const MASTERY = 3;

export const SKILL_TREES: Record<string, { title: string; skills: Skill[] }> = {
  sudoku: {
    title: "Sudoku techniques",
    skills: [
      { id: "naked-single", name: "Naked single", tier: 0, what: "A cell with one possible digit" },
      { id: "hidden-single", name: "Hidden single", tier: 0, what: "A digit with one possible cell" },
      { id: "pointing", name: "Pointing", tier: 1, what: "A box confines a digit to one line" },
      { id: "claiming", name: "Claiming", tier: 1, what: "A line confines a digit to one box" },
      { id: "naked-pair", name: "Naked pair", tier: 2, what: "Two cells, the same two digits" },
      { id: "hidden-pair", name: "Hidden pair", tier: 2, what: "Two digits, the same two cells" },
      { id: "naked-triple", name: "Naked triple", tier: 3, what: "Three cells share three digits" },
      { id: "hidden-triple", name: "Hidden triple", tier: 3, what: "Three digits share three cells" },
      { id: "x-wing", name: "X-Wing", tier: 4, what: "A rectangle of candidates" },
      { id: "xy-wing", name: "XY-Wing", tier: 4, what: "A pivot and two pincers" },
      { id: "swordfish", name: "Swordfish", tier: 5, what: "An X-Wing over three lines" },
    ],
  },
  solitaire: {
    title: "Solitaire skills",
    skills: [
      { id: "win-draw-1", name: "Draw 1", tier: 0, what: "Win a draw-1 deal" },
      { id: "no-hint", name: "Unaided", tier: 1, what: "Win without the coach" },
      { id: "win-draw-3", name: "Draw 3", tier: 1, what: "Win a draw-3 deal" },
      { id: "fast", name: "Quick hands", tier: 2, what: "Win in under 5 minutes" },
      { id: "efficient", name: "Efficient", tier: 2, what: "Win in under 120 moves" },
      { id: "draw-3-unaided", name: "Draw 3 unaided", tier: 3, what: "Win draw 3 without the coach" },
    ],
  },
  freecell: {
    title: "FreeCell skills",
    skills: [
      { id: "win", name: "First deal", tier: 0, what: "Win a FreeCell deal" },
      { id: "no-hint", name: "Unaided", tier: 1, what: "Win without the coach" },
      { id: "supermove", name: "Supermove", tier: 1, what: "Move a run of 2+ cards at once in a win" },
      { id: "two-cells", name: "Light on cells", tier: 2, what: "Win with never more than 2 free cells in use" },
      { id: "fast", name: "Quick hands", tier: 2, what: "Win in under 5 minutes" },
      { id: "efficient", name: "Efficient", tier: 2, what: "Win in under 100 moves" },
      { id: "clean", name: "Clean win", tier: 3, what: "Win without the coach or undo" },
    ],
  },
  // Ids are the engine's technique names (lib/games/minesweeper TECHNIQUES):
  // a cleared board counts every technique its logical solve path needs.
  minesweeper: {
    title: "Minesweeper techniques",
    skills: [
      { id: "single-flag", name: "Single flag", tier: 0, what: "A number with only that many hidden cells" },
      { id: "single-safe", name: "Single safe", tier: 0, what: "A number that already has all its mines" },
      { id: "1-1 pattern", name: "1-1 pattern", tier: 1, what: "Two 1s sharing the same mine" },
      { id: "1-2 pattern", name: "1-2 pattern", tier: 1, what: "A 2 next to a 1 forces a mine" },
      { id: "subset", name: "Subset", tier: 2, what: "One number’s cells inside another’s" },
      { id: "frontier enumeration", name: "Frontier", tier: 3, what: "Try every layout along an edge" },
      { id: "mine count", name: "Mine count", tier: 3, what: "Use the mines left to finish" },
    ],
  },
  mahjong: {
    title: "Mahjong skills",
    skills: [
      { id: "clear-quick", name: "Quick board", tier: 0, what: "Clear the 72-tile Quick board" },
      { id: "clear-turtle", name: "Turtle", tier: 0, what: "Clear the 144-tile Turtle" },
      { id: "no-hint", name: "Unaided", tier: 1, what: "Clear a board without the coach" },
      { id: "no-shuffle", name: "No reshuffle", tier: 1, what: "Clear a board without shuffling" },
      { id: "fast", name: "Quick eyes", tier: 2, what: "Clear the Turtle in under 8 minutes" },
      { id: "turtle-unaided", name: "Turtle unaided", tier: 2, what: "Clear the Turtle with no hints or shuffles" },
      { id: "all-layouts", name: "Every layout", tier: 3, what: "Clear all five layouts" },
    ],
  },
  "spider-solitaire": {
    title: "Spider skills",
    skills: [
      { id: "win-1-suit", name: "One suit", tier: 0, what: "Win a 1-suit deal" },
      { id: "no-hint", name: "Unaided", tier: 1, what: "Win without the coach" },
      { id: "win-2-suits", name: "Two suits", tier: 1, what: "Win a 2-suit deal" },
      { id: "no-undo", name: "No take-backs", tier: 2, what: "Win without undoing a move" },
      { id: "efficient", name: "Efficient", tier: 2, what: "Win in under 200 moves" },
      { id: "win-4-suits", name: "Four suits", tier: 3, what: "Win a 4-suit deal" },
      { id: "4-suits-unaided", name: "Four suits unaided", tier: 4, what: "Win 4 suits without the coach" },
    ],
  },
  "spelling-hive": {
    title: "Spelling Hive skills",
    skills: [
      { id: "pangram", name: "Pangram", tier: 0, what: "Find a word that uses all seven letters" },
      { id: "great", name: "Great", tier: 0, what: "Reach the Great rank" },
      { id: "long-word", name: "Long word", tier: 1, what: "Find a word of 8 letters or more" },
      { id: "genius", name: "Genius", tier: 2, what: "Reach the Genius rank" },
      { id: "unaided-genius", name: "Genius unaided", tier: 3, what: "Reach Genius without the coach" },
      { id: "hive-master", name: "Hive Master", tier: 4, what: "Find every word in a hive" },
    ],
  },
  "letter-box": {
    title: "Letter Box skills",
    skills: [
      { id: "solve", name: "Boxed", tier: 0, what: "Use all twelve letters" },
      { id: "par", name: "On par", tier: 1, what: "Solve in par (usually two words)" },
      { id: "unaided", name: "Unaided", tier: 1, what: "Solve without the coach" },
      { id: "long-word", name: "Long word", tier: 2, what: "Play a word of 8 letters or more" },
      { id: "fast", name: "Quick box", tier: 2, what: "Solve in under 3 minutes" },
      { id: "par-unaided", name: "Par unaided", tier: 3, what: "Solve in par without the coach" },
    ],
  },
  // Earned in lib/games/groups/coach.ts earnedSkills().
  groups: {
    title: "Groups skills",
    skills: [
      { id: "solve", name: "Grouped", tier: 0, what: "Find all four groups" },
      { id: "no-hint", name: "Unaided", tier: 1, what: "Solve without the coach" },
      { id: "perfect", name: "Perfect solve", tier: 1, what: "Solve with no mistakes" },
      { id: "comeback", name: "Comeback", tier: 1, what: "Solve on your last life" },
      { id: "trickiest-first", name: "Trickiest first", tier: 2, what: "Find the level 4 group first" },
      { id: "fast", name: "Quick eye", tier: 2, what: "Solve in under 2 minutes" },
      { id: "flawless", name: "Flawless", tier: 3, what: "No mistakes and no hints" },
      { id: "reverse", name: "Upside down", tier: 3, what: "Solve levels 4, 3, 2, 1 in order" },
    ],
  },
  // Ids match lib/games/chess/themes.ts: every solved puzzle records its themes.
  chess: {
    title: "Chess tactics",
    skills: [
      { id: "mate-in-1", name: "Mate in 1", tier: 0, what: "Find the one move that ends it" },
      { id: "win-material", name: "Win material", tier: 0, what: "Win a piece or more by force" },
      { id: "fork", name: "Fork", tier: 1, what: "One piece attacks two at once" },
      { id: "pin", name: "Pin", tier: 1, what: "A piece that can’t move without losing a bigger one" },
      { id: "skewer", name: "Skewer", tier: 2, what: "Attack a big piece, win the one behind it" },
      { id: "discovered-attack", name: "Discovered attack", tier: 2, what: "Move one piece to unmask another" },
      { id: "back-rank", name: "Back-rank mate", tier: 2, what: "Mate a king trapped behind its pawns" },
      { id: "mate-in-2", name: "Mate in 2", tier: 3, what: "A forcing two-move mate" },
      { id: "mate-in-3", name: "Mate in 3", tier: 4, what: "A three-move mating attack" },
    ],
  },
};

export function skillProgress(game: string): { skill: Skill; count: number; mastered: boolean }[] {
  const tree = SKILL_TREES[game];
  if (!tree) return [];
  const s = gameStats(game);
  return tree.skills.map((skill) => ({ skill, count: s.skills[skill.id] ?? 0, mastered: (s.skills[skill.id] ?? 0) >= MASTERY }));
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface Badge {
  id: string;
  name: string;
  how: string;
  earned: boolean;
}

export function badges(): Badge[] {
  const stats = allStats();
  const flags = readJson<Record<string, boolean>>(FLAGS, {});
  const streak = getStreak();
  const tried = Object.keys(triedGames()).length;
  const wins = Object.values(stats).reduce((n, s) => n + s.won, 0);
  const sudoku = stats.sudoku;
  const solitaire = stats.solitaire;
  const list: [string, string, string, boolean][] = [
    ["first-solve", "First solve", "Finish any puzzle", wins >= 1],
    ["streak-3", "On a roll", "A 3-day streak", streak.best >= 3],
    ["streak-7", "Week of puzzles", "A 7-day streak (earns a streak freeze)", streak.best >= 7],
    ["streak-30", "Habit", "A 30-day streak", streak.best >= 30],
    ["daily-set", "Full set", "Finish all four Daily Set puzzles in one day", fullSetDays() > 0],
    ["unaided", "No help needed", "Win any puzzle without a hint", Object.values(stats).some((s) => s.noHintWins > 0)],
    ["sudoku-expert", "Expert grid", "Solve an Expert Sudoku", (sudoku?.levels.expert ?? 0) > 0],
    ["sudoku-xwing", "Wing it", "Solve a Sudoku that needs an X-Wing or XY-Wing", (sudoku?.skills["x-wing"] ?? 0) + (sudoku?.skills["xy-wing"] ?? 0) > 0],
    ["solitaire-draw-3", "Three at a time", "Win a draw-3 Solitaire deal", (solitaire?.levels["draw-3"] ?? 0) > 0],
    ["explorer", "Explorer", "Try 5 different games", tried >= 5],
    ["globetrotter", "Globetrotter", "Try 10 different games", tried >= 10],
    ["challenger", "Challenger", "Send a friend a challenge", !!flags["challenge-sent"]],
    ["team-player", "Team player", "Join a league", !!flags["league-joined"]],
    ["century", "Century", "Win 100 puzzles", wins >= 100],
  ];
  return list.map(([id, name, how, earned]) => ({ id, name, how, earned }));
}
