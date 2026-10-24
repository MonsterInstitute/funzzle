import { NextResponse } from "next/server";
import { writeCoachText, type CoachTextResult } from "@/lib/cron/coachText";
import { explainAnswers } from "@/lib/cron/explainAnswers";
import { logRun } from "@/lib/cron/runLog";
import { shiftISODate, todayISO } from "@/lib/dates";
import { hasDeepSeek } from "@/lib/deepseek";
import { isCronRequest } from "@/lib/secret";

/**
 * Explain cron ("20 3,7,15,23 * * *", worker.ts): DeepSeek explanations for
 * today's and tomorrow's answers (lib/cron/explainAnswers.ts) and AI Coach
 * text for the daily Sudoku (lib/cron/coachText.ts). Each step runs even if
 * another fails; any failure returns 502 so worker.ts emails an alert. Pages
 * work without either: answers show without prose, the coach falls back to
 * the solver's own explanation.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = new Date().toISOString();
  if (!hasDeepSeek()) {
    await logRun("explain", startedAt, false, { error: "DEEPSEEK_API_KEY is not set" });
    return NextResponse.json({ ok: false, error: "DEEPSEEK_API_KEY is not set" }, { status: 502 });
  }
  const today = todayISO();
  const dates = [today, shiftISODate(today, 1)];
  const errors: string[] = [];

  let answers;
  try {
    answers = await explainAnswers(today, dates);
    for (const f of answers.failed) errors.push(`answers ${f.row}: ${f.error}`);
  } catch (err) {
    errors.push(`answers: ${(err as Error).message}`);
  }

  const coach: CoachTextResult[] = [];
  for (const date of dates) {
    try {
      coach.push(await writeCoachText(date));
    } catch (err) {
      errors.push(`coach ${date}: ${(err as Error).message}`);
    }
  }

  const ok = errors.length === 0;
  const detail = { ok, answers, coach, errors };
  await logRun("explain", startedAt, ok, detail);
  return NextResponse.json(detail, { status: ok ? 200 : 502 });
}
