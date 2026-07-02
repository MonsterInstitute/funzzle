/**
 * Fetch the REAL NYT Mini crossword for a given date from the official puzzle
 * data endpoint that nytimes.com/crosswords/game/mini uses under the hood:
 *
 *   https://www.nytimes.com/svc/crosswords/v6/puzzle/mini/<YYYY-MM-DD>.json
 *
 * That endpoint returns the authoritative grid + clues + answers, but it is
 * gated behind a logged-in session — even though the Mini is free to *play*,
 * the JSON requires the `NYT-S` auth cookie. A free nytimes.com account is
 * enough (you do NOT need a paid Games/News subscription).
 *
 *   How to get your NYT-S token:
 *     1. Log in at https://www.nytimes.com in a browser.
 *     2. Open DevTools → Application/Storage → Cookies → https://www.nytimes.com
 *     3. Copy the value of the `NYT-S` cookie.
 *     4. Set it as the NYT_S env var (locally in .env.local, in CI as a secret).
 *
 * You can pass either the raw NYT-S value (NYT_S=...) or a full cookie header
 * (NYT_COOKIE="NYT-S=...; other=...").
 *
 * Usage:
 *   node --env-file=.env.local scripts/fetch-nyt-mini.mjs 2026-07-02
 *   import { fetchNytMini } from "./fetch-nyt-mini.mjs"
 */

const V6_URL = (date) =>
  `https://www.nytimes.com/svc/crosswords/v6/puzzle/mini/${date}.json`;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Build a Cookie header from either NYT_S (raw value) or NYT_COOKIE (full). */
export function nytCookieHeader(env = process.env) {
  const full = env.NYT_COOKIE?.trim();
  if (full) return full;
  const token = env.NYT_S?.trim();
  if (token) return `NYT-S=${token}`;
  return null;
}

/**
 * Turn the v6 puzzle JSON into { across, down } where each entry is
 * { number, clue, answer }. The v6 format stores every square in
 * body[0].cells (a cell has an `answer` letter, black squares are empty
 * objects) and every clue in body[0].clues with a `label` (the printed
 * number), a `direction` ("Across"/"Down"), the `cells` indices it spans,
 * and `text` (an array of { plain } fragments).
 */
export function parseV6Puzzle(json) {
  const body = json?.body?.[0];
  if (!body || !Array.isArray(body.cells) || !Array.isArray(body.clues)) {
    throw new Error("unexpected v6 puzzle shape (no body[0].cells/clues)");
  }
  const cells = body.cells;

  const across = [];
  const down = [];
  for (const clue of body.clues) {
    const answer = (clue.cells || [])
      .map((i) => cells[i]?.answer ?? "")
      .join("")
      .toUpperCase();
    const text = Array.isArray(clue.text)
      ? clue.text.map((t) => t?.plain ?? t?.formatted ?? "").join(" ").trim()
      : String(clue.text ?? "").trim();
    const entry = {
      number: Number.parseInt(clue.label, 10),
      clue: text,
      answer,
    };
    if (!entry.answer) continue; // skip anything we can't reconstruct
    const dir = String(clue.direction || "").toLowerCase();
    if (dir.startsWith("a")) across.push(entry);
    else if (dir.startsWith("d")) down.push(entry);
  }

  const byNumber = (a, b) => a.number - b.number;
  across.sort(byNumber);
  down.sort(byNumber);

  if (across.length === 0 || down.length === 0) {
    throw new Error("parsed puzzle had no across/down clues");
  }
  return { across, down };
}

/**
 * Fetch and parse the real NYT Mini for `date` (YYYY-MM-DD).
 * Requires a NYT-S auth token (see file header). Throws on any failure so the
 * caller can decide whether to skip the Mini for the day.
 */
export async function fetchNytMini(date, { env = process.env } = {}) {
  const cookie = nytCookieHeader(env);
  if (!cookie) {
    throw new Error(
      "NYT_S (or NYT_COOKIE) is not set — cannot fetch the real NYT Mini. " +
        "See scripts/fetch-nyt-mini.mjs for how to obtain the NYT-S cookie."
    );
  }

  const res = await fetch(V6_URL(date), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Referer: "https://www.nytimes.com/crosswords/game/mini",
      Origin: "https://www.nytimes.com",
      Cookie: cookie,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `NYT Mini fetch got HTTP ${res.status} — the NYT-S token is missing, ` +
        "expired, or invalid. Refresh it from a logged-in browser session."
    );
  }
  if (res.status === 404) {
    throw new Error(`No NYT Mini published for ${date} yet (HTTP 404).`);
  }
  if (!res.ok) {
    throw new Error(`NYT Mini fetch failed: HTTP ${res.status}`);
  }

  const json = await res.json();
  const puzzle = parseV6Puzzle(json);
  return {
    date,
    ...puzzle,
    editor: json?.editor ?? null,
    constructors: json?.constructors ?? null,
  };
}

// CLI entrypoint: print the parsed puzzle as JSON.
if (import.meta.url === `file://${process.argv[1]}`) {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  fetchNytMini(date)
    .then((p) => {
      console.log(JSON.stringify(p, null, 2));
    })
    .catch((err) => {
      console.error("fetch-nyt-mini failed:", err.message);
      process.exit(1);
    });
}
