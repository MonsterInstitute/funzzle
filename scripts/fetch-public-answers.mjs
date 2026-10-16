/**
 * Fetch REAL daily puzzle answers from PUBLIC sources (no auth, no browser
 * tokens). Covers the three highest-traffic games:
 *
 *   - Wordle      : NYT's own free public JSON endpoint (authoritative)
 *   - Connections : NYT's own free public JSON endpoint (authoritative)
 *   - NYT Mini    : NYT's own free public JSON endpoint (authoritative, any past
 *                   date; a date 404s until NYT releases it — 22:00 ET the day
 *                   before on weekdays, 18:00 ET on weekends), then Word.tips
 *
 * Design goals:
 *   - Every fetcher tries multiple sources in order and returns the first that
 *     parses AND validates (right date + structural sanity checks).
 *   - Never fabricates: if no source yields valid data, the fetcher throws so
 *     the caller can fall back to bundled local content or fail loudly.
 *   - A secondary (scraped) source must pass the same checks as the primary,
 *     plus its own sanity checks, or it is SKIPPED — never published.
 *   - Each returned object is shaped exactly like the `answers.answer_data`
 *     column the site already reads.
 *
 * Usage (CLI, for debugging):
 *   node scripts/fetch-public-answers.mjs wordle 2026-07-08
 *   node scripts/fetch-public-answers.mjs connections 2026-07-08
 *   node scripts/fetch-public-answers.mjs mini 2026-07-08
 */

import { WORDLE_WORDS } from "./wordle-dictionary.mjs";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

export function isValidISODate(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** GET a URL with browser-y headers, a timeout, and a couple of retries. */
async function httpGet(url, { json = false, timeoutMs = 15000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: json ? "application/json, text/plain, */*" : "text/html,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return json ? await res.json() : await res.text();
    } catch (err) {
      lastErr = err;
      // A 4xx won't change on retry (e.g. a puzzle that isn't released yet).
      if (err.status >= 400 && err.status < 500) break;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  const err = new Error(`GET ${url} failed: ${lastErr?.message ?? "unknown"}`);
  err.status = lastErr?.status;
  throw err;
}

/** Decode the HTML entities found in scraped clue text. */
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function dateParts(date) {
  const dt = new Date(`${date}T00:00:00Z`);
  return {
    year: dt.getUTCFullYear(),
    month: MONTHS[dt.getUTCMonth()],
    day: dt.getUTCDate(),
  };
}

/** e.g. "July 8, 2026" — used to verify a scraped page is for the right day. */
function longDate(date) {
  const { month, day, year } = dateParts(date);
  return `${month[0].toUpperCase()}${month.slice(1)} ${day}, ${year}`;
}

// ---------------------------------------------------------------------------
// Wordle
// ---------------------------------------------------------------------------

function countVowels(word) {
  return (word.toUpperCase().match(/[AEIOU]/g) || []).length;
}

function toWordleAnswerData(solution) {
  const answer = solution.toUpperCase();
  return { answer, hint_first_letter: answer[0], hint_vowels: countVowels(answer) };
}

function validateWordleWord(word) {
  assert(/^[A-Z]{5}$/.test(word), `not a 5-letter word: ${word}`);
}

/**
 * Stricter check for answers from secondary (scraped) sources: the word must
 * be a valid Wordle word. Not applied to NYT's own endpoint, which is the
 * authority — a brand-new answer missing from the list must not be rejected.
 */
function validateScrapedWordleWord(word) {
  validateWordleWord(word);
  assert(WORDLE_WORDS.has(word), `not a valid Wordle word: ${word}`);
}

/** Wordle #0 was 2021-06-19, so the puzzle number is days since then. */
function wordleNumber(date) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse("2021-06-19T00:00:00Z")) / 86_400_000);
}

/** NYT's own free public Wordle endpoint — authoritative, no auth. */
async function wordleFromNyt(date) {
  const j = await httpGet(`https://www.nytimes.com/svc/wordle/v2/${date}.json`, { json: true });
  const sol = String(j?.solution ?? "").toUpperCase();
  assert(j?.print_date === date, `NYT wordle date mismatch: got ${j?.print_date}`);
  validateWordleWord(sol);
  if (!WORDLE_WORDS.has(sol)) console.warn(`⚠️  NYT Wordle ${date} answer ${sol} is not in the word list (kept: NYT is authoritative)`);
  return { word: sol, source: "nytimes.com/svc/wordle/v2" };
}

/**
 * Fallback: Tom's Guide's daily Wordle article (evergreen URL). The answer is
 * read from the page's structure, not from prose: the bolded ALL-CAPS word
 * under "today's Wordle answer for game #N?", where N must be the puzzle
 * number for `date`. It must also start with the letter from the page's
 * separate "Wordle #N starts with X" hint and be a valid Wordle word —
 * otherwise this source is skipped. (A loose prose regex once returned
 * "TODAY" from "So, what is today's Wordle answer".)
 */
async function wordleFromTomsGuide(date) {
  const html = await httpGet("https://www.tomsguide.com/news/what-is-todays-wordle-answer");
  const n = wordleNumber(date);
  const num = n >= 1000 ? `${Math.floor(n / 1000)},?${String(n % 1000).padStart(3, "0")}` : String(n);
  const answer = html.match(
    new RegExp(`Wordle answer for game #${num}\\?[\\s\\S]{0,600}?<strong>\\s*([A-Z]{5})\\.?\\s*</strong>`)
  );
  assert(answer, `Tom's Guide: no answer block for Wordle #${n} (${longDate(date)})`);
  const hint = html.match(new RegExp(`Wordle #${num} starts with ([A-Z])\\b`));
  assert(hint, `Tom's Guide: no first-letter hint for Wordle #${n}`);
  const word = answer[1];
  assert(word[0] === hint[1], `Tom's Guide: ${word} doesn't start with the hinted ${hint[1]}`);
  validateScrapedWordleWord(word);
  return { word, source: "tomsguide.com" };
}

export async function fetchWordle(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  const sources = { nyt: wordleFromNyt, tomsguide: wordleFromTomsGuide };
  const errors = [];
  // Labelled explicitly: bundlers minify function names.
  for (const [label, src] of Object.entries(sources)) {
    try {
      const { word, source } = await src(date);
      return { date, type: "wordle", source, answer_data: toWordleAnswerData(word) };
    } catch (err) {
      errors.push(`${label}: ${err.message}`);
    }
  }
  throw new Error(`all Wordle sources failed — ${errors.join(" | ")}`);
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

const CONNECTIONS_COLORS = ["yellow", "green", "blue", "purple"]; // easy -> hard

function validateConnections(groups) {
  assert(Array.isArray(groups) && groups.length === 4, "connections: need 4 groups");
  const seen = new Set();
  for (const g of groups) {
    assert(typeof g.title === "string" && g.title.length > 0, "group missing title");
    assert(Array.isArray(g.words) && g.words.length === 4, "group needs 4 words");
    for (const w of g.words) {
      // Any letter, not just A-Z: NYT uses accented words (e.g. BOHÈME).
      assert(/^[\p{L}\p{M}\p{N}'’.\-&!? ]+$/u.test(w), `odd connections word: ${w}`);
      seen.add(w.toUpperCase());
    }
  }
  assert(seen.size === 16, `connections: expected 16 unique words, got ${seen.size}`);
}

/** NYT's own free public Connections endpoint — authoritative, no auth. */
async function connectionsFromNyt(date) {
  const j = await httpGet(`https://www.nytimes.com/svc/connections/v2/${date}.json`, { json: true });
  assert(j?.print_date === date, `NYT connections date mismatch: got ${j?.print_date}`);
  assert(Array.isArray(j?.categories) && j.categories.length === 4, "unexpected connections shape");
  // Categories come ordered easiest -> hardest (yellow, green, blue, purple).
  const groups = j.categories.map((c, i) => ({
    title: String(c.title).trim(),
    color: CONNECTIONS_COLORS[i] ?? null,
    level: i,
    words: (c.cards || [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((card) => String(card.content).toUpperCase()),
  }));
  validateConnections(groups);
  return { groups, editor: j.editor ?? null, source: "nytimes.com/svc/connections/v2" };
}

export async function fetchConnections(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  const sources = { nyt: connectionsFromNyt };
  const errors = [];
  // Labelled explicitly: bundlers minify function names.
  for (const [label, src] of Object.entries(sources)) {
    try {
      const { groups, editor, source } = await src(date);
      return { date, type: "connections", source, answer_data: { groups, editor } };
    } catch (err) {
      errors.push(`${label}: ${err.message}`);
    }
  }
  throw new Error(`all Connections sources failed — ${errors.join(" | ")}`);
}

// ---------------------------------------------------------------------------
// NYT Mini crossword
// ---------------------------------------------------------------------------

/**
 * A parsed mini must satisfy the crossword invariant that the total number of
 * lettered cells is the same counted across as down (every white cell belongs
 * to exactly one across word and one down word). This is a cheap, strong check
 * that the scrape didn't drop or duplicate an entry.
 */
function validateMini({ across, down }) {
  assert(across.length >= 3 && down.length >= 3, "mini: too few clues parsed");
  for (const c of [...across, ...down]) {
    assert(Number.isInteger(c.number) && c.number > 0, `bad clue number: ${c.number}`);
    assert(/^[A-Z]{2,}$/.test(c.answer), `bad answer: ${c.answer}`);
    assert(typeof c.clue === "string" && c.clue.length > 0, "empty clue text");
  }
  const acrossLetters = across.reduce((n, c) => n + c.answer.length, 0);
  const downLetters = down.reduce((n, c) => n + c.answer.length, 0);
  assert(
    acrossLetters === downLetters,
    `mini grid inconsistent: ${acrossLetters} across letters vs ${downLetters} down`
  );
}

/**
 * Primary Mini source: NYT's own free public JSON endpoint — authoritative and
 * works for any past date (backfill). Each clue lists the grid cells it covers;
 * the answer is those cells' letters in order.
 */
async function miniFromNyt(date) {
  let j;
  try {
    j = await httpGet(`https://www.nytimes.com/svc/crosswords/v6/puzzle/mini/${date}.json`, { json: true });
  } catch (err) {
    if (err.status === 404) throw new Error(`NYT Mini for ${date} is not released yet (404)`);
    throw err;
  }
  assert(j?.publicationDate === date, `NYT mini date mismatch: got ${j?.publicationDate}`);
  const body = j?.body?.[0];
  assert(Array.isArray(body?.cells) && Array.isArray(body?.clues), "unexpected NYT mini shape");
  const across = [];
  const down = [];
  for (const c of body.clues) {
    const entry = {
      number: Number.parseInt(c.label, 10),
      clue: decodeEntities((c.text || []).map((t) => t.plain ?? "").join(" ")).trim(),
      answer: (c.cells || []).map((i) => body.cells[i]?.answer ?? "").join("").toUpperCase(),
    };
    if (c.direction === "Across") across.push(entry);
    else if (c.direction === "Down") down.push(entry);
  }
  return { across, down, source: "nytimes.com/svc/crosswords/v6" };
}

/**
 * Fallback Mini source: Word.tips inlines the puzzle as a JS data object. It
 * only serves the current puzzle, so it can't backfill past dates.
 */
async function miniFromWordTips(date) {
  const html = await httpGet("https://word.tips/todays-nyt-mini-crossword-clues-answers/");
  // The SvelteKit payload inlines: date:"YYYY-MM-DD",clues:[{clue,direction,num,word},...]
  const dm = html.match(/date:"(\d{4}-\d{2}-\d{2})"/);
  assert(dm && dm[1] === date, `Word.tips page is for ${dm?.[1] ?? "?"}, not ${date}`);
  const across = [];
  const down = [];
  const re = /\{clue:"((?:[^"\\]|\\.)*)",slug:"[^"]*",direction:"(ACROSS|DOWN)",num:(\d+),word:"([A-Z]+)"\}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const entry = {
      number: Number.parseInt(m[3], 10),
      clue: decodeEntities(m[1].replace(/\\"/g, '"')).trim(),
      answer: m[4].toUpperCase(),
    };
    (m[2] === "ACROSS" ? across : down).push(entry);
  }
  return { across, down, source: "word.tips" };
}

export async function fetchMini(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  const sources = { nyt: miniFromNyt, wordtips: miniFromWordTips };
  const errors = [];
  // Labelled explicitly: bundlers minify function names.
  for (const [label, src] of Object.entries(sources)) {
    try {
      const { across, down, source } = await src(date);
      const clean = {
        across: across.map(({ number, clue, answer }) => ({ number, clue, answer })),
        down: down.map(({ number, clue, answer }) => ({ number, clue, answer })),
      };
      validateMini(clean);
      return { date, type: "nyt-mini", source, answer_data: clean };
    } catch (err) {
      errors.push(`${label}: ${err.message}`);
    }
  }
  throw new Error(`all Mini sources failed — ${errors.join(" | ")}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const [game, date = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  const fns = { wordle: fetchWordle, connections: fetchConnections, mini: fetchMini };
  const fn = fns[game];
  if (!fn) {
    console.error("usage: fetch-public-answers.mjs <wordle|connections|mini> [YYYY-MM-DD]");
    process.exit(1);
  }
  fn(date)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((err) => {
      console.error(`${game} failed:`, err.message);
      process.exit(1);
    });
}
