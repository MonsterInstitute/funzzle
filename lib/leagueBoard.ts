/**
 * Weekly league boards from the members' daily results. For each daily
 * puzzle (game, date, variant), every member who finished scores 1 point plus
 * 1 for each member they beat (on time, or on score for score-ranked games,
 * see lib/games/kit/resultConfig). A game's board sums its puzzles over
 * the week; the overall board sums every game.
 */
import { compareResults } from "./games/kit/resultConfig";

export interface MemberResult {
  name: string;
  game: string;
  date: string;
  variant: string;
  /** game_results.time_ms: the time, or the score for score games. */
  timeMs: number;
  /** Score / words used, for score-ranked games. */
  moves?: number | null;
  mistakes?: number;
  hints?: number;
}

export interface BoardRow {
  name: string;
  points: number;
  played: number;
}

export function leagueBoards(members: string[], results: MemberResult[]): Record<string, BoardRow[]> {
  const puzzles = new Map<string, MemberResult[]>();
  for (const r of results) {
    const key = `${r.game}|${r.date}|${r.variant}`;
    puzzles.set(key, [...(puzzles.get(key) ?? []), r]);
  }
  const boards: Record<string, Map<string, BoardRow>> = { overall: new Map() };
  const add = (board: string, nm: string, points: number) => {
    const b = (boards[board] ??= new Map());
    const row = b.get(nm) ?? { name: nm, points: 0, played: 0 };
    row.points += points;
    row.played += 1;
    b.set(nm, row);
  };
  for (const entries of puzzles.values()) {
    for (const r of entries) {
      const beaten = entries.filter((o) => compareResults(r.game, r, o) < 0).length;
      add(r.game, r.name, 1 + beaten);
      add("overall", r.name, 1 + beaten);
    }
  }
  // Everyone appears on the overall board, even before their first result.
  for (const m of members) if (!boards.overall.has(m)) boards.overall.set(m, { name: m, points: 0, played: 0 });
  return Object.fromEntries(
    Object.entries(boards).map(([k, b]) => [k, [...b.values()].sort((a, z) => z.points - a.points || z.played - a.played || a.name.localeCompare(z.name))])
  );
}

/** Monday (UTC) of the week containing `date`. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
