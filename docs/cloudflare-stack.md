# The Cloudflare stack (reusable pattern)

How funzzle.com runs entirely on one Cloudflare account: Next.js on Workers
(OpenNext), D1 for data, Cron Triggers for every scheduled job, Analytics
Engine for events, Email Routing for alerts. No Supabase, no Vercel, no
GitHub-scheduled jobs. Copy this layout for another site; the file names
below are the ones to copy.

## Pieces and what each costs

One **Workers Paid** plan ($5/month) covers the whole account; every site on it
shares the included amounts. Prices checked 2026-10-24
(developers.cloudflare.com → Workers / D1 / Analytics Engine pricing).

| Piece | Used for | Included per month (Paid) | Over that | Free plan |
|---|---|---|---|---|
| Workers | the site (OpenNext), API routes, crons | 10M requests, 30M CPU ms | $0.30/M requests, $0.02/M CPU ms | 100k requests/day, 10 ms CPU per request |
| Static assets | `_next/static`, images | unlimited, free | – | same |
| R2 | ISR page cache (OpenNext) | 10 GB, 1M Class A, 10M Class B | $0.015/GB, $4.50/M A, $0.36/M B | same free tier |
| D1 | app data + OpenNext tag cache | 25B rows read, 50M rows written, 5 GB | $0.001/M read, $1/M written, $0.75/GB | 5M read/day, 100k written/day, 5 GB |
| Durable Objects | OpenNext revalidation queue | 1M requests, 400k GB-s | $0.15/M, $12.50/M GB-s | 100k/day |
| Analytics Engine | product events | 10M data points, 1M queries | $0.25/M points, $1/M queries (not billed yet) | 100k points/day, 10k queries/day |
| Cron Triggers | every scheduled job | free (counted as requests + CPU) | – | 5 per account |
| Email Routing | alert emails, inbound forwarding | free | – | free |

What funzzle uses (week of 2026-10-17, ×30/7): ~250k Worker requests, ~10.5M
CPU ms, ~40k DO requests, ~145k R2 operations, 0.6 GB R2, ~0.6M D1 rows read,
a few thousand D1 rows written, <1 MB D1 storage: about **$0.44/month at list
price with no included amount**, i.e. well inside the shared plan. DeepSeek
is the only other bill (llm_usage table). The weekly report's Cost section
(scripts/lib/cloudflare-report.mjs) recomputes all of this every Monday,
including account-wide totals against the included amounts.

Rules that keep it cheap:

- **Events never go to D1.** D1 writes are the most expensive unit ($1/M); an
  event per page view would dominate the bill. Use Analytics Engine.
- **Pages are ISR, not per-request renders.** `revalidate` long (6 h) plus
  on-demand `revalidatePath()` from the crons; dynamic params validated before
  any query. R2 + the regional cache serve repeat views.
- **Every DB call has a deadline** (lib/db.ts, 8 s) and **every data-load error
  throws**, so an outage is never cached as a 404 or a fallback page.
- **No LLM calls at request time.** Crons write LLM text ahead of time
  (coach_explanations, answers.summary); requests read rows.

## Files

| File | What it is |
|---|---|
| `wrangler.jsonc` | Worker config: bindings, routes, cron schedules, CPU limit |
| `worker.ts` | entry: host handling, `scheduled()` → cron routes, failure alerts |
| `open-next.config.ts` | ISR cache: R2 + regional cache, D1 tag cache, DO queue (with deadlines) |
| `migrations/NNNN_*.sql` | D1 schema, applied by the deploy workflow |
| `lib/db.ts` | `all` / `first` / `exec` / `batch` over the DB binding, with deadlines |
| `types/cloudflare-app.d.ts` | binding types the Next app sees |
| `lib/cron/*.ts`, `app/api/cron/*` | one module + one route per cron job |
| `scripts/lib/d1-rest.mjs` | D1 over REST for local scripts and the weekly report |
| `.github/workflows/deploy-cloudflare.yml` | migrations → build → deploy on push to main |
| `scripts/lib/cloudflare-report.mjs` | weekly analytics + cost section |

## Bindings (wrangler.jsonc)

```jsonc
"d1_databases": [
  // App data. "remote": next build and local dev read the production DB.
  { "binding": "DB", "database_name": "<site>-db", "database_id": "…", "migrations_dir": "migrations", "remote": true },
  // OpenNext tag cache (revalidatePath).
  { "binding": "NEXT_TAG_CACHE_D1", "database_name": "<site>-tags", "database_id": "…" }
],
"r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "<site>-opennext-cache" }],
"durable_objects": { "bindings": [{ "name": "NEXT_CACHE_DO_QUEUE", "class_name": "DOQueueHandler" }] },
"analytics_engine_datasets": [{ "binding": "EVENTS", "dataset": "<site>_events" }],
"send_email": [{ "name": "ALERT_EMAIL" }, { "name": "MAILER", "allowed_sender_addresses": ["puzzles@<site>"] }],
"vars": { "ALERT_EMAIL_TO": "hello@<site>", "ALERT_EMAIL_FROM": "alerts@<site>" },
"limits": { "cpu_ms": 60000 },
"triggers": { "crons": ["1 0 * * *", "5 2,3,6,14,22,23 * * *", "20 3,7,15,23 * * *", "0 13 * * *"] }
```

Secrets (`wrangler secret put NAME`): `CRON_SECRET`, `REVALIDATE_SECRET`,
`DEEPSEEK_API_KEY`, `ALERT_EMAIL_FALLBACK`, `VAPID_PRIVATE_JWK` (web push; the
public key is `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.production`). After changing bindings run
`npm run cf-typegen`, then add any binding the app reads to
`types/cloudflare-app.d.ts`.

Create the resources once:

```sh
npx wrangler d1 create <site>-db
npx wrangler d1 create <site>-tags
npx wrangler r2 bucket create <site>-opennext-cache
# Analytics Engine datasets are created by the first write.
```

## Schema migrations

- One file per change: `migrations/0002_add_x.sql`. Never edit an applied file.
- `npx wrangler d1 migrations create <site>-db add_x` makes the next file.
- The deploy workflow runs `wrangler d1 migrations apply <site>-db --remote`
  **before** building, so new code never meets an old schema. Applied files are
  tracked in the `d1_migrations` table and skipped.
- Make migrations additive (new tables/columns with defaults) so the code
  currently live keeps working between the migration and the deploy.

Postgres → SQLite notes from the Supabase move:

| Postgres | D1 / SQLite |
|---|---|
| `jsonb` | `TEXT` holding JSON; `JSON.stringify` on write, `JSON.parse` on read; `json_extract` in SQL |
| `timestamptz default now()` | `TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))` |
| `date` | `TEXT 'YYYY-MM-DD'` (sorts and compares correctly) |
| `boolean` | `INTEGER 0/1` |
| `uuid default gen_random_uuid()` | `TEXT`, set by the app with `crypto.randomUUID()` |
| `upsert(…, {onConflict, ignoreDuplicates})` | `INSERT … ON CONFLICT(cols) DO NOTHING` / `DO UPDATE SET c = excluded.c` |
| unique violation `23505` | `ON CONFLICT … DO NOTHING`, then `meta.changes === 0` means it existed |
| SQL function / RPC | inline SQL in the route (`GROUP BY`, `json_group_array`) |
| `width_bucket` | `CAST((x - lo) * n / (hi - lo) AS INTEGER) + 1`, clamped with `CASE` |

**D1 binds JS numbers as REAL**: integer division on bound parameters gives
fractions, so `CAST(… AS INTEGER)` where an integer is meant.

Copying data: `scripts/migrate-supabase-to-d1.mjs` (removed after the move;
see git history, commit before "Retire Supabase") upserts every row over the
REST API and then compares row counts and a content fingerprint per table. It
is idempotent: run it once, then again right before the deploy that switches
reads, to pick up rows written in between.

Before deleting the old project, back up every table (all schemas) via the
Supabase Management API SQL endpoint to a gitignored `backups/` folder and a
private R2 bucket (`funzzle-backups`), export twice and compare hashes, and
check every row exists in D1.

## Cron layout

All schedules are UTC. Each schedule maps to one route in `worker.ts`
(`CRON_ROUTES`); the Worker calls the route in-process with
`Authorization: Bearer $CRON_SECRET`, and the route fails closed without it.

| Cron | Route | Job |
|---|---|---|
| `1 0 * * *` | `/api/revalidate` | rollover: revalidate today's pages after midnight UTC |
| `5 2,3,6,14,22,23 * * *` | `/api/cron/answers` | fetch missing NYT answers (today + tomorrow), store daily puzzles |
| `20 3,7,15,23 * * *` | `/api/cron/explain` | DeepSeek: answer explanations, Sudoku coach text, and the daily content for Groups, Mini Crossword, Word Hunt, Word Search and Crossword (clues/categories/themes, validated in code; each falls back to a hand-written bank) |
| `0 13 * * *` | `/api/cron/reminders` | daily reminder: email (Email Sending) + web push (VAPID, `lib/webpush.ts`), one per channel per day |

Every run inserts a row into `cron_runs` (job, started_at, finished_at, ok,
detail), which is how to check that a schedule fires:

```sh
npx wrangler d1 execute <site>-db --remote --command \
  "SELECT job, started_at, ok FROM cron_runs ORDER BY id DESC LIMIT 20"
```

**Heavy generation runs offline, not in a Worker.** A Worker has 128 MB of
memory. 2- and 4-suit Spider deals need 250 MB–1 GB to find and prove, so
`scripts/pregenerate-spider.ts` stores a year of them in D1 from a laptop;
the answers cron fails (and alerts) when fewer than 30 days remain. Anything
cheap (Sudoku, Klondike, Minesweeper, word games…) is generated by
`ensureDailyPuzzles` in the answers cron, a day ahead.

**Failure alerts.** A non-2xx route response, or a throw, makes `scheduled()`
email `ALERT_EMAIL_TO` with the response body, then throw (so the dashboard
shows the run as failed too). Email Routing delivers only to *verified
destination addresses*: add the address under Email → Email Routing →
Destination addresses (or `POST /accounts/:id/email/routing/addresses`) and
click the link Cloudflare sends. Until it's verified, alerts go to
`ALERT_EMAIL_FALLBACK`, an address that already is. Once the domain is
onboarded to **Email Sending** (`POST /zones/:id/email/sending/subdomains
{"name": "<site>"}`, which adds SPF/DKIM on `cf-bounce.<site>` and a DMARC
record; Workers Paid), the same binding sends to any address — that's what
the reminder emails use, with a one-click `List-Unsubscribe` header.

Routes should report partial failure honestly: a run that wrote some rows but
missed others returns 502 with the details, not 200.

## Deploy

Push to `main` → `.github/workflows/deploy-cloudflare.yml`:

1. `wrangler d1 migrations apply <site>-db --remote`
2. `opennextjs-cloudflare build` (`next build` prerenders from D1 through the
   remote binding) + `scripts/strip-bundled-env.mjs` (keeps local secrets out
   of the bundle)
3. `opennextjs-cloudflare deploy`

Repository secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts, Workers Routes,
Workers R2, D1: Edit) and `CLOUDFLARE_ACCOUNT_ID`. Docs, tests, reports and
design files don't deploy (`paths-ignore`). Batch changes; each deploy
rebuilds the ISR cache.

GitHub Actions keeps only tests, deploys and the weekly report. The report
needs `CLOUDFLARE_ANALYTICS_TOKEN` (Account Analytics: Read, D1: Read) for
its Cloudflare sections.

## Local development

- `npm run dev`: Next dev server; `getCloudflareContext` proxies bindings,
  and the DB binding is **remote**, so local dev reads and writes production
  data. E2E tests stub the write endpoints (e2e/helpers.ts).
- `npm run cf:preview`: build and run the real Worker in workerd on
  localhost. Put test secrets in `.dev.vars` (gitignored).
- Scripts outside the Worker use `scripts/lib/d1-rest.mjs`, which uses
  `CLOUDFLARE_API_TOKEN` or the local `wrangler login`.

## Analytics Engine layout

`app/api/events` writes one data point per event:
`index1 = event`, `blob1 event, blob2 game, blob3 client id, blob4 referral
source, blob5 country, blob6 props JSON`, `double1 = 1`, `double2 = days
since first visit` (visit events). Query with the SQL API
(`POST /accounts/:id/analytics_engine/sql`), weighting counts by
`SUM(_sample_interval)`. Data is kept for 3 months.
