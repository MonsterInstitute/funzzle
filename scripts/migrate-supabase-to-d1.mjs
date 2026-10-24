/**
 * One-off copy of every Supabase table into D1 (funzzle-db), then a check:
 * row counts per table and a content fingerprint of every row must match.
 * Idempotent: rows are upserted on their natural key, so it can be re-run to
 * pick up rows written to Supabase after the first copy.
 *
 *   node --env-file=.env.local scripts/migrate-supabase-to-d1.mjs [--verify-only]
 *
 * game_events is not copied: events now go to Workers Analytics Engine.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { d1 } from "./lib/d1-rest.mjs";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

const iso = (t) => (t ? new Date(t).toISOString() : null);
const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));

/** table -> how to read it from Supabase and write/compare it in D1. */
const TABLES = {
  answers: {
    key: ["publish_date", "type"],
    cols: ["puzzle_id", "publish_date", "type", "answer_data", "summary", "created_at", "updated_at"],
    row: (r) => [r.puzzle_id, r.publish_date, r.type, json(r.answer_data), r.summary, iso(r.created_at), iso(r.created_at)],
    fp: (r) => [r.publish_date, r.type, typeof r.answer_data === "string" ? r.answer_data : json(r.answer_data), r.summary ?? ""],
  },
  clues: {
    key: ["slug"],
    cols: ["slug", "clue_text", "answer", "source", "explanation", "appearances"],
    row: (r) => [r.slug, r.clue_text, r.answer, r.source, r.explanation, r.appearances],
    fp: (r) => [r.slug, r.clue_text, r.answer, r.source, r.explanation ?? "", Number(r.appearances)],
  },
  puzzles: {
    key: ["slug"],
    cols: ["id", "slug", "type", "publish_date", "title", "size", "grid", "clues", "created_at"],
    row: (r) => [r.id, r.slug, r.type, r.publish_date, r.title, r.size, json(r.grid), json(r.clues), iso(r.created_at)],
    fp: (r) => [r.slug, r.type, r.publish_date, r.title ?? "", typeof r.grid === "string" ? r.grid : json(r.grid), typeof r.clues === "string" ? r.clues : json(r.clues)],
  },
  email_subscribers: {
    key: ["email"],
    cols: ["id", "email", "created_at", "unsubscribe_token", "unsubscribed"],
    row: (r) => [r.id, r.email, iso(r.created_at), r.unsubscribe_token, r.unsubscribed ? 1 : 0],
    fp: (r) => [r.email, r.unsubscribe_token, Number(Boolean(r.unsubscribed))],
  },
  daily_puzzles: {
    key: ["game", "puzzle_date", "variant"],
    cols: ["game", "puzzle_date", "variant", "data", "created_at"],
    row: (r) => [r.game, r.puzzle_date, r.variant, json(r.data), iso(r.created_at)],
    fp: (r) => [r.game, r.puzzle_date, r.variant, typeof r.data === "string" ? r.data : json(r.data)],
  },
  game_results: {
    key: ["game", "puzzle_date", "variant", "client_id"],
    cols: ["game", "puzzle_date", "variant", "client_id", "time_ms", "mistakes", "hints", "moves", "created_at"],
    row: (r) => [r.game, r.puzzle_date, r.variant, r.client_id, r.time_ms, r.mistakes, r.hints, r.moves, iso(r.created_at)],
    fp: (r) => [r.game, r.puzzle_date, r.variant, r.client_id, r.time_ms, r.mistakes, r.hints, r.moves],
  },
  coach_explanations: {
    key: ["game", "puzzle_date", "step_key"],
    cols: ["game", "puzzle_date", "step_key", "text", "created_at"],
    row: (r) => [r.game, r.puzzle_date, r.step_key, r.text, iso(r.created_at)],
    fp: (r) => [r.game, r.puzzle_date, r.step_key, r.text],
  },
};

/** JSON key order differs between jsonb and text: compare parsed + re-sorted. */
function canonical(v) {
  if (typeof v === "string" && /^[[{]/.test(v)) {
    try {
      v = JSON.parse(v);
    } catch {
      return v;
    }
  }
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
}
const digest = (fps) =>
  createHash("sha256")
    .update(fps.map((f) => JSON.stringify(canonical(f))).sort().join("\n"))
    .digest("hex")
    .slice(0, 16);

async function readSupabase(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function copy(table, spec, rows) {
  const placeholders = spec.cols.map(() => "?").join(", ");
  const updates = spec.cols.filter((c) => !spec.key.includes(c) && c !== "id").map((c) => `${c} = excluded.${c}`);
  const sql = `INSERT INTO ${table} (${spec.cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${spec.key.join(", ")}) DO ${
    updates.length ? `UPDATE SET ${updates.join(", ")}` : "NOTHING"
  }`;
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++];
      await d1(sql, spec.row(r));
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

const verifyOnly = process.argv.includes("--verify-only");
let mismatches = 0;
console.log("table               supabase    d1   content");
for (const [table, spec] of Object.entries(TABLES)) {
  const src = await readSupabase(table);
  if (!verifyOnly && src.length) await copy(table, spec, src);
  const dst = await d1(`SELECT * FROM ${table}`);
  const same = src.length === dst.length && digest(src.map(spec.fp)) === digest(dst.map(spec.fp));
  if (!same) mismatches++;
  console.log(`${table.padEnd(20)}${String(src.length).padStart(8)}${String(dst.length).padStart(6)}   ${same ? "match" : "MISMATCH"}`);
}
if (mismatches) {
  console.error(`${mismatches} table(s) differ`);
  process.exit(1);
}
