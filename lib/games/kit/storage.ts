/**
 * Local progress storage. No login: everything a player has done lives in
 * localStorage under "fz:" keys. Every access is guarded — storage can be
 * missing or throw (private windows, blocked site data), and the games must
 * still work then, just without memory.
 */

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or blocked storage: progress just isn't remembered.
  }
}

export function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Ignore: see readJson.
  }
}

/** Random anonymous id for result submission (percentiles) and analytics. */
export function clientId(): string {
  const existing = readString("fz:cid");
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  writeString("fz:cid", id);
  return id;
}
