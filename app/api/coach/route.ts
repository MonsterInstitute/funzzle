import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

/**
 * Cached AI Coach explanation for a step of a daily puzzle:
 * GET ?game=&date=&key= → {text} or 404. The Daily Content workflow writes
 * these with DeepSeek ahead of time (scripts/generate-coach.mjs), so a hint
 * never triggers an LLM call; without a cached text the game shows the
 * solver's own explanation.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEY_RE = /^[a-z0-9:,_-]{1,120}$/;
const GAMES = new Set(["sudoku", "solitaire"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = url.searchParams.get("game") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const key = url.searchParams.get("key") ?? "";
  if (!GAMES.has(game) || !DATE_RE.test(date) || !KEY_RE.test(key)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { data, error } = await createServiceSupabase()
    .from("coach_explanations")
    .select("text")
    .eq("game", game)
    .eq("puzzle_date", date)
    .eq("step_key", key)
    .maybeSingle();
  if (error) {
    console.error(`coach_explanations read: ${error.message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  // Cached either way: the text for a (puzzle, step) never changes, and a miss
  // only becomes a hit when the workflow runs, a few times a day.
  const headers = { "Cache-Control": `public, s-maxage=${data ? 86_400 : 3_600}, stale-while-revalidate=86400` };
  if (!data) return NextResponse.json({ text: null }, { status: 404, headers });
  return NextResponse.json({ text: data.text }, { headers });
}
