import { sendAlertEmail } from "@/lib/alertEmail";
import { exec, first } from "@/lib/db";
import { deepSeekBalance } from "@/lib/deepseek";

/**
 * DeepSeek balance check, run by the explain cron: stores today's balance and
 * the last 7 days' spend (llm_usage) in deepseek_balance, and emails a warning
 * at most once a day when the balance would run out within ALERT_DAYS.
 */

export const ALERT_DAYS = 30;
/** Rough CNY→USD rate, only used if the account holds CNY (llm_usage is in USD). */
const CNY_PER_USD = 7.1;

export interface BalanceCheck {
  currency: string;
  total: number;
  usd: number;
  spend7dUsd: number;
  daysLeft: number | null;
  alerted: boolean;
}

/** Days until `usd` runs out at `dailyUsd` a day (null when nothing is being spent). */
export function daysLeft(usd: number, dailyUsd: number): number | null {
  return dailyUsd > 0 ? usd / dailyUsd : null;
}

export async function checkDeepSeekBalance(now = new Date()): Promise<BalanceCheck> {
  const b = await deepSeekBalance();
  const usd = b.currency === "CNY" ? b.total / CNY_PER_USD : b.total;
  const day = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const spend = await first<{ usd: number | null }>("SELECT sum(cost_usd) AS usd FROM llm_usage WHERE day >= ? AND day < ?", since, day);
  const spend7dUsd = Number(spend?.usd ?? 0);
  const left = daysLeft(usd, spend7dUsd / 7);
  const prior = await first<{ alerted_at: string | null }>("SELECT alerted_at FROM deepseek_balance WHERE day = ?", day);

  let alerted = Boolean(prior?.alerted_at);
  const low = !b.isAvailable || (left !== null && left < ALERT_DAYS);
  if (low && !alerted) {
    alerted = await sendAlertEmail(
      `[funzzle] DeepSeek balance low: ${b.total.toFixed(2)} ${b.currency}`,
      [
        `DeepSeek balance: ${b.total.toFixed(2)} ${b.currency} (granted ${b.granted.toFixed(2)}, topped up ${b.toppedUp.toFixed(2)}).`,
        `Spend over the last 7 days: $${spend7dUsd.toFixed(2)} (about $${(spend7dUsd / 7).toFixed(3)}/day).`,
        left === null ? "" : `At that rate it runs out in about ${Math.floor(left)} days.`,
        b.isAvailable ? "" : "DeepSeek reports the account as NOT available for API calls.",
        "",
        "Top up at https://platform.deepseek.com/top_up. Until then the daily content jobs fall back to the hand-written banks.",
      ].filter(Boolean).join("\n")
    );
  }
  await exec(
    `INSERT INTO deepseek_balance (day, checked_at, currency, total, granted, topped_up, is_available, spend_7d_usd, days_left, alerted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (day) DO UPDATE SET checked_at = excluded.checked_at, currency = excluded.currency, total = excluded.total,
       granted = excluded.granted, topped_up = excluded.topped_up, is_available = excluded.is_available,
       spend_7d_usd = excluded.spend_7d_usd, days_left = excluded.days_left,
       alerted_at = COALESCE(deepseek_balance.alerted_at, excluded.alerted_at)`,
    day, now.toISOString(), b.currency, b.total, b.granted, b.toppedUp, b.isAvailable ? 1 : 0, spend7dUsd, left, alerted ? now.toISOString() : null
  );
  return { currency: b.currency, total: b.total, usd, spend7dUsd, daysLeft: left, alerted };
}
