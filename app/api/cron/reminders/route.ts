import { NextResponse } from "next/server";
import { runReminders } from "@/lib/cron/reminders";
import { logRun } from "@/lib/cron/runLog";
import { isCronRequest } from "@/lib/secret";

/** Reminders cron ("0 13 * * *", worker.ts): lib/cron/reminders.ts. */

export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = new Date().toISOString();
  try {
    const run = await runReminders();
    await logRun("reminders", startedAt, run.ok, run);
    return NextResponse.json(run, { status: run.ok ? 200 : 502 });
  } catch (err) {
    const error = (err as Error).message;
    await logRun("reminders", startedAt, false, { error });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
