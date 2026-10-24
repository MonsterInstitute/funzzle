/**
 * Private leagues (app/api/leagues): create or join with an invite code; the
 * codes this browser belongs to are remembered locally.
 */
import { setFlag } from "./achievements";
import { track } from "./analytics";
import { getDisplayName, setDisplayName } from "./identity";
import { clientId, readJson, writeJson } from "./storage";

const KEY = "fz:leagues";

export interface MyLeague {
  code: string;
  name: string;
}

export interface BoardRow {
  name: string;
  points: number;
  played: number;
}

export interface LeagueBoard {
  code: string;
  name: string;
  week: string;
  members: string[];
  boards: Record<string, BoardRow[]>;
}

export function myLeagues(): MyLeague[] {
  return readJson<MyLeague[]>(KEY, []);
}

function remember(l: MyLeague) {
  writeJson(KEY, [...myLeagues().filter((x) => x.code !== l.code), l]);
}

async function post(body: object): Promise<Record<string, unknown>> {
  const res = await fetch("/api/leagues", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, clientId: clientId() }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" && data.error !== "bad request" ? data.error : "Something went wrong. Try again.");
  return data;
}

export async function createLeague(name: string, displayName: string): Promise<MyLeague> {
  const me = setDisplayName(displayName) || getDisplayName();
  const data = await post({ action: "create", name, displayName: me });
  const league = { code: String(data.code), name: String(data.name) };
  remember(league);
  setFlag("league-joined");
  track("league_create");
  return league;
}

export async function joinLeague(code: string, displayName: string): Promise<MyLeague> {
  const me = setDisplayName(displayName) || getDisplayName();
  const data = await post({ action: "join", code: code.trim().toUpperCase(), displayName: me });
  const league = { code: String(data.code), name: String(data.name) };
  remember(league);
  setFlag("league-joined");
  track("league_join");
  return league;
}

export async function leaveLeague(code: string): Promise<void> {
  await post({ action: "leave", code });
  writeJson(KEY, myLeagues().filter((l) => l.code !== code));
}

export async function fetchBoard(code: string, week?: string): Promise<LeagueBoard> {
  const res = await fetch(`/api/leagues?code=${code}${week ? `&week=${week}` : ""}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("Couldn’t load the league.");
  return (await res.json()) as LeagueBoard;
}

export function inviteLink(code: string): string {
  return `${location.origin}/leagues?join=${code}`;
}
