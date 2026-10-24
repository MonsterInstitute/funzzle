import { NextResponse } from "next/server";
import { BANK_BY_ID } from "@/lib/games/wordhunt/bank";
import { bankPuzzle } from "@/lib/games/wordhunt/server";

/**
 * A Word Hunt practice puzzle: GET ?id=<bank theme id>. Practice themes come
 * from the hand-written bank; the grid and its bonus words are built here
 * because the bonus words need the full word list, which stays on the server.
 * A theme's puzzle only changes with a deploy, so the CDN keeps it a day.
 */
export function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[a-z0-9-]{1,40}$/.test(id) || !BANK_BY_ID[id]) {
    return NextResponse.json({ error: "unknown theme" }, { status: 404 });
  }
  return NextResponse.json(bankPuzzle(id), {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
