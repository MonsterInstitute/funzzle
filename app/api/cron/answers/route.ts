import { NextResponse } from "next/server";
import { runAnswersCron } from "@/lib/cron/answers";
import { logRun } from "@/lib/cron/runLog";
import { isCronRequest } from "@/lib/secret";

/**
 * Answers cron (lib/cron/answers.ts): a Cloudflare Cron Trigger calls this
 * in-process (wrangler.jsonc -> worker.ts) with Authorization: Bearer
 * $CRON_SECRET. Non-2xx means a failed step; worker.ts then emails an alert.
 */

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = new Date().toISOString();
  try {
    const run = await runAnswersCron();
    await logRun("answers", startedAt, run.ok, run);
    return NextResponse.json(run, { status: run.ok ? 200 : 502 });
  } catch (err) {
    const error = (err as Error).message;
    console.error(`answers cron failed: ${error}`);
    await logRun("answers", startedAt, false, { error });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
