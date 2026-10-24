import { all, first } from "./db";
import { CLUE_CONTENT } from "./content/clues";
import type { ClueEntry } from "./content/types";

export type ClueRecord = ClueEntry;

const LOCAL_BY_SLUG = new Map(CLUE_CONTENT.map((c) => [c.slug, c]));

/** Coerce a stored appearances value into an array of date strings. */
function toAppearances(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
}

/**
 * The DB `appearances` column stores an integer count, so DB rows arrive with
 * no dates. Backfill the appearance dates (and any missing prose) from the
 * matching local content entry so appearance links keep working.
 */
function enrich(rec: ClueRecord): ClueRecord {
  const local = LOCAL_BY_SLUG.get(rec.slug);
  if (!local) return rec;
  return {
    ...rec,
    explanation: rec.explanation || local.explanation,
    appearances:
      rec.appearances.length > 0 ? rec.appearances : local.appearances,
  };
}

function mapRow(row: Record<string, unknown>): ClueRecord {
  return {
    slug: String(row.slug ?? ""),
    clue_text: String(row.clue_text ?? ""),
    answer: String(row.answer ?? "").toUpperCase(),
    source: String(row.source ?? "nyt-mini"),
    explanation: String(row.explanation ?? ""),
    appearances: toAppearances(row.appearances),
  };
}

/**
 * Load every clue from D1, or bundled local content while the table is empty.
 * A database failure throws (see AnswersUnavailableError in getAnswers.ts for
 * why an error must not be cached as a fallback page).
 */
export async function loadAllClues(): Promise<ClueRecord[]> {
  const rows = await all("SELECT * FROM clues");
  return rows.length ? rows.map(mapRow).map(enrich) : CLUE_CONTENT;
}

/** All clue slugs, for generateStaticParams. */
export async function getAllClueSlugs(): Promise<string[]> {
  const all = await loadAllClues();
  const local = new Set(CLUE_CONTENT.map((c) => c.slug));
  const slugs = new Set<string>(all.map((c) => c.slug));
  // Always include local slugs so nothing 404s if the DB is a subset.
  for (const s of local) slugs.add(s);
  return [...slugs].filter(Boolean);
}

/** A single clue by slug. Throws on a database failure. */
export async function getClue(slug: string): Promise<ClueRecord | null> {
  const row = await first("SELECT * FROM clues WHERE slug = ?", slug);
  if (row) return enrich(mapRow(row));
  return CLUE_CONTENT.find((c) => c.slug === slug) ?? null;
}

/** Up to `limit` clues that appeared in the puzzle for a given date. */
export async function getCluesForDate(
  date: string,
  limit = 3
): Promise<ClueRecord[]> {
  const all = await loadAllClues();
  return all.filter((c) => c.appearances.includes(date)).slice(0, limit);
}

/** Up to `limit` other clues whose answers have the same length. */
export async function getRelatedClues(
  slug: string,
  answer: string,
  limit = 3
): Promise<ClueRecord[]> {
  const all = await loadAllClues();
  const len = answer.length;
  const seen = new Set<string>();
  const related: ClueRecord[] = [];
  for (const c of all) {
    if (c.slug === slug || seen.has(c.slug)) continue;
    if (c.answer.length === len) {
      related.push(c);
      seen.add(c.slug);
    }
    if (related.length >= limit) break;
  }
  return related;
}
