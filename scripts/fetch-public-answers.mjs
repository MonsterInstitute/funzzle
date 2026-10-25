/**
 * Fetch REAL daily puzzle answers from PUBLIC sources (no auth, no browser
 * tokens):
 *
 *   - Wordle      : NYT's own free public JSON endpoint (authoritative)
 *   - Connections : NYT's own free public JSON endpoint (authoritative)
 *   - NYT Mini    : NYT's own free public JSON endpoint (authoritative, any past
 *                   date; a date 404s until NYT releases it — 22:00 ET the day
 *                   before on weekdays, 18:00 ET on weekends), then Word.tips
 *   - Strands     : NYT's own free public JSON endpoint (authoritative, any date)
 *   - Letter Boxed: the NYT puzzle page's embedded gameData (today + yesterday
 *                   only; NYT has no Letter Boxed archive)
 *   - Quordle     : computed exactly as the official game does, from the word
 *                   list in Merriam-Webster's own game bundle (canary-checked)
 *   - Worldle     : the game's own CDN (teuteuf.fr), one JSON file per date
 *   - Nerdle      : nerdlegame.com's official per-date answer pages
 *
 * Every answer here is the real answer to that game's puzzle. Funzzle's own
 * puzzles (Word Hunt, Letter Box, Word · Quad/Geo/Math) are never published
 * under these games' names.
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
 *   node scripts/fetch-public-answers.mjs strands|letter-boxed|quordle|worldle|nerdle 2026-10-24
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
// Shared helpers for the games below
// ---------------------------------------------------------------------------

function shiftDate(date, days) {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}

/**
 * A value fetched once and reused for `ttlMs` (a Worker isolate serves many
 * requests; one cron run asks for today AND tomorrow, concurrently, so the
 * in-flight promise is shared). A failure is not cached.
 */
function memo(fn, ttlMs) {
  let at = 0;
  let pending = null;
  return () => {
    if (pending && Date.now() - at < ttlMs) return pending;
    at = Date.now();
    pending = fn().catch((err) => {
      pending = null;
      throw err;
    });
    return pending;
  };
}

// ---------------------------------------------------------------------------
// NYT Strands — NYT's own free public JSON endpoint (authoritative, any date,
// published days ahead like Wordle and Connections).
// ---------------------------------------------------------------------------

/** Parse NYT's svc/strands/v2/{date}.json into answers.answer_data. */
export function parseStrands(j, date) {
  assert(j?.printDate === date, `NYT strands date mismatch: got ${j?.printDate}`);
  const spangram = String(j.spangram ?? "").toUpperCase();
  const words = Array.isArray(j.themeWords) ? j.themeWords.map((w) => String(w).toUpperCase()) : [];
  assert(/^[A-Z]{4,}$/.test(spangram), `strands: bad spangram ${spangram}`);
  assert(words.length >= 3 && words.every((w) => /^[A-Z]{3,}$/.test(w)), "strands: bad theme words");
  assert(new Set(words).size === words.length && !words.includes(spangram), "strands: duplicate words");
  const clue = String(j.clue ?? "").trim();
  assert(clue.length > 0, "strands: no theme clue");
  return {
    clue,
    spangram,
    words,
    puzzle_id: Number.isInteger(j.id) ? j.id : null,
    editor: typeof j.editor === "string" ? j.editor : null,
    constructors: typeof j.constructors === "string" ? j.constructors : null,
  };
}

export async function fetchStrands(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  let j;
  try {
    j = await httpGet(`https://www.nytimes.com/svc/strands/v2/${date}.json`, { json: true });
  } catch (err) {
    if (err.status === 404) throw new Error(`NYT Strands for ${date} is not published yet (404)`);
    throw err;
  }
  return { date, type: "strands", source: "nytimes.com/svc/strands/v2", answer_data: parseStrands(j, date) };
}

// ---------------------------------------------------------------------------
// NYT Letter Boxed — the puzzle page embeds window.gameData with today's
// sides and NYT's own solution ("ourSolution"), plus yesterday's. A new box
// goes live at 3 a.m. Eastern; there is no archive, so only these two dates
// can ever be fetched.
// ---------------------------------------------------------------------------

/**
 * A Letter Boxed solution must be playable on its box: four sides of three
 * distinct letters, every word built from box letters with no two consecutive
 * letters on one side, each word starting with the last letter of the one
 * before, and all twelve letters used.
 */
export function validateLetterBoxed(sides, solution) {
  assert(Array.isArray(sides) && sides.length === 4 && sides.every((s) => /^[A-Z]{3}$/.test(s)), `letter boxed: bad sides ${sides}`);
  const sideOf = new Map();
  sides.forEach((s, i) => [...s].forEach((c) => sideOf.set(c, i)));
  assert(sideOf.size === 12, "letter boxed: sides must hold 12 distinct letters");
  assert(Array.isArray(solution) && solution.length >= 1 && solution.length <= 6, "letter boxed: bad solution");
  const used = new Set();
  solution.forEach((w, i) => {
    assert(/^[A-Z]{3,}$/.test(w), `letter boxed: bad word ${w}`);
    if (i > 0) assert(w[0] === solution[i - 1].at(-1), `letter boxed: ${w} doesn't start with the last letter of ${solution[i - 1]}`);
    [...w].forEach((c, k) => {
      assert(sideOf.has(c), `letter boxed: ${c} is not in the box`);
      if (k > 0) assert(sideOf.get(c) !== sideOf.get(w[k - 1]), `letter boxed: ${w} uses one side twice in a row`);
      used.add(c);
    });
  });
  assert(used.size === 12, `letter boxed: solution uses ${used.size} of 12 letters`);
}

/** Today's and yesterday's puzzles from the Letter Boxed page HTML. */
export function parseLetterBoxedPage(html) {
  const m = html.match(/window\.gameData\s*=\s*(\{.*?\})\s*(?:;|<\/script>)/s);
  assert(m, "letter boxed: no window.gameData on the page");
  const g = JSON.parse(m[1]);
  assert(isValidISODate(g.printDate), `letter boxed: bad printDate ${g.printDate}`);
  const up = (a) => (Array.isArray(a) ? a.map((s) => String(s).toUpperCase()) : a);
  const today = {
    date: g.printDate,
    answer_data: {
      sides: up(g.sides),
      solution: up(g.ourSolution),
      par: Number.isInteger(g.par) ? g.par : null,
      puzzle_id: Number.isInteger(g.id) ? g.id : null,
      editor: typeof g.editor === "string" ? g.editor : null,
    },
  };
  validateLetterBoxed(today.answer_data.sides, today.answer_data.solution);
  const out = [today];
  if (g.yesterdaysSides && g.yesterdaysSolution) {
    const y = { sides: up(g.yesterdaysSides), solution: up(g.yesterdaysSolution), par: null, puzzle_id: null, editor: null };
    validateLetterBoxed(y.sides, y.solution);
    out.push({ date: shiftDate(g.printDate, -1), answer_data: y });
  }
  return out;
}

const letterBoxedPage = memo(
  async () => parseLetterBoxedPage(await httpGet("https://www.nytimes.com/puzzles/letter-boxed")),
  10 * 60 * 1000
);

export async function fetchLetterBoxed(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  const days = await letterBoxedPage();
  const hit = days.find((d) => d.date === date);
  assert(hit, `NYT Letter Boxed for ${date} is not on the puzzle page (it shows ${days[0].date}; the box changes at 3 a.m. ET and has no archive)`);
  return { date, type: "letter-boxed", source: "nytimes.com/puzzles/letter-boxed", answer_data: hit.answer_data };
}

// ---------------------------------------------------------------------------
// Quordle (Merriam-Webster) — the daily words are not served by an API: the
// game computes them in the browser from the day number (days since
// 2022-01-24, which is also the puzzle number) with a Mersenne Twister and
// the word bank + blocklist shipped in its JS bundle. We fetch that bundle
// from merriam-webster.com and run the same computation. A known day is
// checked first, so a changed bundle or algorithm fails loudly instead of
// publishing wrong words.
// ---------------------------------------------------------------------------

const QUORDLE_EPOCH = "2022-01-24";
/** Quordle #1703 (2026-09-23), as published by M-W and answer sites. */
const QUORDLE_CANARY = { number: 1703, words: ["SHEET", "BLAND", "JOIST", "GUAVA"] };

/** mersenne-twister (npm), as bundled by Quordle: init_seed + random_int31. */
function mersenneInt31(seed) {
  const N = 624, M = 397;
  const mt = new Array(N);
  mt[0] = seed >>> 0;
  let mti;
  for (mti = 1; mti < N; mti++) {
    const t = mt[mti - 1] ^ (mt[mti - 1] >>> 30);
    mt[mti] = (((((t & 0xffff0000) >>> 16) * 1812433253) << 16) + (t & 0x0000ffff) * 1812433253 + mti) >>> 0;
  }
  const mag = [0, 0x9908b0df];
  return () => {
    let y;
    if (mti >= N) {
      let k;
      for (k = 0; k < N - M; k++) {
        y = (mt[k] & 0x80000000) | (mt[k + 1] & 0x7fffffff);
        mt[k] = mt[k + M] ^ (y >>> 1) ^ mag[y & 1];
      }
      for (; k < N - 1; k++) {
        y = (mt[k] & 0x80000000) | (mt[k + 1] & 0x7fffffff);
        mt[k] = mt[k + (M - N)] ^ (y >>> 1) ^ mag[y & 1];
      }
      y = (mt[N - 1] & 0x80000000) | (mt[0] & 0x7fffffff);
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ mag[y & 1];
      mti = 0;
    }
    y = mt[mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return (y >>> 0) >>> 1;
  };
}

/** The word bank and blocklist from Quordle's JS bundle (English strings). */
export function parseQuordleBundle(js) {
  const bank = js.match(/wordBank:"([A-Z ]+)"/);
  const block = js.match(/blacklist:"([A-Z ]+)"/);
  assert(bank && block, "quordle: word bank or blocklist not found in the bundle");
  const wordBank = bank[1].split(" ");
  assert(wordBank.length > 1000 && wordBank.every((w) => /^[A-Z]{5}$/.test(w)), "quordle: odd word bank");
  return { wordBank, blocklist: new Set(block[1].split(" ")) };
}

/** Quordle's daily answers for puzzle `number` (the game's Dt()). */
export function quordleWords(number, { wordBank, blocklist }) {
  const next = mersenneInt31(number);
  next(); next(); next(); next();
  const pick = () => wordBank[next() % wordBank.length];
  let words;
  do words = [pick(), pick(), pick(), pick()];
  while (new Set(words).size < 4 || words.some((w) => blocklist.has(w)));
  return words;
}

export function quordleNumber(date) {
  return daysBetween(QUORDLE_EPOCH, date);
}

/** Answers for `date` from a parsed bundle, after the canary check. */
export function quordleAnswerData(date, lists) {
  const canary = quordleWords(QUORDLE_CANARY.number, lists);
  assert(
    canary.join() === QUORDLE_CANARY.words.join(),
    `quordle: bundle no longer reproduces #${QUORDLE_CANARY.number} (got ${canary.join(" ")}) — algorithm or word list changed`
  );
  const number = quordleNumber(date);
  assert(number >= 1, `quordle: ${date} is before the first puzzle`);
  return { number, words: quordleWords(number, lists) };
}

const QUORDLE_URL = "https://www.merriam-webster.com/games/quordle/";
const quordleLists = memo(async () => {
  const html = await httpGet(QUORDLE_URL);
  const src = html.match(/src="([^"]*\/assets\/index-[\w-]+\.js)"/);
  assert(src, "quordle: no index bundle on the game page");
  return parseQuordleBundle(await httpGet(new URL(src[1], QUORDLE_URL).href, { timeoutMs: 25000 }));
}, 60 * 60 * 1000);

export async function fetchQuordle(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  const answer_data = quordleAnswerData(date, await quordleLists());
  return { date, type: "quordle", source: "merriam-webster.com/games/quordle (game bundle)", answer_data };
}

// ---------------------------------------------------------------------------
// Worldle (teuteuf.fr) — the game loads each day's country from its own CDN:
// cdn-assets.teuteuf.fr/data/worldle/games/{year}/{date}.json (published
// ahead), and country names from common/countries.json.
// ---------------------------------------------------------------------------

const WORLDLE_CDN = "https://cdn-assets.teuteuf.fr/data";

/** Worldle game file + countries.json -> answers.answer_data. */
export function parseWorldle(game, countries) {
  const code = String(game?.countryCode ?? "").toUpperCase();
  assert(/^[A-Z]{2}$/.test(code), `worldle: bad country code ${game?.countryCode}`);
  const c = Array.isArray(countries) ? countries.find((x) => String(x.code).toUpperCase() === code) : null;
  assert(c && typeof c.name === "string" && c.name.length > 1, `worldle: country ${code} not in countries.json`);
  assert(Number.isFinite(c.latitude) && Number.isFinite(c.longitude), `worldle: no coordinates for ${code}`);
  return { country_code: code, country: c.name, lat: c.latitude, lng: c.longitude };
}

const worldleCountries = memo(async () => {
  const list = await httpGet(`${WORLDLE_CDN}/common/countries.json`, { json: true });
  assert(Array.isArray(list) && list.length > 150, "worldle: odd countries.json");
  return list;
}, 60 * 60 * 1000);

export async function fetchWorldle(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  let game;
  try {
    game = await httpGet(`${WORLDLE_CDN}/worldle/games/${date.slice(0, 4)}/${date}.json`, { json: true });
  } catch (err) {
    if (err.status === 403 || err.status === 404) throw new Error(`Worldle for ${date} is not published yet (${err.status})`);
    throw err;
  }
  return { date, type: "worldle", source: "cdn-assets.teuteuf.fr/data/worldle/games", answer_data: parseWorldle(game, await worldleCountries()) };
}

// ---------------------------------------------------------------------------
// Nerdle — nerdlegame.com publishes an official answer page per date:
// /answers/classic/classic-nerdle-answer-{date}.html (tomorrow's goes up a
// day ahead; later dates are 403).
// ---------------------------------------------------------------------------

/** Exact value of an equation side with + - * / precedence (fractions kept exact). */
function evalNerdleSide(expr) {
  const tokens = expr.match(/\d+|[+\-*/]/g);
  assert(tokens && tokens.join("") === expr && tokens.length % 2 === 1, `nerdle: can't parse ${expr}`);
  // Rationals as [numerator, denominator] so 3/21*7 is exactly 1.
  const terms = [];
  let cur = [Number(tokens[0]), 1];
  let sign = 1;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = Number(tokens[i + 1]);
    assert(/^\d+$/.test(tokens[i + 1]), `nerdle: bad number in ${expr}`);
    if (op === "*") cur = [cur[0] * n, cur[1]];
    else if (op === "/") {
      assert(n !== 0, "nerdle: division by zero");
      cur = [cur[0], cur[1] * n];
    } else {
      terms.push([sign * cur[0], cur[1]]);
      sign = op === "+" ? 1 : -1;
      cur = [n, 1];
    }
  }
  terms.push([sign * cur[0], cur[1]]);
  return terms.reduce((acc, [n, d]) => acc + n / d, 0);
}

export function validateNerdle(equation) {
  assert(/^[0-9+\-*/=]{8}$/.test(equation), `nerdle: not an 8-character equation: ${equation}`);
  const parts = equation.split("=");
  assert(parts.length === 2 && /^\d+$/.test(parts[1]), `nerdle: odd equation ${equation}`);
  assert(Math.abs(evalNerdleSide(parts[0]) - Number(parts[1])) < 1e-9, `nerdle: ${equation} doesn't compute`);
}

/** Parse the official answer page for `date`. */
export function parseNerdlePage(html, date) {
  const title = html.match(/<title>([^<]*)<\/title>/);
  assert(title && title[1].toLowerCase().includes(longDate(date).toLowerCase()), `nerdle: page is not for ${longDate(date)}`);
  const num = title[1].match(/#(\d+)/);
  const box = html.match(/class="answer-box"[^>]*>\s*([^<]+?)\s*</);
  assert(box, "nerdle: no answer box on the page");
  const equation = box[1].replace(/\s+/g, "");
  validateNerdle(equation);
  return { equation, number: num ? Number(num[1]) : null };
}

export async function fetchNerdle(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  let html;
  try {
    html = await httpGet(`https://www.nerdlegame.com/answers/classic/classic-nerdle-answer-${date}.html`);
  } catch (err) {
    if (err.status === 403 || err.status === 404) throw new Error(`Nerdle answer for ${date} is not published yet (${err.status})`);
    throw err;
  }
  return { date, type: "nerdle", source: "nerdlegame.com/answers/classic", answer_data: parseNerdlePage(html, date) };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const [game, date = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  const fns = {
    wordle: fetchWordle,
    connections: fetchConnections,
    mini: fetchMini,
    strands: fetchStrands,
    "letter-boxed": fetchLetterBoxed,
    quordle: fetchQuordle,
    worldle: fetchWorldle,
    nerdle: fetchNerdle,
  };
  const fn = fns[game];
  if (!fn) {
    console.error(`usage: fetch-public-answers.mjs <${Object.keys(fns).join("|")}> [YYYY-MM-DD]`);
    process.exit(1);
  }
  fn(date)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((err) => {
      console.error(`${game} failed:`, err.message);
      process.exit(1);
    });
}
