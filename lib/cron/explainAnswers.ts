import { revalidatePath } from "next/cache";
import { all, exec } from "@/lib/db";
import { deepSeekJson } from "@/lib/deepseek";
import type { ConnectionsAnswerData, CrosswordAnswerData, WordleAnswerData } from "@/lib/getAnswers";
import { pathsToRevalidate } from "@/lib/revalidation";

/**
 * DeepSeek explanations for today's and tomorrow's stored answers that don't
 * have them yet (summary IS NULL). The answers are already real (the answers
 * cron fetched them from public sources); DeepSeek only writes prose around
 * them and never changes an answer. Rows are updated in place.
 */

async function explainMini(puzzle: CrosswordAnswerData) {
  const list = (arr: CrosswordAnswerData["across"], dir: string) => arr.map((c) => `${c.number}${dir}. ${c.clue} => ${c.answer}`).join("\n");
  const out = await deepSeekJson<{ summary?: string; clues?: Record<string, string> }>(
    "explain:nyt-mini",
    `These are the REAL, already-solved answers to today's NYT Mini crossword. Do NOT change any answer. Write short explanations of why each answer fits its clue.

ACROSS
${list(puzzle.across, "A")}
DOWN
${list(puzzle.down, "D")}

Return ONLY JSON:
{
  "summary": "<one or two sentences summarizing today's mini and any theme>",
  "clues": { "1A": "<one concise sentence>", "2D": "..." }
}
Include one entry in "clues" for every clue above, keyed by number + A (across) or D (down). Keep each explanation factual and under 20 words.`
  );
  const clues = out.clues ?? {};
  const withExplanations = (arr: CrosswordAnswerData["across"], dir: string) =>
    arr.map((c) => ({ ...c, explanation: typeof clues[`${c.number}${dir}`] === "string" ? clues[`${c.number}${dir}`] : c.explanation }));
  return {
    summary: typeof out.summary === "string" ? out.summary : null,
    data: { across: withExplanations(puzzle.across, "A"), down: withExplanations(puzzle.down, "D") },
  };
}

async function explainWordle(data: WordleAnswerData) {
  const out = await deepSeekJson<{ summary?: string }>(
    "explain:wordle",
    `Today's real Wordle answer is "${data.answer}". Do NOT change it. Return ONLY JSON:
{"summary": "<one factual sentence about the word ${data.answer} — its meaning and what makes it easy or tricky to guess>"}`
  );
  return { summary: typeof out.summary === "string" ? out.summary : null, data };
}

async function explainConnections(data: ConnectionsAnswerData) {
  const list = data.groups.map((g) => `${g.color} — ${g.title}: ${g.words.join(", ")}`).join("\n");
  const out = await deepSeekJson<{ summary?: string; notes?: Record<string, string> }>(
    "explain:connections",
    `These are today's REAL NYT Connections groups (already solved). Do NOT change any word or group. Write a short factual note for each group explaining the connection, plus a one-sentence overall summary.

${list}

Return ONLY JSON:
{"summary":"<one sentence>","notes":{"${data.groups[0]?.title ?? "GROUP"}":"<one concise sentence, under 22 words>"}}
Include one entry in "notes" for every group title above.`
  );
  const notes = out.notes ?? {};
  return {
    summary: typeof out.summary === "string" ? out.summary : null,
    data: { ...data, groups: data.groups.map((g) => ({ ...g, note: typeof notes[g.title] === "string" ? notes[g.title] : g.note })) },
  };
}

const EXPLAIN: Record<string, (data: never) => Promise<{ summary: string | null; data: unknown }>> = {
  wordle: explainWordle,
  connections: explainConnections,
  "nyt-mini": explainMini,
};

export interface ExplainAnswersResult {
  explained: string[];
  failed: { row: string; error: string }[];
  revalidated: boolean;
}

export async function explainAnswers(today: string, dates: string[]): Promise<ExplainAnswersResult> {
  const rows = await all<{ publish_date: string; type: string; answer_data: string }>(
    `SELECT publish_date, type, answer_data FROM answers WHERE summary IS NULL AND publish_date IN (${dates.map(() => "?").join(", ")})`,
    ...dates
  );
  const explained: string[] = [];
  const failed: ExplainAnswersResult["failed"] = [];
  for (const row of rows) {
    const id = `${row.publish_date} ${row.type}`;
    const explain = EXPLAIN[row.type];
    if (!explain) continue;
    try {
      const { summary, data } = await explain(JSON.parse(row.answer_data) as never);
      if (!summary) throw new Error("no summary in reply");
      await exec(
        "UPDATE answers SET answer_data = ?, summary = ?, updated_at = ? WHERE publish_date = ? AND type = ? AND summary IS NULL",
        JSON.stringify(data),
        summary,
        new Date().toISOString(),
        row.publish_date,
        row.type
      );
      explained.push(id);
    } catch (err) {
      failed.push({ row: id, error: (err as Error).message });
    }
  }
  // Tomorrow's rows are published by the 00:01 rollover; today's need a refresh now.
  const revalidated = explained.some((id) => id.startsWith(today));
  if (revalidated) for (const p of pathsToRevalidate([today])) revalidatePath(p);
  return { explained, failed, revalidated };
}
