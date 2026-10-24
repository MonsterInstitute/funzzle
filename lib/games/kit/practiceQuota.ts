/**
 * Practice puzzles per game per day: FREE_PRACTICE are free; after that an
 * opt-in rewarded ad unlocks UNLOCK more. Without rewarded ads (not approved,
 * no fill) practice simply stays unlimited — see useRewardedOffer.
 */
import { readJson, writeJson } from "./storage";

export const FREE_PRACTICE = 5;
export const UNLOCK = 5;

interface Quota {
  day: string;
  played: number;
  allowed: number;
}

const key = (game: string) => `fz:practice-quota:${game}`;
const today = () => new Date().toISOString().slice(0, 10);

function read(game: string): Quota {
  const q = readJson<Quota | null>(key(game), null);
  return q && q.day === today() ? q : { day: today(), played: 0, allowed: FREE_PRACTICE };
}

/** True when the next practice puzzle needs an unlock. */
export function practiceLocked(game: string): boolean {
  const q = read(game);
  return q.played >= q.allowed;
}

export function countPractice(game: string): void {
  const q = read(game);
  writeJson(key(game), { ...q, played: q.played + 1 });
}

export function unlockPractice(game: string): void {
  const q = read(game);
  writeJson(key(game), { ...q, allowed: Math.max(q.allowed, q.played) + UNLOCK });
}
