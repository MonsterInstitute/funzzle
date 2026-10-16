import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// ISR pages (today's pages, answer pages, sitemap) keep their cache in R2,
// fronted by the per-colo regional cache. revalidatePath() — the midnight-UTC
// rollover and the answers cron / Daily Content workflow — needs the D1 tag
// cache; time-based regeneration (revalidate = 21600) goes through the
// Durable Object queue.
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  queue: doQueue,
  tagCache: d1NextTagCache,
});
