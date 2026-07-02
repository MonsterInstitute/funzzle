import type { CrosswordClue } from "./getAnswers";
import { CLUE_CONTENT } from "./content/clues";

const CLUE_BY_ANSWER = new Map<string, string>();
for (const c of CLUE_CONTENT) {
  if (!CLUE_BY_ANSWER.has(c.answer)) CLUE_BY_ANSWER.set(c.answer, c.explanation);
}

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/** A ~200-word intro paragraph woven from the day's actual clues. */
export function answerIntro(
  dateLong: string,
  summary: string | null,
  clues: CrosswordClue[]
): string {
  const answers = clues.map((c) => c.answer);
  const shortest = [...answers].sort((a, b) => a.length - b.length)[0] ?? "";
  const longest = [...answers].sort((a, b) => b.length - a.length)[0] ?? "";
  const list = answers.slice(0, 4).join(", ");

  return (
    `The NYT-style Mini for ${dateLong} packs a full puzzle into a tiny grid, and today's solution set spans everyday vocabulary from ${list}. ` +
    `${summary ? summary + " " : ""}` +
    `Because the Mini is so compact, every square does double duty — each letter belongs to both an across answer and a down answer — so a single confident entry can unlock the whole board. ` +
    `Today the shortest answer, ${shortest}, is the kind of gimme that gives you crossing letters for the trickier fill, while the longest entry, ${longest}, anchors the grid and often takes a crossing or two to confirm. ` +
    `If you're checking your work or you got stuck on one stubborn square, the complete answer key below lists every across and down clue with its solution and a short explanation. ` +
    `We publish these Mini answers every day, so bookmark the archive and come back whenever a clue has you second-guessing. ` +
    `And if reading the answers gives you the itch to solve one yourself, our free Mini Crossword plays the same way — no subscription and no account required.`
  );
}

export interface AnswerFact {
  answer: string;
  clue: string;
  fact: string;
}

/** Interesting facts about each of the day's answers (up to 10). */
export function answerFacts(clues: CrosswordClue[]): AnswerFact[] {
  const chosen = clues.slice(0, 10);
  return chosen.map((c) => {
    const len = c.answer.length;
    const vowels = c.answer.split("").filter((ch) => VOWELS.has(ch)).length;
    const base = c.explanation ?? CLUE_BY_ANSWER.get(c.answer) ?? "";
    const crossword =
      `As a ${len}-letter word with ${vowels} vowel${vowels === 1 ? "" : "s"}, ` +
      `${c.answer} is a crossword-friendly entry — its letters interlock easily, which is why it turns up in grids so often.`;
    return {
      answer: c.answer,
      clue: c.clue,
      fact: base ? `${base} ${crossword}` : crossword,
    };
  });
}

export const SOLVING_TIPS: string[] = [
  "Start with the fill-in-the-blank and short (3-letter) clues — they're usually the fastest points and hand you crossing letters for everything else.",
  "Work outward from your most confident answer instead of top-to-bottom; in a Mini, one solid entry unlocks four or five neighbors.",
  "If a clue ends in a question mark, expect wordplay or a pun rather than a literal definition.",
  "Plural clues almost always mean the answer ends in S — pencil that last letter in early.",
  "When two answers seem possible, let the crossing clue break the tie rather than guessing.",
];
