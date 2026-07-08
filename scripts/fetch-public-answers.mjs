/**
 * Fetch REAL daily puzzle answers from PUBLIC sources (no auth, no browser
 * tokens). Covers the three highest-traffic games:
 *
 *   - Wordle      : NYT's own free public JSON endpoint (authoritative)
 *   - Connections : NYT's own free public JSON endpoint (authoritative)
 *   - NYT Mini    : scraped from public answer pages (Technobezz, Word.tips)
 *
 * Design goals:
 *   - Every fetcher tries multiple sources in order and returns the first that
 *     parses AND validates (right date + structural sanity checks).
 *   - Never fabricates: if no source yields valid data, the fetcher throws so
 *     the caller can fall back to bundled local content or fail loudly.
 *   - Each returned object is shaped exactly like the `answers.answer_data`
 *     column the site already reads.
 *
 * Usage (CLI, for debugging):
 *   node scripts/fetch-public-answers.mjs wordle 2026-07-08
 *   node scripts/fetch-public-answers.mjs connections 2026-07-08
 *   node scripts/fetch-public-answers.mjs mini 2026-07-08
 */

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json ? await res.json() : await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`GET ${url} failed: ${lastErr?.message ?? "unknown"}`);
}

/** Decode HTML entities and strip tags to a plain-text blob for scraping. */
function htmlToText(html) {
  const noScript = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const withBreaks = noScript.replace(/<[^>]+>/g, "\n");
  return decodeEntities(withBreaks);
}

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
const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

function dateParts(date) {
  const dt = new Date(`${date}T00:00:00Z`);
  return {
    year: dt.getUTCFullYear(),
    month: MONTHS[dt.getUTCMonth()],
    day: dt.getUTCDate(),
    weekday: WEEKDAYS[dt.getUTCDay()],
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

/** NYT's own free public Wordle endpoint — authoritative, no auth. */
async function wordleFromNyt(date) {
  const j = await httpGet(`https://www.nytimes.com/svc/wordle/v2/${date}.json`, { json: true });
  const sol = String(j?.solution ?? "").toUpperCase();
  assert(j?.print_date === date, `NYT wordle date mismatch: got ${j?.print_date}`);
  validateWordleWord(sol);
  return { word: sol, source: "nytimes.com/svc/wordle/v2" };
}

/** Fallback: Tom's Guide's daily Wordle article (evergreen URL). */
async function wordleFromTomsGuide(date) {
  const html = await httpGet("https://www.tomsguide.com/news/what-is-todays-wordle-answer");
  const text = htmlToText(html);
  assert(text.includes(longDate(date)), `Tom's Guide page not for ${longDate(date)}`);
  // "Today's Wordle answer ... is ... DEMON" — capture the emphasised solution.
  const m =
    text.match(/Wordle answer[^.]*?\bis\b[^A-Za-z]{0,8}([A-Za-z]{5})\b/i) ||
    text.match(/answer\s+today\s+is[^A-Za-z]{0,8}([A-Za-z]{5})\b/i);
  assert(m, "Tom's Guide: could not locate answer");
  const word = m[1].toUpperCase();
  validateWordleWord(word);
  return { word, source: "tomsguide.com" };
}

export async function fetchWordle(date) {
  assert(isValidISODate(date), `bad date: ${date}`);
  const sources = [wordleFromNyt, wordleFromTomsGuide];
  const errors = [];
  for (const src of sources) {
    try {
      const { word, source } = await src(date);
      return { date, type: "wordle", source, answer_data: toWordleAnswerData(word) };
    } catch (err) {
      errors.push(`${src.name}: ${err.message}`);
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
      assert(/^[A-Z0-9'’.\- ]+$/i.test(w), `odd connections word: ${w}`);
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
  const sources = [connectionsFromNyt];
  const errors = [];
  for (const src of sources) {
    try {
      const { groups, editor, source } = await src(date);
      return { date, type: "connections", source, answer_data: { groups, editor } };
    } catch (err) {
      errors.push(`${src.name}: ${err.message}`);
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

function technobezzMiniUrl(date) {
  const { weekday, month, day, year } = dateParts(date);
  return `https://www.technobezz.com/news/nyt-mini-crossword-hints-clues-and-answers-for-${weekday}-${month}-${day}-${year}`;
}

/** Primary Mini source: Technobezz has dated URLs (good for backfill). */
async function miniFromTechnobezz(date) {
  const html = await httpGet(technobezzMiniUrl(date));
  const text = htmlToText(html).replace(/[ \t]+/g, " ");
  assert(text.includes(longDate(date)), `Technobezz page not for ${longDate(date)}`);

  // Section boundaries are matched CASE-SENSITIVELY: page headings are Title
  // Case while answers are ALL-CAPS, so a stop word like "Tips" won't collide
  // with an answer such as "TIPS" (which previously truncated the Down list).
  const sliceSection = (name, stop) => {
    const re = new RegExp(`${name} Answers([\\s\\S]*?)(?:${stop})`);
    const m = text.match(re);
    return m ? m[1] : "";
  };
  const parseEntries = (section, dir) => {
    const out = [];
    const re = /(\d{1,2})\.\s*([\s\S]+?)\s*Answer:\s*([A-Za-z]+)/g;
    let m;
    while ((m = re.exec(section)) !== null) {
      out.push({
        number: Number.parseInt(m[1], 10),
        clue: m[2].replace(/\s+/g, " ").trim(),
        answer: m[3].toUpperCase(),
        dir,
      });
    }
    return out;
  };

  const SECTION_END = "Click to expand|Grid Breakdown|Final Thoughts|Frequently Asked|Wrapping Up|Conclusion|Puzzle Recap|$";
  const across = parseEntries(sliceSection("Across", `Down Answers|${SECTION_END}`), "across");
  const down = parseEntries(sliceSection("Down", SECTION_END), "down");
  return { across, down, source: "technobezz.com" };
}

/** Fallback Mini source: Word.tips inlines the puzzle as a JS data object. */
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
  const sources = [miniFromTechnobezz, miniFromWordTips];
  const errors = [];
  for (const src of sources) {
    try {
      const { across, down, source } = await src(date);
      const clean = {
        across: across.map(({ number, clue, answer }) => ({ number, clue, answer })),
        down: down.map(({ number, clue, answer }) => ({ number, clue, answer })),
      };
      validateMini(clean);
      return { date, type: "nyt-mini", source, answer_data: clean };
    } catch (err) {
      errors.push(`${src.name}: ${err.message}`);
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
