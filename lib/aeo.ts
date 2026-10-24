/**
 * Answer-first copy: the 1–2 sentence summary each page opens with and the
 * questions people actually search for, answered directly (components/seo/QandA).
 * Answers that would spoil a puzzle are fine here: QandA keeps each answer
 * closed until tapped.
 */
import type { QA } from "@/components/seo/QandA";
import type { ConnectionsAnswerData, CrosswordAnswerData, WordleAnswerData } from "@/lib/getAnswers";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const vowelsIn = (w: string) => (w.match(/[aeiou]/gi) ?? []).length;

// ---------------------------------------------------------------------------
// Homepage and game pages
// ---------------------------------------------------------------------------

export const HOME_QA: QA[] = [
  {
    q: "What is Funzzle?",
    a: "Funzzle is a free daily puzzle playground: Sudoku, Solitaire, word games and more, with a new Daily Set every day that everyone plays, a coach that explains the next logical move, and a rank against today's players.",
  },
  {
    q: "Is Funzzle free?",
    a: "Yes. Every game, the daily puzzles, unlimited practice and the coach are free, with no account. Funzzle is paid for by ads, which never appear while you're playing.",
  },
  {
    q: "What is the Daily Set?",
    a: "Four puzzles that are the same for everyone today: Daily Sudoku, Daily Solitaire, Daily Word and the Mini Crossword. Finish any of them to keep your streak; your time is ranked against everyone who played the same puzzle.",
  },
  {
    q: "When do new daily puzzles come out?",
    a: "Every day at midnight UTC (8 p.m. Eastern in summer, 7 p.m. in winter). The hints and answers for the day's NYT puzzles go up at the same time.",
  },
  {
    q: "Do I need an app or an account?",
    a: "No. Funzzle runs in any phone, tablet or computer browser, and your streak, rating and progress are saved on your device.",
  },
  {
    q: "Is Funzzle affiliated with The New York Times?",
    a: "No. Funzzle is independent. Its hint and answer pages for the NYT's daily puzzles are unofficial guides; its own games are original.",
  },
];

export const GAME_GUIDES = {
  sudoku: {
    name: "Daily Sudoku",
    genre: "Puzzle",
    summary:
      "Daily Sudoku is a free 9×9 Sudoku that's the same grid for everyone today, from Easy on Monday to Expert on Saturday. Stuck? The coach points to the next logical step and explains the technique, and when you finish you see how your time ranks against today's players.",
    description: "Free daily Sudoku with a step-by-step coach, from easy to expert, plus unlimited practice.",
    qa: [
      {
        q: "How do you play Sudoku?",
        a: "Fill the 9×9 grid so every row, every column and every 3×3 box contains the digits 1 to 9 exactly once. The starting digits are fixed; every puzzle has exactly one solution, which you can reach by logic alone.",
      },
      {
        q: "How do you solve a hard Sudoku?",
        a: "Start with singles: a cell with only one possible digit (naked single) or a digit with only one possible cell in a row, column or box (hidden single). When those run out, use pencil marks and look for pairs, pointing and claiming, then X-Wings and XY-Wings. The coach shows you which technique the next step needs.",
      },
      {
        q: "How hard is today's Daily Sudoku?",
        a: "It follows the week: Monday is Easy, Tuesday and Wednesday are Medium, Sunday is Medium, Thursday and Friday are Hard, and Saturday is Expert. The difficulty is graded by the hardest technique the grid needs.",
      },
      {
        q: "Does Daily Sudoku have a hint button?",
        a: "Yes. The coach gives up to three hints per puzzle, each in steps: first where to look, then the technique, then the digit. Hints are counted in your result but never block your rank.",
      },
      {
        q: "Can I play more than one Sudoku a day?",
        a: "Yes. After the daily grid, Practice gives unlimited new puzzles at the level you choose, from Easy to Expert.",
      },
    ],
  },
  solitaire: {
    name: "Daily Solitaire",
    genre: "Card game",
    summary:
      "Daily Solitaire is free Klondike with one deal for everyone today, checked by a solver to be winnable, in draw-1 or draw-3. The coach suggests the best move and explains why, and your time and moves are ranked against today's players.",
    description: "Free daily Klondike Solitaire, verified winnable, with a best-move coach and unlimited practice deals.",
    qa: [
      {
        q: "How do you play Klondike Solitaire?",
        a: "Build four foundation piles from Ace to King, one per suit. In the seven tableau columns you can stack cards in descending order with alternating colors, move runs between columns and put only a King in an empty column. Turn cards from the stock when you're out of moves.",
      },
      {
        q: "Is every Solitaire game winnable?",
        a: "No: roughly 1 in 5 random Klondike deals can't be won. Funzzle's daily deals are checked by a solver before they go live, so today's deal always has a winning line.",
      },
      {
        q: "What is the difference between draw 1 and draw 3?",
        a: "In draw 1 you turn one card from the stock at a time, so every card is reachable; it's the easier game. In draw 3 you turn three and can only play the top one, which makes planning matter much more.",
      },
      {
        q: "What's the best Solitaire strategy?",
        a: "Turn over face-down tableau cards whenever you can, empty a column only when you have a King to put there, and don't rush cards to the foundations if they're still needed to hold lower cards. The coach's best move follows these rules.",
      },
    ],
  },
  "spelling-hive": {
    name: "Spelling Hive",
    genre: "Word game",
    summary:
      "Spelling Hive is a free daily word game: make as many words as you can from seven letters in a honeycomb, always using the center letter. Ranks climb from Beginner to Genius and Hive Master, a hints grid shows how many words are left, and your score is ranked against today's players.",
    description: "Free daily seven-letter word puzzle with ranks, a hints grid, a coach and unlimited practice hives.",
    qa: [
      {
        q: "How do you play Spelling Hive?",
        a: "Make words of four or more letters using only the seven letters in the hive. Every word must include the center letter, and letters can be used more than once. Four-letter words score 1 point, longer words score 1 point per letter.",
      },
      {
        q: "What is a pangram?",
        a: "A pangram is a word that uses all seven letters at least once. Every hive has at least one, and it scores 7 bonus points on top of its length.",
      },
      {
        q: "What are the ranks in Spelling Hive?",
        a: "Ranks are a share of the hive's maximum score: Beginner, Good Start, Moving Up, Good, Solid, Nice, Great (40%), Amazing (50%), Genius (70%) and Hive Master, which takes every word in the list.",
      },
      {
        q: "Why doesn't a real word count?",
        a: "The scoring list sticks to everyday words. Rarer dictionary words are still accepted and shown as bonus words, but they score no points, so every rank can be reached with common vocabulary.",
      },
      {
        q: "How do hints work in Spelling Hive?",
        a: "The hints grid (words left by first letter and length) and the two-letter starts list are free. The coach gives up to three hints: first a two-letter start, then the word's pattern like T _ _ _ N, then the word itself. Coach hints are counted in your result.",
      },
    ],
  },
  "letter-box": {
    name: "Letter Box",
    genre: "Word game",
    summary:
      "Letter Box is a free daily word puzzle: twelve letters sit three to a side of a square, and you chain words that use every letter, each word starting with the last letter of the one before. Today's box always has a two-word solution, and your word count and time are ranked against today's players.",
    description: "Free daily word-chain puzzle around a square of twelve letters, with a coach and unlimited practice boxes.",
    qa: [
      {
        q: "How do you play Letter Box?",
        a: "Spell words of three or more letters by tapping letters around the square. Consecutive letters must come from different sides, and each new word starts with the last letter of the previous word. You win when every one of the twelve letters has been used.",
      },
      {
        q: "Can letters be used more than once?",
        a: "Yes. Letters can be reused as often as you like; the goal is to use every letter at least once in as few words as possible.",
      },
      {
        q: "What does par mean in Letter Box?",
        a: "Par is the fewest words the puzzle can be solved in. Every daily box is generated around a two-word solution, so par is two words, and there are three-word solutions as well.",
      },
      {
        q: "How do you find a two-word solution?",
        a: "Look for a long word that uses many letters and ends on a letter that starts words easily, then a second word that picks up every letter still unused. Rare letters such as J, Q, X or Z are best placed in the middle of a long word.",
      },
      {
        q: "Is there a hint in Letter Box?",
        a: "Yes. The coach gives up to three hints, each in steps: a good letter to start from, then the next word's length and how many new letters it uses, then the word from a shortest solution. Hints are counted in your result.",
      },
    ],
  },
} as const;

export type GameGuideSlug = keyof typeof GAME_GUIDES;

export const HOW_TO_QA: QA[] = [
  GAME_GUIDES.sudoku.qa[0],
  GAME_GUIDES.sudoku.qa[1],
  GAME_GUIDES.solitaire.qa[0],
  GAME_GUIDES.solitaire.qa[3],
  {
    q: "How do word-guessing games like Wordle work?",
    a: "You have six tries to guess a hidden five-letter word. After each guess every letter turns green (right letter, right spot), yellow (in the word, wrong spot) or gray (not in the word).",
  },
  {
    q: "How do you get better at daily puzzles?",
    a: "Play every day, and when you're stuck use a hint that teaches rather than one that just tells you the answer. Funzzle's coach names the technique behind each step so you can spot it yourself next time.",
  },
];

// ---------------------------------------------------------------------------
// NYT answer pages
// ---------------------------------------------------------------------------

export function wordleAnswerCopy(long: string, data: WordleAnswerData | undefined) {
  if (!data) {
    return {
      summary: `The Wordle answer for ${long} goes up just after midnight UTC, with three hints before the reveal.`,
      qa: WORDLE_GENERAL,
    };
  }
  const word = data.answer.toUpperCase();
  const v = vowelsIn(word);
  return {
    summary: `Today's Wordle answer (${long}) is a five-letter word with ${plural(v, "vowel")}. Work through the hints below, from gentle to strong, or reveal the answer when you're ready.`,
    qa: [
      { q: `What is the Wordle answer today, ${long}?`, a: `The Wordle answer for ${long} is ${word}.` },
      { q: "What letter does today's Wordle start with?", a: `Today's Wordle starts with the letter ${data.hint_first_letter.toUpperCase()}.` },
      { q: "How many vowels are in today's Wordle?", a: `Today's Wordle has ${plural(v, "vowel")}${new Set(word).size < 5 ? " and at least one repeated letter" : " and no repeated letters"}.` },
      ...WORDLE_GENERAL,
    ],
  };
}

const WORDLE_GENERAL: QA[] = [
  {
    q: "What time does the new Wordle come out?",
    a: "A new Wordle unlocks at midnight in your local time zone. Funzzle posts each day's hints and answer at midnight UTC.",
  },
  {
    q: "What's a good Wordle starting word?",
    a: "Use five different common letters with two or three vowels, such as CRANE, SLATE or RAISE. They rule out the most words on the first guess.",
  },
];

export function connectionsAnswerCopy(long: string, data: ConnectionsAnswerData | undefined) {
  const groups = data?.groups ?? [];
  if (groups.length < 4) {
    return {
      summary: `The Connections answers for ${long} go up just after midnight UTC: hints for each group first, then the four groups.`,
      qa: CONNECTIONS_GENERAL,
    };
  }
  const sorted = [...groups].sort((a, b) => a.level - b.level);
  return {
    summary: `Today's Connections (${long}) has four groups of four, from yellow (easiest) to purple (trickiest). Start with the hints below; each group's answer stays hidden until you tap it.`,
    qa: [
      {
        q: `What are today's Connections answers, ${long}?`,
        a: sorted.map((g) => `${g.title}: ${g.words.join(", ")}`).join(". ") + ".",
      },
      { q: "What is the purple group in today's Connections?", a: `The purple group is ${sorted[3].title}: ${sorted[3].words.join(", ")}.` },
      { q: "What is the yellow group in today's Connections?", a: `The yellow group is ${sorted[0].title}: ${sorted[0].words.join(", ")}.` },
      ...CONNECTIONS_GENERAL,
    ],
  };
}

const CONNECTIONS_GENERAL: QA[] = [
  {
    q: "How does Connections work?",
    a: "You get 16 words and sort them into four groups of four that share a hidden link. You can make four mistakes. Yellow is the easiest group, then green, blue and purple, which usually involves wordplay.",
  },
  {
    q: "What time does the new Connections come out?",
    a: "A new Connections puzzle unlocks at midnight in your local time zone. Funzzle posts the hints and answers at midnight UTC.",
  },
];

export function miniAnswerCopy(long: string, data: CrosswordAnswerData | undefined) {
  const across = data?.across ?? [];
  const down = data?.down ?? [];
  if (!across.length) {
    return {
      summary: `The Mini Crossword answers for ${long} go up as soon as the puzzle is released, with hints before every answer.`,
      qa: MINI_GENERAL,
    };
  }
  const first = across[0];
  return {
    summary: `Today's Mini Crossword (${long}) has ${plural(across.length, "across clue")} and ${plural(down.length, "down clue")}. Get a nudge from the hints below, or open the full answer list with an explanation for every clue.`,
    qa: [
      {
        q: `What are the Mini Crossword answers for ${long}?`,
        a: `Across: ${across.map((c) => `${c.number} ${c.answer.toUpperCase()}`).join(", ")}. Down: ${down.map((c) => `${c.number} ${c.answer.toUpperCase()}`).join(", ")}.`,
      },
      { q: `What is 1-Across in today's Mini, "${first.clue}"?`, a: `1-Across, "${first.clue}", is ${first.answer.toUpperCase()}.` },
      ...MINI_GENERAL,
    ],
  };
}

const MINI_GENERAL: QA[] = [
  {
    q: "What time does the NYT Mini come out?",
    a: "The Mini for the next day is released at 10 p.m. Eastern on weekdays and 6 p.m. Eastern on weekends. Funzzle posts hints and answers as soon as it's out.",
  },
  {
    q: "How long does the Mini Crossword take?",
    a: "Most people finish the 5×5 Mini in one to three minutes. Saturday's Mini is often a larger grid and takes a little longer.",
  },
];

export function clueAnswerCopy(clue: string, answer: string) {
  const n = answer.length;
  return {
    summary: `The answer to the crossword clue "${clue}" is ${n} letters long and starts with ${answer[0].toUpperCase()}. Reveal the full answer below, with an explanation.`,
    qa: [
      { q: `What is the answer to "${clue}"?`, a: `The answer to the crossword clue "${clue}" is ${answer.toUpperCase()} (${n} letters).` },
      { q: `How many letters is the answer to "${clue}"?`, a: `${n} letters, starting with ${answer[0].toUpperCase()}.` },
    ],
  };
}
