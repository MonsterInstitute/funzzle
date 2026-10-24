import { NextResponse } from "next/server";
import { name, randomCode, UUID_RE } from "@/lib/apiValidate";
import { shiftISODate, todayISO } from "@/lib/dates";
import { all, batch, exec, first } from "@/lib/db";
import { leagueBoards, weekStart } from "@/lib/leagueBoard";

/**
 * Private leagues with an invite code (family, office, class). No login:
 * members are anonymous client ids with a display name; ids are never returned.
 *
 *   POST {action: "create", name, clientId, displayName} → {code, name}
 *   POST {action: "join",   code, clientId, displayName} → {code, name}
 *   POST {action: "leave",  code, clientId}              → {ok}
 *   GET  ?code=&week=YYYY-MM-DD → {code, name, week, members, boards} (CDN-cached 60 s)
 */

const CODE_RE = /^[A-Z2-9]{6}$/;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_MEMBERS = 200;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").toUpperCase();
  const weekParam = url.searchParams.get("week");
  if (!CODE_RE.test(code) || (weekParam && !/^\d{4}-\d{2}-\d{2}$/.test(weekParam))) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const week = weekStart(weekParam ?? todayISO());
  try {
    const league = await first<{ id: number; name: string }>("SELECT id, name FROM leagues WHERE code = ?", code);
    if (!league) return NextResponse.json({ error: "not found" }, { status: 404 });
    const [members, results] = await Promise.all([
      all<{ name: string }>("SELECT name FROM league_members WHERE league_id = ? ORDER BY joined_at", league.id),
      all<{ name: string; game: string; date: string; variant: string; time_ms: number }>(
        `SELECT m.name, r.game, r.puzzle_date AS date, r.variant, r.time_ms
         FROM league_members m JOIN game_results r ON r.client_id = m.client_id
         WHERE m.league_id = ? AND r.puzzle_date BETWEEN ? AND ?`,
        league.id,
        week,
        shiftISODate(week, 6)
      ),
    ]);
    const boards = leagueBoards(
      members.map((m) => m.name),
      results.map((r) => ({ name: r.name, game: r.game, date: r.date, variant: r.variant, timeMs: r.time_ms }))
    );
    return NextResponse.json(
      { code, name: league.name, week, members: members.map((m) => m.name), boards },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (err) {
    console.error(`league read: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  const clientId = String(body?.clientId ?? "");
  if (!UUID_RE.test(clientId)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    if (action === "create") {
      const leagueName = name(body?.name);
      const member = name(body?.displayName);
      if (!leagueName || !member) return NextResponse.json({ error: "bad request" }, { status: 400 });
      const code = randomCode(6, CODE_ALPHABET);
      await batch([
        ["INSERT INTO leagues (code, name, created_by) VALUES (?, ?, ?)", code, leagueName, clientId],
        ["INSERT INTO league_members (league_id, client_id, name) SELECT id, ?, ? FROM leagues WHERE code = ?", clientId, member, code],
      ]);
      return NextResponse.json({ code, name: leagueName });
    }
    const code = String(body?.code ?? "").toUpperCase();
    if (!CODE_RE.test(code)) return NextResponse.json({ error: "bad request" }, { status: 400 });
    const league = await first<{ id: number; name: string; n: number }>(
      "SELECT id, name, (SELECT count(*) FROM league_members WHERE league_id = leagues.id) AS n FROM leagues WHERE code = ?",
      code
    );
    if (!league) return NextResponse.json({ error: "No league has that code." }, { status: 404 });
    if (action === "join") {
      const member = name(body?.displayName);
      if (!member) return NextResponse.json({ error: "bad request" }, { status: 400 });
      if (league.n >= MAX_MEMBERS) return NextResponse.json({ error: "That league is full." }, { status: 409 });
      await exec(
        "INSERT INTO league_members (league_id, client_id, name) VALUES (?, ?, ?) ON CONFLICT(league_id, client_id) DO UPDATE SET name = excluded.name",
        league.id,
        clientId,
        member
      );
      return NextResponse.json({ code, name: league.name });
    }
    if (action === "leave") {
      await exec("DELETE FROM league_members WHERE league_id = ? AND client_id = ?", league.id, clientId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  } catch (err) {
    console.error(`league write: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
