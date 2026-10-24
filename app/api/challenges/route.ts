import { NextResponse } from "next/server";
import { COMPETITIVE_GAMES, name, puzzle, randomCode, result, UUID_RE } from "@/lib/apiValidate";
import { all, batch, exec, first } from "@/lib/db";
import { isScoreGame, resultOrder, resultOrderSql } from "@/lib/games/kit/resultConfig";

/**
 * Friend challenges (lib/games/kit/challenge.ts). No login: entries are keyed
 * by the anonymous client id, which is never returned.
 *
 *   POST {game, puzzle, label, clientId, name, result}  → {id}
 *   PUT  {id, clientId, name, result}                    → challenge (first result counts)
 *   GET  ?id=                                            → challenge (CDN-cached 15 s)
 */

const ID_RE = /^[a-z0-9]{8}$/;

async function load(id: string) {
  const c = await first<{ id: string; game: string; puzzle: string; label: string; created_by: string }>(
    "SELECT id, game, puzzle, label, created_by FROM challenges WHERE id = ?",
    id
  );
  if (!c) return null;
  // Best first: fastest, or best score for score-ranked games (lib/games/kit/resultConfig).
  const entries = await all<{ client_id: string; name: string; time_ms: number; mistakes: number; hints: number; moves: number | null }>(
    `SELECT client_id, name, time_ms, mistakes, hints, moves FROM challenge_entries WHERE challenge_id = ? ORDER BY ${resultOrderSql(c.game)} LIMIT 50`,
    id
  );
  return {
    id: c.id,
    game: c.game,
    puzzle: JSON.parse(c.puzzle),
    label: c.label,
    entries: entries.map((e) => ({
      name: e.name,
      timeMs: e.time_ms,
      // Score games keep their points in `moves`.
      ...(isScoreGame(c.game) && e.moves !== null ? { score: e.moves } : {}),
      mistakes: e.mistakes,
      hints: e.hints,
      ...(e.moves === null ? {} : { moves: e.moves }),
      creator: e.client_id === c.created_by,
    })),
  };
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const c = await load(id);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=60" } });
    return NextResponse.json(c, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } });
  } catch (err) {
    console.error(`challenge read: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const game = String(body?.game ?? "");
  const p = puzzle(body?.puzzle);
  const label = typeof body?.label === "string" ? body.label.replace(/[<>\u0000-\u001f]/g, "").slice(0, 80) : "";
  const clientId = String(body?.clientId ?? "");
  const n = name(body?.name);
  const r = result(body?.result);
  if (!COMPETITIVE_GAMES.has(game) || !p || !label || !UUID_RE.test(clientId) || !n || !r || (resultOrder(game) !== "time" && r.moves === null)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const id = randomCode(8);
  try {
    await batch([
      ["INSERT INTO challenges (id, game, puzzle, label, created_by) VALUES (?, ?, ?, ?, ?)", id, game, JSON.stringify(p), label, clientId],
      [
        "INSERT INTO challenge_entries (challenge_id, client_id, name, time_ms, mistakes, hints, moves) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id,
        clientId,
        n,
        r.timeMs,
        r.mistakes,
        r.hints,
        r.moves,
      ],
    ]);
    return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(`challenge create: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = String(body?.id ?? "");
  const clientId = String(body?.clientId ?? "");
  const n = name(body?.name);
  const r = result(body?.result);
  if (!ID_RE.test(id) || !UUID_RE.test(clientId) || !n || !r) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    await exec(
      `INSERT INTO challenge_entries (challenge_id, client_id, name, time_ms, mistakes, hints, moves)
       SELECT id, ?, ?, ?, ?, ?, ? FROM challenges WHERE id = ?
       ON CONFLICT DO NOTHING`,
      clientId,
      n,
      r.timeMs,
      r.mistakes,
      r.hints,
      r.moves,
      id
    );
    const c = await load(id);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(c, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(`challenge entry: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
