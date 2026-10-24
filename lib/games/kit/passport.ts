/**
 * Game passport: which of the 20 games this browser has tried, so the
 * profile can show the map and nudge the next one.
 */
import { GAMES } from "./catalog";
import { readJson, writeJson } from "./storage";

const KEY = "fz:passport";

export function triedGames(): Record<string, string> {
  return readJson<Record<string, string>>(KEY, {});
}

/** Stamp a game the first time it's played (game_start / game_complete). */
export function stampPassport(game: string): void {
  const tried = triedGames();
  if (tried[game]) return;
  tried[game] = new Date().toISOString().slice(0, 10);
  writeJson(KEY, tried);
}

/** The next playable game not tried yet, in catalog order. */
export function nextToTry(): (typeof GAMES)[number] | null {
  const tried = triedGames();
  return GAMES.find((g) => g.href && !tried[g.slug]) ?? null;
}
