/**
 * Hint ladders for the daily NYT (and other publishers') puzzles (direction → specific; the answer is
 * the third rung). Built from the stored answer data, so every hint is
 * correct by construction.
 */
import type {
  ConnectionsAnswerData,
  CrosswordAnswerData,
  LetterBoxedAnswerData,
  NerdleAnswerData,
  QuordleAnswerData,
  StrandsAnswerData,
  WordleAnswerData,
  WorldleAnswerData,
} from "./getAnswers";

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

export function strandsHints(data: StrandsAnswerData): string[] {
  const s = data.spangram.toUpperCase();
  return [
    `NYT's theme clue is “${data.clue}”.`,
    `The spangram has ${count(s.length, "letter")} and starts with ${s[0]}; there are ${count(data.words.length, "other theme word")}.`,
  ];
}

export function letterBoxedHints(data: LetterBoxedAnswerData): string[] {
  const [first] = data.solution;
  return [
    `NYT's own solution uses ${count(data.solution.length, "word")}, and the first one starts with ${first[0]}.`,
    `The first word is ${count(first.length, "letter")} long and ends with ${first.at(-1)}.`,
  ];
}

export function quordleHints(data: QuordleAnswerData): string[] {
  const words = data.words.map((w) => w.toUpperCase());
  return [
    `The four words start with ${words.map((w) => w[0]).join(", ")}.`,
    `They end with ${words.map((w) => w.at(-1)).join(", ")}, and have ${words.map((w) => [...w].filter((c) => VOWELS.has(c)).length).join(", ")} vowels.`,
  ];
}

export function worldleHints(data: WorldleAnswerData): string[] {
  const name = data.country;
  const letters = name.replace(/[^\p{L}]/gu, "").length;
  return [
    `It lies in the ${data.lat >= 0 ? "Northern" : "Southern"} Hemisphere, ${data.lng >= 0 ? "east" : "west"} of the Prime Meridian.`,
    `Its name starts with ${name[0].toUpperCase()} and has ${count(letters, "letter")}.`,
  ];
}

const OPERATOR_NAMES: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

export function nerdleHints(data: NerdleAnswerData): string[] {
  const [left, right] = data.equation.split("=");
  const ops = left.match(/[+\-*/]/g) ?? [];
  return [
    `The left side uses ${count(ops.length, "operator")}: ${ops.map((o) => OPERATOR_NAMES[o]).join(" then ")}.`,
    `The result after the = sign is ${right}.`,
  ];
}

export function miniAnswer(data: CrosswordAnswerData): string {
  return [
    ...data.across.map((c) => `${c.number}A ${c.answer}`),
    ...data.down.map((c) => `${c.number}D ${c.answer}`),
  ].join(" · ");
}
