/**
 * DeepSeek balance check: stores the day's balance, projects days left from
 * the last 7 days of llm_usage, and alerts at most once a day under 30 days.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = new DatabaseSync(":memory:");
db.exec(readFileSync("migrations/0001_init.sql", "utf8"));
db.exec(readFileSync("migrations/0003_deepseek_balance.sql", "utf8"));
const bind = (params: unknown[]) => params.map((p) => (p === undefined ? null : p)) as (string | number | null)[];
vi.mock("@/lib/db", () => ({
  exec: async (sql: string, ...params: unknown[]) => Number(db.prepare(sql).run(...bind(params)).changes),
  first: async (sql: string, ...params: unknown[]) => db.prepare(sql).get(...bind(params)) ?? null,
}));
const sent: string[] = [];
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail: async (subject: string) => (sent.push(subject), true) }));
let balance = "10.00";
vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ is_available: true, balance_infos: [{ currency: "USD", total_balance: balance, granted_balance: "0", topped_up_balance: balance }] })));
process.env.DEEPSEEK_API_KEY = "test";

const { checkDeepSeekBalance, daysLeft } = await import("@/lib/cron/deepseekBalance");
const now = new Date("2026-10-31T03:20:00Z");

function spend(perDay: number) {
  db.exec("DELETE FROM llm_usage");
  for (let i = 1; i <= 7; i++) {
    const day = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    db.prepare("INSERT INTO llm_usage (day, job, model, prompt_tokens, cache_hit_tokens, completion_tokens, cost_usd) VALUES (?, 'x', 'm', 0, 0, 0, ?)").run(day, perDay);
  }
}

describe("DeepSeek balance check", () => {
  beforeEach(() => {
    db.exec("DELETE FROM deepseek_balance");
    sent.length = 0;
  });

  it("projects days left and stays quiet with plenty of balance", async () => {
    spend(0.1);
    balance = "10.00";
    const r = await checkDeepSeekBalance(now);
    expect(r.spend7dUsd).toBeCloseTo(0.7);
    expect(r.daysLeft).toBeCloseTo(100);
    expect(sent).toEqual([]);
    expect(db.prepare("SELECT total, alerted_at FROM deepseek_balance").get()).toEqual({ total: 10, alerted_at: null });
  });

  it("alerts once a day when under 30 days remain", async () => {
    spend(0.5);
    balance = "5.00";
    expect((await checkDeepSeekBalance(now)).alerted).toBe(true);
    await checkDeepSeekBalance(new Date(now.getTime() + 4 * 3_600_000));
    expect(sent).toHaveLength(1);
    expect(daysLeft(5, 0)).toBeNull();
  });
});
