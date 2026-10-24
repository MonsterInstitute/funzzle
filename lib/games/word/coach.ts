/**
 * Coach hint ladder for the grid modes (classic, quad, math). It teaches
 * deduction rather than handing over the word:
 *
 *   1. direction: what the guesses so far prove (letters ruled out, letters
 *      fixed or misplaced, how many answers still fit);
 *   2. specific: the solver's best next guess and which untested letters it
 *      checks, with how much it narrows things down;
 *   3. answer: reveal one letter of the answer in its spot.
 */
import { VALID5 } from "@/lib/games/words/words5";
import { ANSWERS5 } from "@/lib/games/words/words5";
import { mathAnswers } from "./math";
import { hardModeViolation, knowledge, score, type Clue, type Knowledge } from "./score";
import { bestGuess, filterCandidates, rateGuess, type Split } from "./solver";

export type GridMode = "classic" | "quad" | "math";

export interface Reveal {
  board: number;
  pos: number;
  ch: string;
}

export type Technique = "opening" | "elimination" | "split" | "one-left";

export interface GridHint {
  /** The board the hint is about (0 outside Quad). */
  board: number;
  technique: Technique;
  /** Short tag for the coach card. */
  title: string;
  direction: string;
  specific: string;
  /** A guess the player can drop into the current row. */
  suggestion: string | null;
  reveal: Reveal | null;
  answer: string;
  /** Answers still possible on each board (0 for solved boards). */
  remaining: number[];
}

/** Best openers, precomputed with the solver (they never change for a fixed answer pool). */
export const OPENERS: Record<GridMode, string> = { classic: "slate", quad: "slate", math: "46-27=19" };

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

let valid5: string[] | null = null;
let answers5: string[] | null = null;
const guessWords = () => (valid5 ??= VALID5.toArray());
export const answerPool = (mode: GridMode): string[] => (mode === "math" ? mathAnswers() : (answers5 ??= ANSWERS5.toArray()));

const up = (s: string) => s.toUpperCase();
/** Operators as printed on the keys. */
export const showOp = (s: string) => s.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");
const ord = (n: number) => `spot ${n + 1}`;

/** "A", "A and B", "A, B and C". */
export function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The scored guesses each board saw (a board stops at the guess that solved it). */
export function boardClues(answers: readonly string[], guesses: readonly string[]): { clues: Clue[]; solved: boolean }[] {
  return answers.map((answer) => {
    const clues: Clue[] = [];
    for (const g of guesses) {
      clues.push({ guess: g, marks: score(g, answer) });
      if (g === answer) return { clues, solved: true };
    }
    return { clues, solved: false };
  });
}

/** Candidates per board, given the clues and any letters the coach revealed. */
export function boardCandidates(mode: GridMode, answers: readonly string[], guesses: readonly string[], reveals: readonly Reveal[] = []): string[][] {
  const pool = answerPool(mode);
  return boardClues(answers, guesses).map(({ clues, solved }, b) => {
    if (solved) return [];
    const fixed = reveals.filter((r) => r.board === b);
    return filterCandidates(pool, clues).filter((w) => fixed.every((r) => w[r.pos] === r.ch));
  });
}

function describeLetters(k: Knowledge, mode: GridMode): string[] {
  const parts: string[] = [];
  const isOp = (ch: string) => /[+\-*/=]/.test(ch);
  const keep = (ch: string) => (mode === "math" ? !isOp(ch) : true);
  const absent = k.absent.filter(keep);
  if (absent.length) parts.push(`${mode === "math" ? "Digits ruled out:" : "Your guesses rule out"} ${list(absent.map(up))}.`);
  const fixed = k.fixed.map((ch, i) => (ch && keep(ch) ? `${up(ch)} in ${ord(i)}` : null)).filter(Boolean) as string[];
  if (fixed.length === 1) parts.push(`${fixed[0].replace(" in ", " is in ")}.`);
  else if (fixed.length) parts.push(`Fixed: ${list(fixed)}.`);
  const misplaced: string[] = [];
  for (const [ch, n] of k.min) {
    if (!keep(ch)) continue;
    const placed = k.fixed.filter((f) => f === ch).length;
    if (n <= placed) continue;
    const not = [...(k.notAt.get(ch) ?? [])].filter((i) => !k.fixed[i]).sort((a, b) => a - b);
    misplaced.push(`${up(ch)} is in it${placed ? " again" : ""}${not.length ? ` but not in ${list(not.map(ord))}` : ""}`);
  }
  if (misplaced.length) parts.push(`${list(misplaced)}.`);
  return parts;
}

function describeOperators(k: Knowledge): string {
  const ops = ["+", "-", "*", "/"];
  const used = ops.filter((o) => (k.min.get(o) ?? 0) > 0);
  const none = ops.filter((o) => k.absent.includes(o));
  const eq = k.fixed.indexOf("=");
  const parts: string[] = [];
  if (used.length) {
    const where = used.map((o) => {
      const at = k.fixed.map((f, i) => (f === o ? i : -1)).filter((i) => i >= 0);
      return at.length ? `${showOp(o)} (in ${list(at.map(ord))})` : showOp(o);
    });
    parts.push(`The equation uses ${list(where)}.`);
  }
  if (none.length) parts.push(`There's no ${list(none.map(showOp))}.`);
  if (eq >= 0) parts.push(`The = sign is in ${ord(eq)}, so the answer after it has ${7 - eq} digit${7 - eq === 1 ? "" : "s"}.`);
  else if (k.notAt.get("=")?.size) parts.push(`The = sign isn't in ${list([...k.notAt.get("=")!].sort().map(ord))}.`);
  if (!parts.length) parts.push("Nothing is pinned down about the operators yet: a guess that tries two different ones tells you more.");
  return parts.join(" ");
}

/** Untested letters a guess checks, most informative first. */
function newLetters(guess: string, guesses: readonly string[], cands: readonly string[], mode: GridMode): string[] {
  const tried = new Set(guesses.join(""));
  const fresh = [...new Set(guess)].filter((ch) => !tried.has(ch) && (mode !== "math" || /\d/.test(ch)));
  const p = (ch: string) => cands.filter((w) => w.includes(ch)).length / Math.max(1, cands.length);
  return fresh.sort((a, b) => Math.abs(p(a) - 0.5) - Math.abs(p(b) - 0.5)).slice(0, 3);
}

function testsPhrase(letters: string[], mode: GridMode): string {
  if (mode === "math") return letters.length ? `tests the digit${letters.length > 1 ? "s" : ""} ${list(letters)}` : "moves known characters to new spots";
  const vowels = letters.filter((ch) => VOWELS.has(ch)).map(up);
  const cons = letters.filter((ch) => !VOWELS.has(ch)).map(up);
  if (!letters.length) return "moves letters you've found into new spots";
  const v = vowels.length ? `the vowel${vowels.length > 1 ? "s" : ""} ${list(vowels)}` : "";
  return `tests ${list([...cons, v].filter(Boolean))}`;
}

const count = (n: number, mode: GridMode) => `${n.toLocaleString("en-US")} ${mode === "math" ? "equation" : "word"}${n === 1 ? "" : "s"}`;

export interface HintInput {
  mode: GridMode;
  answers: readonly string[];
  guesses: readonly string[];
  reveals?: readonly Reveal[];
  /** Classic hard mode: suggestions must reuse every clue. */
  hard?: boolean;
}

/** The coach's hint ladder for the current position, or null when every board is solved. */
export function gridHint({ mode, answers, guesses, reveals = [], hard = false }: HintInput): GridHint | null {
  const boards = boardClues(answers, guesses);
  const cands = boardCandidates(mode, answers, guesses, reveals);
  const open = boards.map((b, i) => (b.solved ? -1 : i)).filter((i) => i >= 0);
  if (!open.length) return null;
  // Focus on the open board closest to solved.
  const board = open.reduce((a, b) => (cands[b].length < cands[a].length ? b : a), open[0]);
  const focus = cands[board];
  const clues = boards[board].clues;
  const k = knowledge(clues, answers[board].length, reveals.filter((r) => r.board === board));
  const quad = answers.length > 1;
  const on = quad ? `Board ${board + 1}: ` : "";
  const solvedBoards = boards.map((b, i) => (b.solved ? i + 1 : 0)).filter(Boolean);

  // Rung 3: one letter of the focus answer, in the first spot not yet known.
  const pos = k.fixed.findIndex((f) => !f);
  const reveal = pos >= 0 ? { board, pos, ch: answers[board][pos] } : null;
  const answer = reveal
    ? `${quad ? `On board ${board + 1}, s` : "S"}pot ${pos + 1} is ${mode === "math" ? `“${showOp(reveal.ch)}”` : up(reveal.ch)}. It’s marked in your next row.`
    : `${on}every spot is known. Type it in.`;

  // The best next guess.
  let best: Split | null;
  if (!guesses.length) best = rateGuess(OPENERS[mode], cands.filter((c) => c.length));
  else {
    const allowed = hard && !quad ? (g: string) => hardModeViolation(g, clues) === null : undefined;
    best = bestGuess(
      cands.filter((c) => c.length),
      { guessWords: mode === "math" ? undefined : guessWords(), allowed, maxCandidates: mode === "math" ? 250 : 400 }
    );
  }
  const suggestion = best?.guess ?? null;

  if (!guesses.length) {
    return {
      board,
      technique: "opening",
      title: "Opening",
      direction:
        mode === "math"
          ? "Open with an equation that uses two different operators and six different digits: the colors then tell you about the operators and most of the digits at once."
          : `Open with five different common letters, two vowels and three consonants like S, T, L, R or N. ${quad ? "On four boards at once, a wide opener matters even more." : "That rules out the most words."}`,
      specific: `A strong opener ${testsPhrase(newLetters(OPENERS[mode], [], focus, mode), mode)}: try ${showOp(up(OPENERS[mode]))}. Whatever colors come back, it leaves at most ${count(best?.worst ?? 0, mode)}${quad ? " on a board" : ""}.`,
      suggestion: OPENERS[mode],
      reveal,
      answer,
      remaining: cands.map((c) => c.length),
    };
  }

  const known = mode === "math" ? describeOperators(k) : describeLetters(k, mode).join(" ");
  const left = focus.length === 1 ? `Only one ${mode === "math" ? "equation" : "word"} fits everything you know.` : `${count(focus.length, mode)} still fit.`;
  const solvedNote = quad && solvedBoards.length ? ` (${solvedBoards.length === 1 ? "Board" : "Boards"} ${list(solvedBoards.map(String))} ${solvedBoards.length === 1 ? "is" : "are"} solved.)` : "";
  const direction = `${on}${known} ${left}${solvedNote}`.replace(/\s+/g, " ").trim();

  let specific: string;
  let technique: Technique;
  let shown = suggestion;
  if (focus.length === 1 && !quad) {
    technique = "one-left";
    const pattern = k.fixed.map((f) => (f ? up(f) : "_")).join(" ");
    const digits = mode === "math" ? describeLetters(k, mode).join(" ") : "";
    specific = `Everything points to one ${mode === "math" ? "equation" : "word"}. Start from what’s fixed (${pattern})${digits ? ` — ${digits}` : ""} and fill the gaps with what’s left.`;
    shown = null;
  } else if (best) {
    technique = best.worst <= 1 ? "split" : "elimination";
    const tests = testsPhrase(newLetters(best.guess, guesses, focus, mode), mode);
    const digitsLine = mode === "math" ? `${describeLetters(k, mode).join(" ")} ` : "";
    const leaves = best.candidate && best.worst === 0 ? "it's the only one left" : `whatever colors come back, at most ${count(best.worst, mode)} will be left${quad ? " on a board" : ""}`;
    specific = `${digitsLine}The best next guess ${tests}: try ${showOp(up(best.guess))}. ${best.candidate ? "It could be the answer, and " : ""}${leaves}.`;
  } else {
    technique = "elimination";
    specific = "Use what you know to rule out more letters.";
  }
  return {
    board,
    technique,
    title: technique === "one-left" ? "One left" : technique === "split" ? "Best split" : "Elimination",
    direction,
    specific: specific.replace(/\s+/g, " ").trim(),
    suggestion: shown,
    reveal,
    answer,
    remaining: cands.map((c) => c.length),
  };
}

/** The coach's "teach me" text for a technique. */
export const TEACH: Record<Technique, { title: string; body: string }> = {
  opening: {
    title: "Openers",
    body: "A first guess can’t use clues, so it should collect them: five different letters that appear in many words. Each gray letter crosses off thousands of words; each yellow or green narrows the rest. Words with repeated letters or rare letters (J, Q, X, Z) waste the first row.",
  },
  elimination: {
    title: "Elimination",
    body: "Every color is a rule. Gray: the letter isn’t in the word (unless the same letter is green or yellow elsewhere, which caps how many copies there are). Yellow: it’s in the word, but not in that spot. Green: it’s fixed. Before each guess, list the rules, then pick a word that tests letters you haven’t tried rather than one that only repeats what you know.",
  },
  split: {
    title: "Splitting",
    body: "When several words still fit, the best guess isn’t always one of them. Pick the guess whose possible colors divide the remaining words into the most small groups: then whatever comes back, only a few words are left. The coach rates every guess this way, in bits of information.",
  },
  "one-left": {
    title: "Closing out",
    body: "When the clues leave one answer, write out the fixed spots, place the yellow letters where they’re still allowed, and fill the gaps with letters you haven’t ruled out. Say candidates out loud: the word often appears once the pattern is on paper.",
  },
};
