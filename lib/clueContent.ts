import { CLUE_CONTENT } from "./content/clues";
import type { ClueEntry } from "./content/types";

/** Group clues by their answer so we can show real "clue variations". */
const BY_ANSWER = new Map<string, ClueEntry[]>();
for (const c of CLUE_CONTENT) {
  const arr = BY_ANSWER.get(c.answer) ?? [];
  arr.push(c);
  BY_ANSWER.set(c.answer, arr);
}

const BY_LENGTH = new Map<number, ClueEntry[]>();
for (const c of CLUE_CONTENT) {
  const arr = BY_LENGTH.get(c.answer.length) ?? [];
  arr.push(c);
  BY_LENGTH.set(c.answer.length, arr);
}

const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const cap = (w: string) => w.charAt(0) + w.slice(1).toLowerCase();

/** Deterministic hash so each word gets a stable but varied phrasing. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick<T>(variants: T[], seed: string, salt = 0): T {
  return variants[(hash(seed) + salt) % variants.length];
}

export interface ClueSections {
  /** Other clues in our library that resolve to the same answer. */
  variations: ClueEntry[];
  /** Other clues whose answers share this length. */
  sameLength: ClueEntry[];
  definition: string;
  usage: string;
  crosswordNote: string;
  trivia: string;
  solverNote: string;
  examples: string[];
}

export function buildClueSections(clue: ClueEntry): ClueSections {
  const answer = clue.answer;
  const len = answer.length;
  const chars = answer.split("");
  const vowelCount = chars.filter((c) => VOWELS.has(c)).length;
  const consonantCount = len - vowelCount;
  const first = answer[0];
  const last = answer[len - 1];

  const variations = (BY_ANSWER.get(answer) ?? []).filter(
    (c) => c.slug !== clue.slug
  );
  const sameLength = (BY_LENGTH.get(len) ?? [])
    .filter((c) => c.slug !== clue.slug && c.answer !== answer)
    .slice(0, 6);

  const vs = `${vowelCount} vowel${vowelCount === 1 ? "" : "s"}`;
  const cs = `${consonantCount} consonant${consonantCount === 1 ? "" : "s"}`;

  const definition = pick(
    [
      `The answer to "${clue.clue_text}" is ${answer}. ${cap(answer)} runs ${len} letters — ${vs} and ${cs} — opening with ${first} and closing on ${last}. In a grid it fills a ${len}-square slot whose letters are each shared with a crossing word, so the intersections do a lot of the heavy lifting when the clue itself is tough.`,
      `"${clue.clue_text}" points to ${answer}, a ${len}-letter entry that starts with ${first} and finishes on ${last} and carries ${vs}. Because every square it occupies also belongs to a down or across answer crossing it, you can often back into ${answer} from the letters around it rather than the clue alone.`,
      `${answer} solves the clue "${clue.clue_text}". Spanning ${len} letters (${vs}, ${cs}), it begins at ${first} and ends at ${last}. Like most crossword fill, it lives at the intersection of two words, so a single confirmed crossing letter frequently reveals the whole entry.`,
    ],
    answer
  );

  const usage = pick(
    [
      `${cap(answer)} turns up often in crosswords because of that letter mix. Words like ${answer} interlock cleanly with longer entries, so constructors reach for them to make a grid fit together without awkward clashes. Given a ${len}-square slot and a crossing letter or two, it's usually quick to confirm.`,
      `You'll see ${answer} in grids regularly — its ${len}-letter, ${vs} shape is exactly what setters need to bridge trickier entries. When one intersecting letter is already in place, especially the ${first} or ${last}, ${answer} tends to fall fast.`,
      `Compact, ${vs.includes("1 ") ? "single-vowel" : "vowel-friendly"} answers such as ${answer} are a constructor's staple: they slot into a ${len}-square space and play nicely in both directions. Solvers who recognize it on sight save real time on the daily puzzle.`,
    ],
    answer,
    7
  );

  const crosswordNote =
    variations.length > 0
      ? `The clue "${clue.clue_text}" is just one way to arrive at ${answer}. Across different puzzles and editors you may see the same answer clued as ${variations
          .slice(0, 4)
          .map((v) => `"${v.clue_text}"`)
          .join(", ")}${variations.length > 4 ? ", and more" : ""}. Recognizing that a single answer can wear many clues is one of the fastest ways to level up as a solver.`
      : `Setters vary how they clue ${answer} — sometimes with a straight dictionary definition, sometimes with wordplay, a pun, or a fill-in-the-blank — but the answer itself stays the same. Learning to spot the answer behind the disguise is a core crossword skill.`;

  const trivia = pick(
    [
      `At ${len} letters, ${answer} shows up in daily mini and themed puzzles far more than longer, obscure words. It's the kind of entry worth memorizing — the more common short words you know cold, the faster you solve.`,
      `Short answers like ${answer} are the connective tissue of a crossword. You'll meet ${answer} again and again, and recognizing it instantly is one of the quiet skills that separates fast solvers from slow ones.`,
      `${cap(answer)} belongs to the small vocabulary of words that appear constantly in grids. Because it's only ${len} letters, editors can drop it almost anywhere, which is why regular solvers know it on sight.`,
    ],
    answer,
    13
  );

  const solverNote = pick(
    [
      `Stuck on "${clue.clue_text}"? Don't force it — solve the clues crossing this slot instead. One or two intersecting letters usually make ${answer} obvious. Working from the crossings is the single most useful habit for getting faster.`,
      `If this clue won't come, leave it and fill the answers that cross it. Once a couple of ${answer}'s letters are locked by neighboring words, the entry tends to reveal itself. Crossings beat staring at a clue every time.`,
      `The fastest way past a stubborn clue like this one is the grid itself: pencil in the easy crossing answers first, and ${answer} will often be the only word that fits the letters you already have.`,
    ],
    answer,
    23
  );

  const examplePool = [
    `"I had the crossing letters, so writing ${answer} into the grid took no time at all."`,
    `"${cap(answer)} is the kind of answer that clicks the moment you spot one letter."`,
    `"Seeing '${clue.clue_text}' in the clue list, an experienced solver pencils in ${answer} almost immediately."`,
    `"Once the ${first} was confirmed by the crossing word, ${answer} was the only entry that fit."`,
    `"A ${len}-letter slot and a clue like '${clue.clue_text}'? That's ${answer} nine times out of ten."`,
    `"I second-guessed it, but the crossing answers confirmed ${answer} was right."`,
  ];
  const startEx = hash(answer) % examplePool.length;
  const examples = [0, 1, 2].map((k) => examplePool[(startEx + k) % examplePool.length]);

  return {
    variations,
    sameLength,
    definition,
    usage,
    crosswordNote,
    trivia,
    solverNote,
    examples,
  };
}
