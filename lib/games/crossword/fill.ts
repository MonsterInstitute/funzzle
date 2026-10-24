/**
 * Crossword fill: put a different everyday word in every entry of a template.
 * GENERATOR-SIDE ONLY (it imports the full lexicon): the cron and tests use
 * it; the browser receives finished grids.
 *
 * Constraint search over the entries: each entry's domain is a bitset of the
 * words of its length, with a precomputed bitset per (position, letter), so
 * placing a word narrows every crossing entry with one AND (forward
 * checking). The next entry is always the one with the fewest candidates
 * left; candidates are a seeded sample ordered by how many options they leave
 * the crossings (least-constraining value). A node budget per attempt plus
 * seeded restarts keeps the time bounded, and the result is a pure function
 * of the seed.
 */
import { isBlocked } from "../words/blocklist";
import { isWord, wordsOfLength, type Tier } from "../words/lexicon";
import { createRng, type Rng } from "../kit/rng";
import { entriesOf, sizeOf, type Entry } from "./grid";

/**
 * Common-tier words that make poor crossword answers: bare plurals of
 * letters or Latin bits, contractions without the apostrophe, and words
 * nobody can clue fairly.
 */
export const FILL_EXCLUDE = new Set([
  // letter plurals, fragments and apostrophe-less contractions
  "hes", "mys", "pis", "mes", "dos", "mas", "pas", "ohs", "ins", "ifs", "ups", "ova", "qua", "sic", "wot", "nit",
  "hims", "hers", "ills", "lees", "outs", "tis", "ain", "aint", "dont", "cant", "wont", "isnt", "shes", "theyd",
  "youd", "ive", "weve", "its", "whos", "oks", "ahs", "ows", "ays", "nays", "eds", "mrs", "nos", "ens", "ems",
  "pap", "sop", "cox", "chi", "non", "ken", "fro", "mum", "cur", "hag", "bum", "pus",
  // not for a family puzzle
  "gay", "gays", "bra", "bras", "gun", "guns", "bomb", "bombs", "dies", "died", "dying", "death", "deaths", "dead",
  "drug", "drugs", "dope", "booze", "kills", "shoot", "shot", "stab", "stabs", "slay", "slain", "hang", "hanged",
  "noose", "coffin", "corpses", "nuke", "nukes", "ugly", "dumb", "idiot", "moron", "stupid", "loser", "freak",
  "crud", "darn", "naked", "strip", "bust", "busty", "breast", "breasts", "lover", "lovers", "affair", "mistress",
  "satan", "devil", "devils", "demon", "demons", "sinner", "sinners", "fatso", "obese", "slave", "slaves",
  "enema", "enemas", "halon", "trialed", "teared", "nasals", "sames", "rared", "maria", "piked", "tartars", "wanna",
  "gonna", "gotta", "attires", "reputes", "gnarls", "lasses", "newsy", "goners", "peons", "thirsting", "coarsened",
  "sangs", "bani", "hove", "aliased", "sorta", "genii", "letups", "hatted", "bestial", "petites", "drunk", "drunks",
  "racist", "racists", "racism", "genital", "genitals", "slur", "slurs", "dike", "dikes", "bloody", "gory", "sades",
  "sics", "phonied", "pended", "strawed", "tenanted", "stater", "destine", "rioter", "rioters", "dung", "urine",
  "duded", "lades", "creaming", "haloed", "desecrate", "toupee", "sadist", "sadists", "cretin", "cretins", "pasties",
  "laded", "shinned", "rares", "sewage", "manured", "drys", "snot", "snots", "welters", "snotty", "mugger", "seduce",
  "seductive", "amoebae", "uteri", "uterus", "fogy", "panties", "panty", "sucker", "coke", "cokes", "lager", "garter", "hared",
]);

/**
 * Comparatives and superlatives of adjectives ("soberer", "snidest",
 * "slier"): legal but ugly fill. A word counts as one when it ends in
 * -er/-est and the matching -est/-er form is also a word, built on a base
 * word (sober, snide, sly).
 */
export function isComparative(w: string, has: (x: string) => boolean): boolean {
  const forms: [string, string][] = [];
  if (w.endsWith("iest")) forms.push([w.slice(0, -4) + "y", w.slice(0, -4) + "ier"]);
  if (w.endsWith("ier")) forms.push([w.slice(0, -3) + "y", w.slice(0, -3) + "iest"]);
  if (w.endsWith("est")) forms.push([w.slice(0, -3), w.slice(0, -3) + "er"], [w.slice(0, -2), w.slice(0, -2) + "r"]);
  if (w.endsWith("er")) forms.push([w.slice(0, -2), w.slice(0, -2) + "est"], [w.slice(0, -1), w.slice(0, -1) + "st"]);
  // doubled consonant: bigger / biggest
  if (/([b-df-hj-np-tv-z])\1(er|est)$/.test(w)) {
    const base = w.replace(/([b-df-hj-np-tv-z])\1(er|est)$/, "$1");
    forms.push([base, base + w.slice(base.length - 1, base.length) + (w.endsWith("est") ? "er" : "est")]);
  }
  return forms.some(([base, other]) => base.length >= 2 && has(base) && has(other));
}

/** In the exclude list itself or as a plain inflection of an excluded word (morons, seduces, seduced). */
export function isExcluded(w: string, exclude: ReadonlySet<string>): boolean {
  if (exclude.has(w)) return true;
  const bases = [w.slice(0, -1), w.slice(0, -2), w.slice(0, -3), w.slice(0, -3) + "e"];
  return /(s|es|ed|ing)$/.test(w) && bases.some((b) => b.length >= 3 && exclude.has(b));
}

class LengthIndex {
  readonly words: string[];
  readonly n32: number;
  /** bits[pos * 26 + letter]: words with `letter` at `pos`. */
  readonly bits: Uint32Array[];
  readonly all: Uint32Array;

  constructor(
    readonly length: number,
    words: string[]
  ) {
    this.words = words;
    this.n32 = Math.ceil(words.length / 32);
    this.bits = Array.from({ length: length * 26 }, () => new Uint32Array(this.n32));
    this.all = new Uint32Array(this.n32);
    words.forEach((w, i) => {
      this.all[i >>> 5] |= 1 << (i & 31);
      for (let p = 0; p < length; p++) this.bits[p * 26 + (w.charCodeAt(p) - 97)][i >>> 5] |= 1 << (i & 31);
    });
  }
}

function popcount32(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function count(bits: Uint32Array): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) if (bits[i]) n += popcount32(bits[i]);
  return n;
}

function andCount(a: Uint32Array, b: Uint32Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] & b[i];
    if (x) n += popcount32(x);
  }
  return n;
}

function indexes(bits: Uint32Array): number[] {
  const out: number[] = [];
  for (let k = 0; k < bits.length; k++) {
    let x = bits[k];
    while (x) {
      const low = x & -x;
      out.push(k * 32 + (31 - Math.clz32(low)));
      x ^= low;
    }
  }
  return out;
}

/** For each position of an entry, the 26-bit mask of letters its remaining words allow there. */
function letterMasks(ix: LengthIndex, dom: Uint32Array): number[] {
  const masks = new Array<number>(ix.length).fill(0);
  for (const w of indexes(dom)) {
    const word = ix.words[w];
    for (let p = 0; p < word.length; p++) masks[p] |= 1 << (word.charCodeAt(p) - 97);
  }
  return masks;
}

/** `dom` limited to words with a letter in `mask` at `pos`; null when nothing is removed. */
function restrict(ix: LengthIndex, dom: Uint32Array, pos: number, mask: number): Uint32Array | null {
  const full = (1 << 26) - 1;
  if ((mask & full) === full) return null;
  const n32 = dom.length;
  const keep = popcount32(mask) <= 13;
  // Union of the allowed letters' bitsets (few allowed) or of the banned ones (few banned).
  const acc = new Uint32Array(n32);
  for (let l = 0; l < 26; l++) {
    if (((mask >>> l) & 1) !== (keep ? 1 : 0)) continue;
    const bit = ix.bits[pos * 26 + l];
    for (let k = 0; k < n32; k++) acc[k] |= bit[k];
  }
  let changed = false;
  for (let k = 0; k < n32; k++) {
    const next = keep ? dom[k] & acc[k] : dom[k] & ~acc[k];
    if (next !== dom[k]) changed = true;
    acc[k] = next;
  }
  return changed ? acc : null;
}

/** Entries with more candidates than this don't propagate (they almost never prune). */
const PROPAGATE_MAX = 400;

export interface Lexicon {
  index(length: number): LengthIndex;
}

const lexicons = new Map<string, Lexicon>();

/** Fill words of one tier, minus blocked and excluded words, indexed by length (cached). */
export function fillLexicon(tier: Tier = "common", exclude: ReadonlySet<string> = FILL_EXCLUDE): Lexicon {
  const key = `${tier}:${exclude === FILL_EXCLUDE ? "default" : [...exclude].sort().join(",")}`;
  let lex = lexicons.get(key);
  if (!lex) {
    const byLen = new Map<number, LengthIndex>();
    lex = {
      index(length) {
        let ix = byLen.get(length);
        if (!ix) {
          const words = wordsOfLength(length, tier)
            .toArray()
            .filter((w) => !isExcluded(w, exclude) && !isBlocked(w) && !isComparative(w, isWord));
          ix = new LengthIndex(length, words);
          byLen.set(length, ix);
        }
        return ix;
      },
    };
    lexicons.set(key, lex);
  }
  return lex;
}

export interface FillOptions {
  seed: string;
  /** Search nodes per attempt before restarting with a new seed. */
  nodesPerAttempt?: number;
  attempts?: number;
  /** Words never to use (e.g. answers from recent days). */
  avoid?: ReadonlySet<string>;
  lexicon?: Lexicon;
  /** Candidates sampled per entry (higher = slower, more thorough). */
  sample?: number;
  /** Arc-consistency revisions per search node (0 = forward checking only). */
  propagate?: number;
}

export interface FillResult {
  grid: string;
  /** Total search nodes over all attempts. */
  nodes: number;
  attempts: number;
}

class Abort extends Error {}

/** Rough base form for duplicate checks: plain -s/-es/-ed/-ing removed. */
function baseForm(w: string): string {
  const m = /^(.{3,}?)(es|s|ed|ing)$/.exec(w);
  return `~${m ? m[1] : w}`;
}

interface Slot {
  entry: Entry;
  ix: LengthIndex;
  /** For each position: [crossing slot, position in it]. */
  cross: [number, number][];
}

/** Fill `template` ("#" and "."), or null when the attempts run out. */
export function fillGrid(template: string, opts: FillOptions): FillResult | null {
  const { seed, nodesPerAttempt = 800, attempts = 200, avoid, sample = 24, propagate = 12 } = opts;
  const lexicon = opts.lexicon ?? fillLexicon();
  const size = sizeOf(template);
  const entries = entriesOf(template);
  const slots: Slot[] = entries.map((entry) => ({ entry, ix: lexicon.index(entry.cells.length), cross: [] }));
  const at = new Map<string, [number, number]>();
  slots.forEach((s, si) => s.entry.cells.forEach((c, p) => at.set(`${s.entry.dir}:${c}`, [si, p])));
  for (const s of slots) {
    s.cross = s.entry.cells.map((c) => at.get(`${s.entry.dir === "across" ? "down" : "across"}:${c}`) ?? [-1, -1]);
  }
  void size;

  let nodes = 0;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = createRng(`${seed}#${attempt}`);
    const domains: Uint32Array[] = slots.map((s) => {
      const d = s.ix.all.slice();
      if (avoid) s.ix.words.forEach((w, i) => avoid.has(w) && (d[i >>> 5] &= ~(1 << (i & 31))));
      return d;
    });
    const counts = domains.map(count);
    const assigned = new Array<number>(slots.length).fill(-1);
    const used = new Set<string>();
    let budget = nodesPerAttempt;
    const search = (left: number): boolean => {
      if (left === 0) return true;
      if (--budget < 0) throw new Abort();
      nodes++;
      // Most constrained entry first; ties go to the longer one.
      let best = -1;
      for (let i = 0; i < slots.length; i++) {
        if (assigned[i] >= 0) continue;
        if (best < 0 || counts[i] < counts[best] || (counts[i] === counts[best] && slots[i].entry.cells.length > slots[best].entry.cells.length)) best = i;
      }
      const s = slots[best];
      for (const w of orderCandidates(s, domains, assigned, slots, rng, sample)) {
        const word = s.ix.words[w];
        // One form per word: no AYE and AYES in the same grid.
        if (used.has(word) || used.has(baseForm(word))) continue;
        // Forward check every open crossing, then propagate (arc consistency
        // over the crossings, capped per node).
        const saved: [number, Uint32Array, number][] = [];
        const narrow = (t: number, nd: Uint32Array): boolean => {
          const n = count(nd);
          saved.push([t, domains[t], counts[t]]);
          domains[t] = nd;
          counts[t] = n;
          return n > 0;
        };
        assigned[best] = w;
        let ok = true;
        const queue: number[] = [];
        for (let p = 0; p < s.cross.length && ok; p++) {
          const [t, q] = s.cross[p];
          if (t < 0 || assigned[t] >= 0) continue;
          const bit = slots[t].ix.bits[q * 26 + (word.charCodeAt(p) - 97)];
          const d = domains[t];
          const nd = new Uint32Array(d.length);
          for (let k = 0; k < d.length; k++) nd[k] = d[k] & bit[k];
          ok = narrow(t, nd);
          queue.push(t);
        }
        let revisions = 0;
        while (ok && queue.length && revisions < propagate) {
          const t = queue.shift()!;
          if (counts[t] > PROPAGATE_MAX) continue;
          revisions++;
          const st = slots[t];
          const masks = letterMasks(st.ix, domains[t]);
          for (let q = 0; q < st.cross.length && ok; q++) {
            const [u, q2] = st.cross[q];
            if (u < 0 || assigned[u] >= 0) continue;
            const nd = restrict(slots[u].ix, domains[u], q2, masks[q]);
            if (nd) {
              ok = narrow(u, nd);
              if (!queue.includes(u)) queue.push(u);
            }
          }
        }
        if (ok) {
          used.add(word);
          used.add(baseForm(word));
          if (search(left - 1)) return true;
          used.delete(word);
          used.delete(baseForm(word));
        }
        assigned[best] = -1;
        for (let k = saved.length - 1; k >= 0; k--) {
          const [t, d, n] = saved[k];
          domains[t] = d;
          counts[t] = n;
        }
      }
      return false;
    };
    try {
      if (search(slots.length)) {
        const cells = [...template];
        slots.forEach((s, i) => {
          const word = s.ix.words[assigned[i]];
          s.entry.cells.forEach((c, p) => (cells[c] = word[p]));
        });
        return { grid: cells.join(""), nodes, attempts: attempt + 1 };
      }
    } catch (err) {
      if (!(err instanceof Abort)) throw err;
    }
  }
  return null;
}

/**
 * A seeded sample of the entry's candidates, best first: the ones that leave
 * the crossing entries the most options (sum of log counts), zero-option
 * candidates dropped.
 */
function orderCandidates(s: Slot, domains: Uint32Array[], assigned: number[], slots: Slot[], rng: Rng, sample: number): number[] {
  const all = indexes(domains[slots.indexOf(s)]);
  const picks: number[] = [];
  if (all.length <= sample) picks.push(...all);
  else {
    // Partial Fisher-Yates: `sample` distinct random candidates.
    for (let i = 0; i < sample; i++) {
      const j = i + rng.int(all.length - i);
      [all[i], all[j]] = [all[j], all[i]];
      picks.push(all[i]);
    }
  }
  const scored: [number, number][] = [];
  for (const w of picks) {
    const word = s.ix.words[w];
    let score = 0;
    let dead = false;
    for (let p = 0; p < s.cross.length; p++) {
      const [t, q] = s.cross[p];
      if (t < 0 || assigned[t] >= 0) continue;
      const n = andCount(domains[t], slots[t].ix.bits[q * 26 + (word.charCodeAt(p) - 97)]);
      if (!n) {
        dead = true;
        break;
      }
      score += Math.log(n);
    }
    if (!dead) scored.push([w, score + rng.next() * 0.5]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([w]) => w);
}
