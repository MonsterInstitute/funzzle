import { ANSWER_DATE_ROUTES, TODAY_PATHS } from "./revalidation";
import { SITE_URL } from "./site";

/**
 * IndexNow (indexnow.org): tells Bing, Yandex, Seznam, Naver and the other
 * participating engines that today's pages changed, so they recrawl them the
 * same day. The key is public by design; its key file is public/d856dfed3af45d350e5728b402f56036.txt.
 * Called by the rollover and answers crons. Best effort: a failure is logged
 * and returned, never thrown (the pages are already live).
 */

const KEY = "d856dfed3af45d350e5728b402f56036";
const TIMEOUT_MS = 10_000;

/** The URLs that change when `date` becomes today. */
export function changedUrls(date: string): string[] {
  const paths = [...TODAY_PATHS.filter((p) => p !== "/sitemap.xml"), ...ANSWER_DATE_ROUTES.map((r) => `${r}/${date}`)];
  return paths.map((p) => `${SITE_URL}${p === "/" ? "" : p}`);
}

export async function submitIndexNow(urls: string[]): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!urls.length) return { ok: true };
  // The shared api.indexnow.org endpoint rate-limits Workers' egress IPs (429);
  // any participating engine forwards to the rest, so fall back to Bing's.
  let last: { ok: boolean; status?: number; error?: string } = { ok: false };
  for (const endpoint of ENDPOINTS) {
    last = await post(endpoint, urls);
    if (last.ok || (last.status && last.status !== 429 && last.status < 500)) return last;
  }
  return last;
}

const ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];

async function post(endpoint: string, urls: string[]): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE_URL).host, key: KEY, keyLocation: `${SITE_URL}/${KEY}.txt`, urlList: urls }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 200 = accepted, 202 = accepted, key validation pending.
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: `${new URL(endpoint).host}: ${(await res.text()).slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: `${new URL(endpoint).host}: ${(err as Error).message}` };
  }
}
