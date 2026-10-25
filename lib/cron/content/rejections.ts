/**
 * Why the LLM content jobs rejected a reply, in a form short enough for
 * cron_runs.detail: each job returns one "rejected" line per date it gave up
 * on (or that needed retries), next to the rows it wrote.
 */

const MAX_REASON = 160;
const MAX_LINE = 600;

/** One reason, trimmed to a readable length. */
export function clip(reason: string, max = MAX_REASON): string {
  const r = reason.replace(/\s+/g, " ").trim();
  return r.length > max ? `${r.slice(0, max - 1)}…` : r;
}

/** "word-hunt 2026-10-25 rejected 2/4: 1) …; 2) …" (empty when nothing was rejected). */
export function rejectionLine(game: string, date: string, reasons: string[], calls: number, ok: boolean): string {
  if (!reasons.length) return "";
  const head = `${game} ${date} ${ok ? "ok after" : "failed,"} ${reasons.length} rejected (${calls} calls): `;
  const body = reasons.map((r, i) => `${i + 1}) ${clip(r)}`).join("; ");
  return clip(head + body, MAX_LINE);
}

/** True for a line written by rejectionLine (the cron only revalidates pages for stored rows). */
export const isRejectionLine = (line: string) => / (ok after|failed,) \d+ rejected \(/.test(line);
