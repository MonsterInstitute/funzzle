/**
 * Server-side Geo data: the 195 countries of lib/content/countries.ts in the
 * compact shape the board needs, and the daily answer schedule. Silhouettes
 * (lib/games/word/data/geoShapes.ts, ~33 KB gzip) stay out of the page
 * bundle: the page passes only today's shape, and practice loads the file on
 * demand.
 */
import { COUNTRIES } from "@/lib/content/countries";
import { GEO_SHAPES } from "./data/geoShapes";
import type { GeoCountry, GeoPuzzle } from "./geo";
import { dayIndex, maxGap, scheduledIndex } from "./schedule";

export const GEO_COUNTRIES: GeoCountry[] = COUNTRIES.map((c) => ({
  slug: c.slug,
  name: c.name,
  region: c.region,
  lat: c.lat,
  lng: c.lng,
  neighbors: c.neighbors,
  shape: !!GEO_SHAPES[c.slug],
})).sort((a, b) => a.name.localeCompare(b.name));

/** Countries that can be answers, in a fixed order (the schedule indexes it). */
export const GEO_ANSWERS = COUNTRIES.map((c) => c.slug).filter((s) => GEO_SHAPES[s]).sort();

/**
 * Today's country. The pool (~160) is smaller than a year, so each country
 * comes back about every 160 days, and never within GEO_GAP days.
 */
export const GEO_GAP = maxGap(GEO_ANSWERS.length);

export function geoAnswer(date: string): GeoPuzzle {
  const slug = GEO_ANSWERS[scheduledIndex("word:geo", GEO_ANSWERS.length, dayIndex(date), GEO_GAP)];
  return { slug, shape: GEO_SHAPES[slug] };
}
