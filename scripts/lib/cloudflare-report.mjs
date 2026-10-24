/**
 * Weekly report sections from Cloudflare (scripts/gsc-report.mjs):
 *
 *   ## Product analytics — Workers Analytics Engine dataset funzzle_events
 *      (app/api/events): visits by source incl. AI referrals, games per
 *      visit, D1/D7/D30 return rates, challenges and leagues.
 *   ## Cost — Workers, Durable Objects, R2, D1, Analytics Engine (GraphQL
 *      Analytics API) and DeepSeek (llm_usage in D1), as a monthly estimate
 *      against the Workers Paid plan.
 *
 * Token: CLOUDFLARE_API_TOKEN with Account Analytics: Read and D1: Read (or a
 * local `wrangler login`). No dependencies, like the rest of the report.
 */
import { cf, cloudflareAccountId, d1 } from "./d1-rest.mjs";

const SCRIPT = "funzzle";
const BUCKET = "funzzle-opennext-cache";
const DATABASES = { "550335eb-16b4-4fcd-a469-6e3f3a79a78a": "funzzle-db", "e283a45f-9de6-474f-a58f-3da9778e1440": "funzzle-tags" };
const DAYS = 7;
const MONTH = 30 / DAYS;

/** Workers Paid list prices (developers.cloudflare.com, checked 2026-10-24). */
const PLAN = {
  base: 5,
  workerRequests: { included: 10e6, per: 1e6, price: 0.3 },
  workerCpuMs: { included: 30e6, per: 1e6, price: 0.02 },
  doRequests: { included: 1e6, per: 1e6, price: 0.15 },
  d1RowsRead: { included: 25e9, per: 1e6, price: 0.001 },
  d1RowsWritten: { included: 50e6, per: 1e6, price: 1 },
  d1StorageGb: { included: 5, per: 1, price: 0.75 },
  r2StorageGb: { included: 10, per: 1, price: 0.015 },
  r2ClassA: { included: 1e6, per: 1e6, price: 4.5 },
  r2ClassB: { included: 10e6, per: 1e6, price: 0.36 },
  aeWrites: { included: 10e6, per: 1e6, price: 0.25 },
};
const CLASS_B = new Set(["GetObject", "HeadObject", "HeadBucket", "UsageSummary", "GetBucketEncryption", "GetBucketLocation", "GetBucketCors", "GetBucketLifecycleConfiguration"]);

const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const usd = (n) => `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;
const pct = (a, b) => (b > 0 ? `${((100 * a) / b).toFixed(1)}%` : "–");
const isoDay = (d) => d.toISOString().slice(0, 10);
const table = (headers, rows) => [`| ${headers.join(" | ")} |`, `|${headers.map((_, i) => (i ? "---:" : "---")).join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)];

async function graphql(query, variables) {
  const body = await cf("/graphql", { method: "POST", body: JSON.stringify({ query, variables }) });
  if (body.errors?.length) throw new Error(`GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  return body.data.viewer.accounts[0];
}

async function aeSql(sql) {
  const acc = await cloudflareAccountId();
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/analytics_engine/sql`, {
    method: "POST",
    headers: { authorization: `Bearer ${(await import("./d1-rest.mjs")).cloudflareToken()}` },
    body: `${sql} FORMAT JSON`,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Analytics Engine SQL ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text).data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, /^\d+(\.\d+)?$/.test(v) ? Number(v) : v])));
}

/** Weighted count of events (Analytics Engine samples at high volume). */
const N = "SUM(_sample_interval)";
const windowSql = (from, to) => `timestamp >= toDateTime('${from} 00:00:00') AND timestamp < toDateTime('${to} 00:00:00')`;

async function productAnalytics(end) {
  const start = isoDay(new Date(Date.parse(end) - DAYS * 86_400_000));
  const inWindow = windowSql(start, end);
  const out = [`## Product analytics — ${start} to ${end} (exclusive)`, ""];

  const events = await aeSql(`SELECT blob1 AS event, ${N} AS n FROM funzzle_events WHERE ${inWindow} GROUP BY event ORDER BY n DESC`);
  const count = (e) => events.find((r) => r.event === e)?.n ?? 0;
  const visits = count("visit");
  out.push("Visits are one per browser per UTC day (lib/games/kit/analytics.ts).", "");
  out.push(
    ...table(
      ["Metric", "Value"],
      [
        ["Visits (browser-days)", fmt(visits)],
        ["Games started", fmt(count("game_start"))],
        ["Games completed", fmt(count("game_complete"))],
        ["Games per visit", visits ? fmt(count("game_start") / visits, 2) : "–"],
        ["Hints used", fmt(count("hint_used"))],
        ["Shares", fmt(count("share"))],
        ["Challenge links created", fmt(count("challenge_create"))],
        ["Challenges completed", fmt(count("challenge_complete"))],
        ["Leagues created", fmt(count("league_create"))],
        ["League joins", fmt(count("league_join"))],
        ["Reminder opt-ins", fmt(count("reminder_optin"))],
        ["Rewarded ads watched", fmt(count("rewarded_ad"))],
      ]
    ),
    ""
  );

  const sources = await aeSql(`SELECT blob4 AS source, ${N} AS n FROM funzzle_events WHERE blob1 = 'visit' AND ${inWindow} GROUP BY source ORDER BY n DESC`);
  const ai = sources.filter((s) => String(s.source).startsWith("ai:"));
  const aiTotal = ai.reduce((a, s) => a + s.n, 0);
  out.push("### Traffic sources", "", `**AI referral** (ChatGPT, Perplexity, Claude, Copilot, Gemini): ${fmt(aiTotal)} visits, ${pct(aiTotal, visits)} of all.`, "");
  out.push(...table(["Source", "Visits", "Share"], sources.map((s) => [s.source, fmt(s.n), pct(s.n, visits)])), "");

  // Exact-day return rates: visitors seen for the first time k days before a
  // visit in the window, over the new visitors of the matching earlier window.
  out.push("### Return rate", "", "Share of new visitors who came back exactly 1, 7 or 30 days later (rolling 7-day cohorts).", "");
  const rows = [];
  for (const k of [1, 7, 30]) {
    const cohortStart = isoDay(new Date(Date.parse(start) - k * 86_400_000));
    const cohortEnd = isoDay(new Date(Date.parse(end) - k * 86_400_000));
    const [[ret], [fresh]] = await Promise.all([
      aeSql(`SELECT ${N} AS n FROM funzzle_events WHERE blob1 = 'visit' AND double2 = ${k} AND ${inWindow}`),
      aeSql(`SELECT ${N} AS n FROM funzzle_events WHERE blob1 = 'visit' AND double2 = 0 AND ${windowSql(cohortStart, cohortEnd)}`),
    ]);
    rows.push([`D${k}`, fmt(fresh?.n ?? 0), fmt(ret?.n ?? 0), pct(ret?.n ?? 0, fresh?.n ?? 0)]);
  }
  out.push(...table(["Return", "New visitors (cohort)", "Returned", "Rate"], rows), "");
  out.push("Visit tracking started 2026-10-24, so D7 and D30 fill in over the following weeks.", "");
  return { lines: out, visits, aeWrites: events.reduce((a, r) => a + r.n, 0) };
}

const overage = (used, p) => (Math.max(0, used - p.included) / p.per) * p.price;
const standalone = (used, p) => (used / p.per) * p.price;

async function cost(end, visits, aeWrites) {
  const start = isoDay(new Date(Date.parse(end) - DAYS * 86_400_000));
  const acc = await cloudflareAccountId();
  const a = await graphql(
    `query($a: String!, $s: Time!, $e: Time!, $sd: Date!, $ed: Date!) { viewer { accounts(filter: {accountTag: $a}) {
      site: workersInvocationsAdaptive(limit: 10, filter: {datetime_geq: $s, datetime_lt: $e, scriptName: "${SCRIPT}"}) { sum { requests cpuTimeUs errors } }
      all: workersInvocationsAdaptive(limit: 10, filter: {datetime_geq: $s, datetime_lt: $e}) { sum { requests cpuTimeUs } }
      doSite: durableObjectsInvocationsAdaptiveGroups(limit: 10, filter: {date_geq: $sd, date_lt: $ed, scriptName: "${SCRIPT}"}) { sum { requests } }
      r2ops: r2OperationsAdaptiveGroups(limit: 50, filter: {datetime_geq: $s, datetime_lt: $e, bucketName: "${BUCKET}"}) { sum { requests } dimensions { actionType } }
      r2size: r2StorageAdaptiveGroups(limit: 1, filter: {datetime_geq: $s, datetime_lt: $e, bucketName: "${BUCKET}"}) { max { payloadSize objectCount } }
      d1: d1AnalyticsAdaptiveGroups(limit: 100, filter: {date_geq: $sd, date_lt: $ed}) { sum { rowsRead rowsWritten } dimensions { databaseId } }
      d1size: d1StorageAdaptiveGroups(limit: 100, filter: {date_geq: $sd, date_lt: $ed}) { max { databaseSizeBytes } dimensions { databaseId } }
    } } }`,
    { a: acc, s: `${start}T00:00:00Z`, e: `${end}T00:00:00Z`, sd: start, ed: end }
  );
  const sum = (rows, f) => rows.reduce((t, r) => t + (f(r) ?? 0), 0);
  const req = sum(a.site, (r) => r.sum.requests) * MONTH;
  const cpuMs = (sum(a.site, (r) => r.sum.cpuTimeUs) / 1000) * MONTH;
  const accReq = sum(a.all, (r) => r.sum.requests) * MONTH;
  const accCpu = (sum(a.all, (r) => r.sum.cpuTimeUs) / 1000) * MONTH;
  const doReq = sum(a.doSite, (r) => r.sum.requests) * MONTH;
  const classB = sum(a.r2ops.filter((r) => CLASS_B.has(r.dimensions.actionType)), (r) => r.sum.requests) * MONTH;
  const classA = sum(a.r2ops.filter((r) => !CLASS_B.has(r.dimensions.actionType)), (r) => r.sum.requests) * MONTH;
  const r2Gb = (a.r2size[0]?.max.payloadSize ?? 0) / 1e9;
  const mine = a.d1.filter((r) => DATABASES[r.dimensions.databaseId]);
  const rowsRead = sum(mine, (r) => r.sum.rowsRead) * MONTH;
  const rowsWritten = sum(mine, (r) => r.sum.rowsWritten) * MONTH;
  const d1Gb = sum(a.d1size.filter((r) => DATABASES[r.dimensions.databaseId]), (r) => r.max.databaseSizeBytes) / 1e9;
  const accRowsRead = sum(a.d1, (r) => r.sum.rowsRead) * MONTH;
  const accRowsWritten = sum(a.d1, (r) => r.sum.rowsWritten) * MONTH;
  const aeMonth = aeWrites * MONTH;

  const llm = await d1(
    "SELECT job, sum(prompt_tokens) AS prompt, sum(cache_hit_tokens) AS hit, sum(completion_tokens) AS completion, sum(cost_usd) AS usd, count(*) AS calls FROM llm_usage WHERE day >= ? AND day < ? GROUP BY job ORDER BY usd DESC",
    [start, end]
  );
  const llmUsd = sum(llm, (r) => r.usd) * MONTH;

  const lines = [
    `## Cost — monthly estimate from ${start} to ${end} (×${MONTH.toFixed(2)})`,
    "",
    "Workers Paid is one $5/month plan for the whole account (every site on it shares the included amounts). " +
      "\"Standalone\" is what funzzle's usage would cost at list price with no included amount: its marginal cost once the shared quota is used up.",
    "",
    ...table(
      ["Resource", "funzzle / month", "Included (account)", "Standalone $"],
      [
        ["Workers requests", fmt(req), fmt(PLAN.workerRequests.included), usd(standalone(req, PLAN.workerRequests))],
        ["Workers CPU ms", fmt(cpuMs), fmt(PLAN.workerCpuMs.included), usd(standalone(cpuMs, PLAN.workerCpuMs))],
        ["Durable Object requests", fmt(doReq), fmt(PLAN.doRequests.included), usd(standalone(doReq, PLAN.doRequests))],
        ["R2 Class A ops", fmt(classA), fmt(PLAN.r2ClassA.included), usd(standalone(classA, PLAN.r2ClassA))],
        ["R2 Class B ops", fmt(classB), fmt(PLAN.r2ClassB.included), usd(standalone(classB, PLAN.r2ClassB))],
        ["R2 storage GB", fmt(r2Gb, 2), fmt(PLAN.r2StorageGb.included), usd(standalone(r2Gb, PLAN.r2StorageGb))],
        ["D1 rows read", fmt(rowsRead), fmt(PLAN.d1RowsRead.included), usd(standalone(rowsRead, PLAN.d1RowsRead))],
        ["D1 rows written", fmt(rowsWritten), fmt(PLAN.d1RowsWritten.included), usd(standalone(rowsWritten, PLAN.d1RowsWritten))],
        ["D1 storage GB", fmt(d1Gb, 3), fmt(PLAN.d1StorageGb.included), usd(standalone(d1Gb, PLAN.d1StorageGb))],
        ["Analytics Engine writes", fmt(aeMonth), fmt(PLAN.aeWrites.included), usd(standalone(aeMonth, PLAN.aeWrites))],
        ["DeepSeek", `${fmt(sum(llm, (r) => r.calls) * MONTH)} calls`, "–", usd(llmUsd)],
      ]
    ),
    "",
  ];
  const cfStandalone =
    standalone(req, PLAN.workerRequests) +
    standalone(cpuMs, PLAN.workerCpuMs) +
    standalone(doReq, PLAN.doRequests) +
    standalone(classA, PLAN.r2ClassA) +
    standalone(classB, PLAN.r2ClassB) +
    standalone(r2Gb, PLAN.r2StorageGb) +
    standalone(rowsRead, PLAN.d1RowsRead) +
    standalone(rowsWritten, PLAN.d1RowsWritten) +
    standalone(d1Gb, PLAN.d1StorageGb) +
    standalone(aeMonth, PLAN.aeWrites);
  const accOver =
    overage(accReq, PLAN.workerRequests) + overage(accCpu, PLAN.workerCpuMs) + overage(accRowsRead, PLAN.d1RowsRead) + overage(accRowsWritten, PLAN.d1RowsWritten);
  const total = cfStandalone + llmUsd;
  const monthVisits = visits * MONTH;
  lines.push(
    `**Estimated monthly total for funzzle: ${usd(total)}** (Cloudflare ${usd(cfStandalone)} standalone + DeepSeek ${usd(llmUsd)}), ` +
      `for ${fmt(req)} Worker requests${monthVisits ? ` and ${fmt(monthVisits)} visits — ${usd((1000 * total) / monthVisits)} per 1,000 visits` : ""}.`,
    "",
    `Account-wide this month (all sites): ${fmt(accReq)} requests, ${fmt(accCpu)} CPU ms, ${fmt(accRowsRead)} D1 rows read, ${fmt(accRowsWritten)} D1 rows written ` +
      `→ estimated overage beyond the $${PLAN.base} plan: ${usd(accOver)}.`,
    ""
  );
  if (llm.length) {
    lines.push("<details><summary>DeepSeek by job (7 days)</summary>", "", ...table(["Job", "Calls", "Prompt tokens", "Cache hits", "Output tokens", "$"], llm.map((r) => [r.job, fmt(r.calls), fmt(r.prompt), fmt(r.hit), fmt(r.completion), usd(r.usd)])), "", "</details>", "");
  }
  return lines;
}

/** Markdown lines for both sections; a failure becomes a note, not a failed report. */
export async function cloudflareSections(end = isoDay(new Date())) {
  const out = [];
  let visits = 0;
  let aeWrites = 0;
  try {
    const pa = await productAnalytics(end);
    out.push(...pa.lines);
    visits = pa.visits;
    aeWrites = pa.aeWrites;
  } catch (err) {
    out.push("## Product analytics", "", `Couldn't read Analytics Engine: ${err.message}`, "");
  }
  try {
    out.push(...(await cost(end, visits, aeWrites)));
  } catch (err) {
    out.push("## Cost", "", `Couldn't read Cloudflare usage: ${err.message}`, "");
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log((await cloudflareSections(process.argv[2])).join("\n"));
}
