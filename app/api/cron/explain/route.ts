import { NextResponse } from "next/server";
import { writeCoachText, type CoachTextResult } from "@/lib/cron/coachText";
import { explainAnswers } from "@/lib/cron/explainAnswers";
import { logRun } from "@/lib/cron/runLog";
import { shiftISODate, todayISO } from "@/lib/dates";
import { hasDeepSeek } from "@/lib/deepseek";
import { isCronRequest } from "@/lib/secret";
import { revalidatePath } from "next/cache";
import { ensureGroupsPuzzles } from "@/lib/cron/content/groups";
import { ensureMiniPuzzles } from "@/lib/cron/content/mini";
import { ensureWordHuntPuzzles } from "@/lib/cron/content/wordhunt";
import { ensureWordSearchPuzzles } from "@/lib/cron/content/wordsearch";
import { crosswordDatesAhead, ensureCrosswordPuzzles } from "@/lib/cron/content/crossword";
import { isRejectionLine } from "@/lib/cron/content/rejections";
import { checkDeepSeekBalance, type BalanceCheck } from "@/lib/cron/deepseekBalance";

/**
 * Explain cron ("20 3,7,15,23 * * *", worker.ts): DeepSeek explanations for
 * today's and tomorrow's answers (lib/cron/explainAnswers.ts) and AI Coach
 * text for the daily Sudoku (lib/cron/coachText.ts), the LLM content jobs, and
 * the DeepSeek balance check (lib/cron/deepseekBalance.ts). Each step runs even if
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
  // Content jobs work two days ahead: a DeepSeek outage of a day still leaves
  // tomorrow's AI puzzle in place.
  const contentDates = [...dates, shiftISODate(today, 2)];
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

  // LLM-written daily content (clues, categories, themes), validated in code.
  // Each job falls back to its hand-written bank, so a failure only alerts.
  // A job also returns one line per date whose replies were rejected (why).
  const content: Record<string, string[]> = {};
  const jobs: [string, string, (dates: string[]) => Promise<string[]>][] = [
    ["groups", "/play/groups", ensureGroupsPuzzles],
    ["mini-crossword", "/play/mini", ensureMiniPuzzles],
    ["word-hunt", "/play/word-hunt", ensureWordHuntPuzzles],
    ["word-search", "/play/word-search", ensureWordSearchPuzzles],
    // Crosswords take several clue calls each: today + 2 days ahead per run
    // keeps every run well inside a cron's 15-minute limit, and four runs a
    // day keep a 2-day buffer against a DeepSeek outage.
    ["crossword", "/play/crossword", () => ensureCrosswordPuzzles(crosswordDatesAhead().slice(0, 3))],
  ];
  for (const [game, path, ensure] of jobs) {
    try {
      content[game] = (await ensure(contentDates)).filter(Boolean);
      // Today's row only changes a live page if it was written just now.
      if (content[game].some((w) => w.includes(today) && !isRejectionLine(w))) revalidatePath(path);
    } catch (err) {
      errors.push(`${game}: ${(err as Error).message}`);
    }
  }

  // Balance after the calls above, so it reflects today's spend. Low balance
  // emails its own warning (once a day); only a failed check fails the run.
  let balance: BalanceCheck | undefined;
  try {
    balance = await checkDeepSeekBalance();
  } catch (err) {
    errors.push(`balance: ${(err as Error).message}`);
  }

  const ok = errors.length === 0;
  // errors and content first: logRun keeps only the first 4000 chars.
  const detail = { ok, errors, balance, content, answers, coach };
  await logRun("explain", startedAt, ok, detail);
  return NextResponse.json(detail, { status: ok ? 200 : 502 });
}
