// The app (tsconfig.json) is typed against DOM fetch types, so it can't load
// the full Workers runtime types in cloudflare-env.d.ts (worker.ts uses those).
// These are the slices of the binding APIs the app calls; keep them in sync
// with wrangler.jsonc.

interface D1Meta {
  changes?: number;
  duration?: number;
  rows_read?: number;
  rows_written?: number;
}
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface AnalyticsEngineDataPoint {
  indexes?: string[];
  blobs?: (string | null)[];
  doubles?: number[];
}
interface AnalyticsEngineDataset {
  writeDataPoint(point?: AnalyticsEngineDataPoint): void;
}

interface CloudflareEnv {
  DB: D1Database;
  EVENTS: AnalyticsEngineDataset;
}
