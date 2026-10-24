import { exec, nowIso } from "@/lib/db";

/**
 * Record a cron job run in cron_runs (job, start, end, ok, detail): the proof
 * that each schedule fires in production, and what it did. A failure to log
 * never fails the job itself.
 */
export async function logRun(job: string, startedAt: string, ok: boolean, detail: unknown): Promise<void> {
  try {
    await exec(
      "INSERT INTO cron_runs (job, cron, started_at, finished_at, ok, detail) VALUES (?, ?, ?, ?, ?, ?)",
      job,
      null,
      startedAt,
      nowIso(),
      ok ? 1 : 0,
      JSON.stringify(detail).slice(0, 4000)
    );
  } catch (err) {
    console.error(`cron_runs write (${job}): ${(err as Error).message}`);
  }
}
