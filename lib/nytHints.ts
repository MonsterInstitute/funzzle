/**
 * Hint ladders for the daily NYT puzzles (direction → specific; the answer is
 * the third rung). Built from the stored answer data, so every hint is
 * correct by construction.
 */
import type { ConnectionsAnswerData, CrosswordAnswerData, WordleAnswerData } from "./getAnswers";

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function wordleHints(data: WordleAnswerData): string[] {
  const word = data.answer.toUpperCase();
  const vowels = [...word].filter((c) => VOWELS.has(c)).length;
  const repeats = [...new Set([...word].filter((c, i) => word.indexOf(c) !== i))];
  const first = `It has ${count(vowels, "vowel")}${repeats.length ? ` and a repeated letter` : ", and no letter repeats"}.`;
  const second = `It starts with ${word[0]} and ends with ${word[word.length - 1]}.`;
  return [first, second];
}

export function connectionsHints(data: ConnectionsAnswerData): string[] {
  const groups = [...data.groups].sort((a, b) => a.level - b.level);
  if (groups.length < 2) return [];
  const easiest = groups[0];
  const hardest = groups[groups.length - 1];
  return [
    `The easiest group is “${easiest.title}”.`,
    `The trickiest group is “${hardest.title}”. One of its words is ${hardest.words[0]}.`,
  ];
}

export function miniHints(data: CrosswordAnswerData): string[] {
  const first = data.across[0];
  if (!first) return [];
  const across = data.across.map((c) => `${c.number}-Across starts with ${c.answer[0]}`).join(", ");
  return [`1-Across is “${first.clue}”, ${first.answer.length} letters.`, `${across}.`];
}

export function miniAnswer(data: CrosswordAnswerData): string {
  return [
    ...data.across.map((c) => `${c.number}A ${c.answer}`),
    ...data.down.map((c) => `${c.number}D ${c.answer}`),
  ].join(" · ");
}
