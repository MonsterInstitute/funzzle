import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import type { IncrementalCache, NextModeTagCache } from "@opennextjs/aws/types/overrides.js";

// ISR pages (today's pages, answer pages, sitemap) keep their cache in R2,
// fronted by the per-colo regional cache. revalidatePath() — the midnight-UTC
// rollover and the answers cron / Daily Content workflow — needs the D1 tag
// cache; time-based regeneration (revalidate = 21600) goes through the
// Durable Object queue.
//
// Deadlines: every cached page read awaits the D1 tag cache and R2, and
// neither call has a timeout of its own. When one stalls, every request in
// flight hangs with it — observed twice as bursts of requests waiting 60–90 s
// on ~10 ms of CPU until the client gave up (Workers analytics status
// clientDisconnected). Both backends already fail open on errors (a tag read
// error means "not revalidated", a cache read error means a miss, which
// renders the page fresh); these deadlines make a stall take that same path
// after a few seconds instead of hanging. Writes keep failing loudly.

const TAG_READ_MS = 3_000; // D1 tag lookups normally take a few ms
const CACHE_READ_MS = 5_000; // R2 / Cache API reads normally well under 1 s
const WRITE_MS = 15_000;

/** Resolve with `fallback` (logged) if `promise` hasn't settled within `ms`. */
function orFallback<T>(promise: Promise<T>, ms: number, fallback: T, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(JSON.stringify({ m: "cache-deadline", what, ms, fallback: String(fallback) }));
      resolve(fallback);
    }, ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/** Reject if `promise` hasn't settled within `ms`. */
function orThrow<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

const regional = withRegionalCache(r2IncrementalCache, { mode: "long-lived" });

const incrementalCache: IncrementalCache = {
  name: regional.name,
  get: (key, cacheType) => orFallback(regional.get(key, cacheType), CACHE_READ_MS, null, "incrementalCache.get"),
  // A cache write that can't finish only means the next request renders again.
  set: (key, value, cacheType) =>
    orFallback(regional.set(key, value, cacheType), WRITE_MS, undefined, "incrementalCache.set"),
  delete: (key) => orThrow(regional.delete(key), WRITE_MS, "incrementalCache.delete"),
};

const d1 = d1NextTagCache as NextModeTagCache;
const tagCache: NextModeTagCache = {
  mode: "nextMode",
  name: d1.name,
  getLastRevalidated: (tags) => orFallback(d1.getLastRevalidated(tags), TAG_READ_MS, 0, "tagCache.getLastRevalidated"),
  hasBeenRevalidated: (tags, lastModified) =>
    orFallback(d1.hasBeenRevalidated(tags, lastModified), TAG_READ_MS, false, "tagCache.hasBeenRevalidated"),
  isStale: d1.isStale
    ? (tags, lastModified) => orFallback(d1.isStale!(tags, lastModified), TAG_READ_MS, false, "tagCache.isStale")
    : undefined,
  // revalidatePath() must not silently do nothing: a stalled write fails the
  // revalidation request (the cron run / workflow goes red) instead.
  writeTags: (tags) => orThrow(d1.writeTags(tags), WRITE_MS, "tagCache.writeTags"),
};

export default defineCloudflareConfig({
  incrementalCache,
  queue: doQueue,
  tagCache,
});
