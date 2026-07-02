// Authoritative Wordle answers for 2026-06-02 .. 2026-07-01 (exact order).
// Pulled in preference to any generated wordle data so the published answer
// pages match the intended daily words.
import type { WordleDay } from "./types";

export interface WordleContent {
  answer_data: WordleDay;
  summary: string;
}

/** Count a, e, i, o, u (y not counted). */
function vowels(word: string): number {
  return (word.match(/[aeiou]/gi) ?? []).length;
}

function make(answer: string, summary: string): WordleContent {
  return {
    answer_data: {
      answer,
      hint_first_letter: answer[0],
      hint_vowels: vowels(answer),
    },
    summary,
  };
}

const ORDERED: Array<{ date: string; word: string; summary: string }> = [
  { date: "2026-06-02", word: "CRANE", summary: "CRANE is both a long-necked wading bird and a construction machine — and a famously strong Wordle opener." },
  { date: "2026-06-03", word: "PLANT", summary: "PLANT works as a noun and a verb, and its consonant cluster PL- trips up guessers who lead with vowels." },
  { date: "2026-06-04", word: "BRAVE", summary: "BRAVE hides two vowels; openers like SLATE or CRANE reveal the A and E quickly." },
  { date: "2026-06-05", word: "LIGHT", summary: "LIGHT has just one vowel, so vowel-heavy openers leave most of the grid gray." },
  { date: "2026-06-06", word: "CHESS", summary: "CHESS repeats the S — a classic trap for solvers who assume five distinct letters." },
  { date: "2026-06-07", word: "GRAPE", summary: "GRAPE shares its skeleton with GRADE and GRACE; nail the last letter to finish fast." },
  { date: "2026-06-08", word: "MOUNT", summary: "MOUNT pairs O and U back to back, an unusual double-vowel run in Wordle answers." },
  { date: "2026-06-09", word: "DRINK", summary: "DRINK has a single I among four consonants — a good day for a consonant-rich second guess." },
  { date: "2026-06-10", word: "EAGLE", summary: "EAGLE is vowel-heavy with three vowels, so early A/E placements narrow it fast." },
  { date: "2026-06-11", word: "FLAME", summary: "FLAME rhymes with BLAME, FRAME and SHAME — pin the first two letters to break the tie." },
  { date: "2026-06-12", word: "GHOST", summary: "GHOST leads with the tricky GH- pairing and hides only one vowel." },
  { date: "2026-06-13", word: "HEART", summary: "HEART is an anagram of EARTH and RATHE; the letters are common but the order isn't obvious." },
  { date: "2026-06-14", word: "IVORY", summary: "IVORY starts with a vowel and ends in Y, a combination that stumps many openers." },
  { date: "2026-06-15", word: "KNEEL", summary: "KNEEL opens with a silent K and doubles the E — two quirks in one word." },
  { date: "2026-06-16", word: "LEMON", summary: "LEMON alternates consonant-vowel cleanly, making it friendly once you place the L." },
  { date: "2026-06-17", word: "MANGO", summary: "MANGO ends in O, a rarer Wordle finish that catches solvers expecting E." },
  { date: "2026-06-18", word: "NIGHT", summary: "NIGHT belongs to the -IGHT family with LIGHT, SIGHT and MIGHT; the first letter decides it." },
  { date: "2026-06-19", word: "OCEAN", summary: "OCEAN packs three vowels including an OE-A run, so vowel openers shine today." },
  { date: "2026-06-20", word: "PIANO", summary: "PIANO has three vowels and ends in O — an Italian loanword that reads easily once uncovered." },
  { date: "2026-06-21", word: "QUILT", summary: "QUILT features the ever-present QU pairing; find the Q and the U comes free." },
  { date: "2026-06-22", word: "RIVER", summary: "RIVER repeats the R around a central vowel pair, a tidy but sneaky pattern." },
  { date: "2026-06-23", word: "STONE", summary: "STONE overlaps heavily with STOLE, STORE and STOVE — the fourth letter is the key." },
  { date: "2026-06-24", word: "TIGER", summary: "TIGER splits its two vowels neatly and shares -GER with many words; lock the front half." },
  { date: "2026-06-25", word: "URBAN", summary: "URBAN starts with U, one of the rarer opening letters, which makes it deceptively hard." },
  { date: "2026-06-26", word: "VOICE", summary: "VOICE crams three vowels around a soft C, rewarding an early E or O placement." },
  { date: "2026-06-27", word: "WHALE", summary: "WHALE rhymes with SHALE and WHILE; the WH- opening is the giveaway." },
  { date: "2026-06-28", word: "XEROX", summary: "XEROX is a rare brand-name answer with two X's — almost nobody guesses it early." },
  { date: "2026-06-29", word: "YACHT", summary: "YACHT has just one true vowel and the silent-ish CH; its odd spelling makes it a stumper." },
  { date: "2026-06-30", word: "ZEBRA", summary: "ZEBRA opens with Z, the least-used letter, so it survives most standard openers untouched." },
  { date: "2026-07-01", word: "AMBER", summary: "AMBER is a warm hue and fossilized resin; common letters make it a gentle finish to the month." },
];

export const WORDLE_BY_DATE: Record<string, WordleContent> = Object.fromEntries(
  ORDERED.map(({ date, word, summary }) => [date, make(word, summary)])
);

export function getLocalWordle(date: string): WordleContent | null {
  return WORDLE_BY_DATE[date] ?? null;
}
