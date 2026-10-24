// Google Search Console report for funzzle.com.
//
// Pulls clicks, impressions, CTR and position for the last 7, 28 and 90 days —
// totals, by query, by page and by URL pattern — flags pages with impressions
// but no clicks, and sitemap pages with no impressions at all. Writes Markdown
// to reports/gsc/YYYY-MM-DD.md (or --out=PATH, or --out=- for stdout).
//
// Credentials (service account with access to the Search Console property):
//   GSC_SERVICE_ACCOUNT_JSON      the key JSON itself (GitHub Actions secret), or
//   GSC_SERVICE_ACCOUNT_KEY_FILE  path to the key file (.env.local)
// GSC_SITE_URL picks the property (e.g. sc-domain:funzzle.com); without it the
// script uses whichever funzzle.com property the service account can see.
//
// No dependencies: signs the OAuth JWT with node:crypto.
import { createSign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SITEMAP_URL = process.env.SITEMAP_URL || "https://www.funzzle.com/sitemap.xml";
const CANONICAL_HOST = "www.funzzle.com";
const RANGES = [7, 28, 90];
// Search Console data settles ~2-3 days after the fact; end windows there so
// weekly reports compare like with like.
const LAG_DAYS = 3;
const TOP_N = 50;
const FETCH_TIMEOUT_MS = 30_000;

// Order matters: first match wins.
const GROUPS = [
  ["answers", /^\/(wordle-answer|connections-answers|strands-answers|quordle-answers|letter-boxed-answers|nerdle-answer|worldle-answer|nyt-crossword-answers)(\/|$)/],
  ["clue", /^\/clue(\/|$)/],
  ["country", /^\/country(\/|$)/],
  ["equation", /^\/equation(\/|$)/],
  ["word", /^\/word(\/|$)/],
  ["games", /^\/play(\/|$)/],
  ["blog", /^\/blog(\/|$)/],
  ["landing", /^\/(|free-nyt-games-alternative|nyt-mini-crossword-free|wordle-free|free-crossword-puzzle-daily)$/],
];

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function fetchJson(url, init = {}, attempt = 1) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 2000 * attempt));
    return fetchJson(url, init, attempt + 1);
  }
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${url} → ${res.status}: ${body.slice(0, 500)}`);
  return JSON.parse(body);
}

function readServiceAccount() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON
    || (process.env.GSC_SERVICE_ACCOUNT_KEY_FILE && readFileSync(process.env.GSC_SERVICE_ACCOUNT_KEY_FILE, "utf8"));
  if (!raw) throw new Error("Set GSC_SERVICE_ACCOUNT_JSON or GSC_SERVICE_ACCOUNT_KEY_FILE");
  return JSON.parse(raw);
}

async function getAccessToken(sa) {
  const b64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const { access_token } = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  return access_token;
}

async function pickSite(token, saEmail) {
  const { siteEntry = [] } = await fetchJson("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { authorization: `Bearer ${token}` },
  });
  const usable = siteEntry.filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl);
  const wanted = process.env.GSC_SITE_URL;
  if (wanted) {
    if (!usable.includes(wanted)) throw new Error(`${saEmail} has no access to ${wanted} (sees: ${usable.join(", ") || "nothing"})`);
    return wanted;
  }
  const site = ["sc-domain:funzzle.com", "https://www.funzzle.com/", "https://funzzle.com/"].find((s) => usable.includes(s))
    || usable.find((s) => s.includes("funzzle.com"));
  if (!site) throw new Error(`${saEmail} can't see any funzzle.com property yet — add it as a user in Search Console`);
  return site;
}

async function query(token, site, body) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const rows = [];
  for (let startRow = 0; ; startRow += 25000) {
    const res = await fetchJson(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ...body, rowLimit: 25000, startRow }),
    });
    rows.push(...(res.rows || []));
    if (!res.rows || res.rows.length < 25000) return rows;
  }
}

async function sitemapPaths() {
  const res = await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${SITEMAP_URL} → ${res.status}`);
  return [...(await res.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => pathOf(m[1]));
}

// URL Inspection: quota is 2,000 calls/day and 600/minute per property.
// Inspect a random sample of each pattern's sitemap URLs (--inspect-sample=N),
// or every URL for the patterns in --inspect-all=answers,clue.
async function inspect(token, site, url) {
  const res = await fetchJson("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: site }),
  });
  return res.inspectionResult?.indexStatusResult || {};
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}

function sample(items, n) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

async function indexCoverage(token, site, listed, groupNames) {
  const sampleSize = Number(arg("inspect-sample") ?? 30);
  const all = new Set((arg("inspect-all") || "").split(",").filter(Boolean));
  const picked = groupNames.flatMap((g) => {
    const paths = listed.filter((p) => groupOf(p) === g);
    return (all.has(g) ? paths : sample(paths, sampleSize)).map((path) => ({ path, group: g, of: paths.length }));
  });
  const results = await mapLimit(picked, 5, async (p) => {
    try {
      return { ...p, ...(await inspect(token, site, `https://${CANONICAL_HOST}${p.path}`)) };
    } catch (err) {
      return { ...p, coverageState: `Inspection failed: ${err.message.slice(0, 80)}` };
    }
  });

  const states = [...new Set(results.map((r) => r.coverageState || "Unknown"))]
    .sort((a, b) => results.filter((r) => r.coverageState === b).length - results.filter((r) => r.coverageState === a).length);
  const lines = [
    `Google's index status for ${fmtInt(results.length)} sitemap URLs: ${all.size ? `every URL for ${[...all].join(", ")}, ` : ""}a random ${sampleSize} for each other pattern.`,
    "",
  ];
  const rows = groupNames.map((g) => {
    const rs = results.filter((r) => r.group === g);
    if (!rs.length) return null;
    const indexed = rs.filter((r) => r.verdict === "PASS").length;
    return [g, `${fmtInt(rs.length)} / ${fmtInt(rs[0].of)}`, fmtCtr(indexed / rs.length), ...states.map((st) => fmtInt(rs.filter((r) => (r.coverageState || "Unknown") === st).length))];
  }).filter(Boolean);
  lines.push(table(["Pattern", "Inspected / in sitemap", "Indexed", ...states], rows), "");
  lines.push(
    "<details><summary>Every inspected URL</summary>",
    "",
    table(["Page", "Pattern", "Coverage", "Last crawl", "Google canonical"],
      results.map((r) => [r.path, r.group, r.coverageState || "Unknown", r.lastCrawlTime?.slice(0, 10) || "–", r.googleCanonical && r.googleCanonical !== `https://${CANONICAL_HOST}${r.path}` ? r.googleCanonical : ""]), 5),
    "",
    "</details>",
  );
  return lines;
}

const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const pathOf = (url) => decodeURI(new URL(url).pathname).replace(/(.)\/$/, "$1");
const groupOf = (path) => GROUPS.find(([, re]) => re.test(path))?.[0] || "other";

const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
const fmtCtr = (c) => `${(c * 100).toFixed(1)}%`;
const fmtPos = (p) => (p ? p.toFixed(1) : "–");
const cell = (s) => String(s).replace(/\|/g, "\\|");

function aggregate(rows) {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  // Impression-weighted mean of per-page positions: close to, not identical
  // with, what Search Console shows for the group.
  const position = impressions ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : 0;
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position, pages: rows.length };
}

// Columns after the first `textCols` are numeric and right-aligned.
function table(headers, rows, textCols = 1) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map((h, i) => (i < textCols ? "---" : "---:")).join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
}

const metricCols = (r) => [fmtInt(r.clicks), fmtInt(r.impressions), fmtCtr(r.ctr), fmtPos(r.position)];

async function main() {
  loadEnvLocal();
  const sa = readServiceAccount();
  const token = await getAccessToken(sa);
  const site = await pickSite(token, sa.client_email);
  const endDate = isoDay(daysAgo(LAG_DAYS));

  const windows = [];
  for (const days of RANGES) {
    const body = { startDate: isoDay(daysAgo(LAG_DAYS + days - 1)), endDate, type: "web", dataState: "final" };
    const [totals, queries, pages] = await Promise.all([
      query(token, site, body),
      query(token, site, { ...body, dimensions: ["query"] }),
      query(token, site, { ...body, dimensions: ["page"] }),
    ]);
    // Google reports funzzle.com and www.funzzle.com URLs separately; merge
    // them by path, and count the non-canonical host so it can be tracked.
    const byPath = new Map();
    for (const r of pages) {
      const path = pathOf(r.keys[0]);
      byPath.set(path, [...(byPath.get(path) || []), r]);
    }
    const pageRows = [...byPath].map(([path, rows]) => ({ path, group: groupOf(path), ...aggregate(rows) }));
    const offHost = pages.filter((r) => new URL(r.keys[0]).host !== CANONICAL_HOST);
    windows.push({ days, startDate: body.startDate, totals: totals[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 }, queries, pages: pageRows, offHost });
  }

  const today = isoDay(new Date());
  const out = [];
  out.push(`# Search Console report — ${today}`, "");
  out.push(`Property \`${site}\`, web search, final data through ${endDate} (Search Console lags ~${LAG_DAYS} days).`, "");

  out.push("## Totals", "");
  out.push(table(["Window", "Clicks", "Impressions", "CTR", "Avg position", "Queries", "Pages"],
    windows.map((w) => [`${w.days}d (${w.startDate} → ${endDate})`, ...metricCols(w.totals), fmtInt(w.queries.length), fmtInt(w.pages.length)])), "");
  const off90 = windows.find((w) => w.days === 90).offHost;
  out.push(`Pages are merged by path. ${fmtInt(off90.length)} URLs in the 90-day data are on a host other than ${CANONICAL_HOST}${off90.length ? ` (${fmtInt(off90.reduce((s, r) => s + r.impressions, 0))} impressions)` : ""}.`, "");

  out.push("## By URL pattern", "");
  out.push("Position is the impression-weighted mean of page positions.", "");
  const groupNames = [...GROUPS.map(([g]) => g), "other"];
  for (const w of windows) {
    out.push(`### ${w.days} days`, "");
    const rows = groupNames
      .map((g) => ({ g, ...aggregate(w.pages.filter((p) => p.group === g)) }))
      .filter((r) => r.pages)
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
    out.push(table(["Pattern", "Clicks", "Impressions", "CTR", "Avg position", "Pages"], rows.map((r) => [r.g, ...metricCols(r), fmtInt(r.pages)])), "");
  }

  const byClicks = (a, b) => b.clicks - a.clicks || b.impressions - a.impressions;
  for (const w of windows) {
    out.push(`## Top ${TOP_N} queries — ${w.days} days`, "");
    out.push(table(["Query", "Clicks", "Impressions", "CTR", "Position"], [...w.queries].sort(byClicks).slice(0, TOP_N).map((r) => [r.keys[0], ...metricCols(r)])), "");
    out.push(`## Top ${TOP_N} pages — ${w.days} days`, "");
    out.push(table(["Page", "Pattern", "Clicks", "Impressions", "CTR", "Position"], [...w.pages].sort(byClicks).slice(0, TOP_N).map((r) => [r.path, r.group, ...metricCols(r)]), 2), "");
  }

  const w28 = windows.find((w) => w.days === 28);
  const zeroClick = w28.pages.filter((p) => p.impressions > 0 && p.clicks === 0).sort((a, b) => b.impressions - a.impressions);
  out.push("## Pages with impressions but 0 clicks — 28 days", "");
  out.push(`${fmtInt(zeroClick.length)} of ${fmtInt(w28.pages.length)} pages with impressions got no clicks. Highest-impression ${Math.min(TOP_N, zeroClick.length)}:`, "");
  out.push(table(["Page", "Pattern", "Impressions", "Position"], zeroClick.slice(0, TOP_N).map((r) => [r.path, r.group, fmtInt(r.impressions), fmtPos(r.position)]), 2), "");

  let listed = null;
  try {
    listed = [...new Set(await sitemapPaths())];
  } catch (err) {
    console.error(`Couldn't read the sitemap: ${err.message}`);
  }

  out.push("## Sitemap pages with no impressions — 90 days", "");
  if (listed) {
    const seen = new Set(windows.find((w) => w.days === 90).pages.map((p) => p.path));
    const unseen = listed.filter((p) => !seen.has(p));
    out.push(`${fmtInt(unseen.length)} of ${fmtInt(listed.length)} sitemap URLs had no impressions in 90 days.`, "");
    const counts = groupNames.map((g) => [g, listed.filter((p) => groupOf(p) === g).length, unseen.filter((p) => groupOf(p) === g).length]).filter(([, n]) => n);
    out.push(table(["Pattern", "In sitemap", "No impressions", "Share"], counts.map(([g, n, u]) => [g, fmtInt(n), fmtInt(u), fmtCtr(u / n)])), "");
    if (unseen.length) {
      out.push("<details><summary>All pages with no impressions</summary>", "", ...unseen.map((p) => `- ${p}`), "", "</details>", "");
    }
  } else {
    out.push("Couldn't read the sitemap.", "");
  }

  out.push("## Index coverage (URL Inspection)", "");
  if (listed) {
    out.push(...(await indexCoverage(token, site, listed, groupNames)), "");
  } else {
    out.push("Couldn't read the sitemap.", "");
  }

  const md = out.join("\n");
  const dest = arg("out") ?? `reports/gsc/${today}.md`;
  if (dest === "-") {
    process.stdout.write(md);
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, md);
    console.log(`Wrote ${dest}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
