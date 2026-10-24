/**
 * Funzzle Word Geo: guess the country from its silhouette in six. Each guess
 * shows the great-circle distance to the answer, the compass direction to
 * head in, and a proximity score. Browser-safe: the country list is passed in
 * by the page (lib/games/word/geoData.ts builds it on the server).
 */
import { createRng } from "@/lib/games/kit/rng";

export const GEO_ROWS = 6;

export interface GeoCountry {
  slug: string;
  name: string;
  /** Africa, Americas, Asia, Europe or Oceania. */
  region: string;
  lat: number;
  lng: number;
  neighbors: string[];
  /** Has a recognisable silhouette, so it can be an answer. */
  shape: boolean;
}

export interface GeoPuzzle {
  slug: string;
  /** Silhouette path in a 0..100 viewBox. */
  shape: string;
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance, km (rounded). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

/** Initial compass bearing from a to b, degrees clockwise from north (0–360). */
export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Compass = (typeof COMPASS)[number];
const COMPASS_WORDS: Record<Compass, string> = { N: "north", NE: "north-east", E: "east", SE: "south-east", S: "south", SW: "south-west", W: "west", NW: "north-west" };
const ARROWS: Record<Compass, string> = { N: "⬆️", NE: "↗️", E: "➡️", SE: "↘️", S: "⬇️", SW: "↙️", W: "⬅️", NW: "↖️" };

export function compass(deg: number): Compass {
  return COMPASS[Math.round(deg / 45) % 8];
}
export const compassWord = (c: Compass) => COMPASS_WORDS[c];
/** Arrow emoji for the shared result text only (the board draws an SVG arrow). */
export const compassEmoji = (c: Compass) => ARROWS[c];

/** 0–100: 100 is the answer, 0 is the far side of the Earth (~20,000 km). */
export function proximityPct(km: number): number {
  return Math.max(0, Math.min(100, Math.round((1 - km / 20_000) * 100)));
}

export interface GeoGuess {
  slug: string;
  name: string;
  km: number;
  /** Degrees; meaningless when correct. */
  deg: number;
  dir: Compass;
  pct: number;
  correct: boolean;
}

export function scoreGeo(guess: GeoCountry, answer: GeoCountry): GeoGuess {
  const correct = guess.slug === answer.slug;
  const km = correct ? 0 : distanceKm(guess, answer);
  const deg = correct ? 0 : bearing(guess, answer);
  return { slug: guess.slug, name: guess.name, km, deg, dir: compass(deg), pct: correct ? 100 : proximityPct(km), correct };
}

/** Lowercase, no accents or punctuation, for matching typed names. */
export const normalizeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** Countries matching what's typed: name prefix first, then word prefix, then substring. */
export function suggestCountries(query: string, countries: readonly GeoCountry[], limit = 5): GeoCountry[] {
  const q = normalizeName(query);
  if (!q) return [];
  const rank = (c: GeoCountry) => {
    const n = normalizeName(c.name);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (c.name.split(/[\s-]+/).some((w) => normalizeName(w).startsWith(q))) return 2;
    if (n.includes(q)) return 3;
    return 9;
  };
  return countries
    .map((c) => ({ c, r: rank(c) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

export function findCountry(name: string, countries: readonly GeoCountry[]): GeoCountry | null {
  const q = normalizeName(name);
  return countries.find((c) => normalizeName(c.name) === q || c.slug === name) ?? null;
}

/** A practice answer from a seed (any country with a silhouette). */
export function practiceCountry(seed: string, countries: readonly GeoCountry[]): GeoCountry {
  const answers = countries.filter((c) => c.shape);
  return answers[createRng(seed).int(answers.length)];
}

const REGION_TEXT: Record<string, string> = { Americas: "the Americas", Africa: "Africa", Asia: "Asia", Europe: "Europe", Oceania: "Oceania" };

export interface GeoHint {
  title: string;
  direction: string;
  specific: string;
  answer: string;
  /** The closest guess so far and where to head from it. */
  from: GeoGuess | null;
}

/** Coach ladder for Geo: continent → a neighbor → the first letter. */
export function geoHint(answer: GeoCountry, guesses: readonly GeoGuess[], countries: readonly GeoCountry[]): GeoHint {
  const region = REGION_TEXT[answer.region] ?? answer.region;
  const closest = guesses.filter((g) => !g.correct).reduce<GeoGuess | null>((a, g) => (!a || g.km < a.km ? g : a), null);
  const head = closest ? ` Your closest guess, ${closest.name}, is ${closest.km.toLocaleString("en-US")} km away: head ${compassWord(closest.dir)} from there.` : "";
  const guessed = new Set(guesses.map((g) => g.name));
  const known = answer.neighbors.filter((n) => countries.some((c) => c.name === n));
  const fresh = known.filter((n) => !guessed.has(n));
  const neighbor = fresh[0] ?? known[0];
  const specific = neighbor
    ? `It shares a border with ${neighbor}${known.length > 1 ? ` and ${known.length - 1} other countr${known.length === 2 ? "y" : "ies"}` : ""}.`
    : `It has no land borders: it's an island country in ${region}.`;
  return {
    title: "Geography",
    direction: `It's in ${region}.${head}`,
    specific,
    answer: `Its name starts with ${answer.name[0]} and has ${normalizeName(answer.name).length} letters.`,
    from: closest,
  };
}
