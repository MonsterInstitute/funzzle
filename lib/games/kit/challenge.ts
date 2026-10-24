/**
 * Friend challenges: "Challenge a friend" on a recap creates a link to the
 * same puzzle carrying your result; a friend who finishes it adds theirs, and
 * both see the head-to-head on /challenge?id=…. No login: entries are keyed by
 * the anonymous client id and show a display name.
 */
import { track } from "./analytics";
import { GAME_BY_SLUG } from "./catalog";
import { getDisplayName } from "./identity";
import { clientId, readJson, writeJson } from "./storage";

export type ChallengePuzzle =
  | { kind: "daily"; date: string; variant?: string }
  | { kind: "practice"; seed: string; level: string };

export interface ChallengeResult {
  timeMs: number;
  mistakes: number;
  hints: number;
  moves?: number;
  /** Score games (resultConfig kind "score"): the points compared, highest first. */
  score?: number;
}

export interface ChallengeEntry extends ChallengeResult {
  name: string;
}

export interface Challenge {
  id: string;
  game: string;
  puzzle: ChallengePuzzle;
  label: string;
  /** Best first (fastest, or highest score for score games). */
  entries: (ChallengeEntry & { creator: boolean })[];
}

const TIMEOUT_MS = 8_000;
const MINE = (id: string) => `fz:challenge:${id}`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

export function challengeLink(id: string): string {
  return `${location.origin}/challenge?id=${id}`;
}

export function challengePlayHref(game: string, id: string): string {
  // The catalog href: some games keep an older URL (mini-crossword → /play/mini).
  return `${GAME_BY_SLUG[game]?.href ?? `/play/${game}`}?challenge=${id}`;
}

/** My own entry in a challenge (remembered locally, to mark it as "you"). */
export function myEntry(id: string): ChallengeEntry | null {
  return readJson<ChallengeEntry | null>(MINE(id), null);
}

export async function createChallenge(game: string, puzzle: ChallengePuzzle, label: string, result: ChallengeResult): Promise<string> {
  const name = getDisplayName() || "A friend";
  const { id } = await api<{ id: string }>("/api/challenges", {
    method: "POST",
    body: JSON.stringify({ game, puzzle, label, clientId: clientId(), name, result }),
  });
  writeJson(MINE(id), { name, ...result });
  track("challenge_create", game, { kind: puzzle.kind });
  return id;
}

export function fetchChallenge(id: string): Promise<Challenge> {
  return api<Challenge>(`/api/challenges?id=${encodeURIComponent(id)}`);
}

export async function submitChallengeEntry(id: string, game: string, result: ChallengeResult): Promise<Challenge> {
  const name = getDisplayName() || "Friend";
  const challenge = await api<Challenge>("/api/challenges", {
    method: "PUT",
    body: JSON.stringify({ id, clientId: clientId(), name, result }),
  });
  if (!myEntry(id)) {
    writeJson(MINE(id), { name, ...result });
    track("challenge_complete", game, {});
  }
  return challenge;
}

/** The challenge id a game page was opened with (?challenge=…), if any. */
export function challengeFromUrl(): string | null {
  const id = new URLSearchParams(location.search).get("challenge");
  return id && /^[a-z0-9]{8}$/.test(id) ? id : null;
}
