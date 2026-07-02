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

  const definition =
    `The answer to "${clue.clue_text}" is ${answer}. ` +
    `${cap(answer)} is a ${len}-letter word made up of ${vowelCount} vowel${
      vowelCount === 1 ? "" : "s"
    } and ${consonantCount} consonant${consonantCount === 1 ? "" : "s"}, ` +
    `beginning with ${first} and ending with ${last}. ` +
    `In a crossword grid it occupies a ${len}-square slot, and each of its letters also forms part of a word crossing it — so even if the clue stumps you, the crossing entries will usually hand you enough letters to fill it in.`;

  const usage =
    `${cap(answer)} turns up frequently in crosswords precisely because of that letter mix. ` +
    `Short, vowel-friendly words like ${answer} are a constructor's best friend: they interlock cleanly with longer entries and help a grid come together without awkward letter clashes. ` +
    `When you see a ${len}-letter slot and already have a crossing letter or two, ${answer} is often quick to confirm — especially once the ${first} or ${last} is in place.`;

  const crosswordNote =
    variations.length > 0
      ? `The clue "${clue.clue_text}" is just one way to arrive at ${answer}. Across different puzzles and editors you may see the same answer clued as ${variations
          .slice(0, 4)
          .map((v) => `"${v.clue_text}"`)
          .join(", ")}${variations.length > 4 ? ", and more" : ""}. Recognizing that a single answer can wear many clues is one of the fastest ways to level up as a solver.`
      : `Setters vary how they clue ${answer} — sometimes with a straight dictionary definition, sometimes with wordplay, a pun, or a fill-in-the-blank — but the answer itself stays the same. Learning to spot the answer behind the disguise is a core crossword skill.`;

  const trivia =
    `Because it is only ${len} letters long, ${answer} appears far more often in daily mini and themed puzzles than longer, more obscure words. ` +
    `Regular solvers come to recognize it on sight, and it is exactly the kind of entry worth committing to memory: the more common short words you know cold, the faster your solve times become.`;

  const solverNote =
    `If "${clue.clue_text}" has you stuck, don't force it — jump to the clues crossing this slot instead. ` +
    `Filling in even one or two intersecting letters usually makes ${answer} obvious. ` +
    `That crossing-first approach is the single most useful habit for improving at crosswords, and it works on everything from the quick daily Mini to a full Sunday grid.`;

  const examples = [
    `"I had the crossing letters, so writing ${answer} into the grid took no time at all."`,
    `"${cap(answer)} is the kind of answer that clicks the moment you spot one letter."`,
    `"Seeing '${clue.clue_text}' in the clue list, an experienced solver pencils in ${answer} almost immediately."`,
    `"Once the ${first} was confirmed by the crossing word, ${answer} was the only entry that fit."`,
  ];

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
