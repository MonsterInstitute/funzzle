import { parseISODate } from "./dates";

export interface DailyCountry {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  /** SVG path in a 0..100 viewBox (simplified silhouette). */
  svg: string;
}

/** Seven daily countries with simplified silhouettes, rotating by weekday. */
export const WORLDLE_DAILY: DailyCountry[] = [
  {
    slug: "france",
    name: "France",
    lat: 46.2,
    lng: 2.2,
    svg: "M45 12 L62 20 L70 34 L64 46 L74 56 L66 70 L52 80 L36 76 L24 62 L22 46 L30 30 L38 18 Z",
  },
  {
    slug: "japan",
    name: "Japan",
    lat: 36.2,
    lng: 138.3,
    svg: "M30 14 L40 20 L42 34 L54 44 L60 58 L72 70 L78 84 L68 88 L58 76 L46 66 L38 52 L28 40 L24 26 Z",
  },
  {
    slug: "italy",
    name: "Italy",
    lat: 41.9,
    lng: 12.6,
    svg: "M30 12 L48 16 L52 28 L46 40 L58 52 L66 68 L74 84 L64 88 L54 74 L44 62 L36 50 L30 36 L26 22 Z",
  },
  {
    slug: "egypt",
    name: "Egypt",
    lat: 26.8,
    lng: 30.8,
    svg: "M20 24 L80 24 L80 62 L58 62 L54 84 L44 84 L44 62 L20 62 Z",
  },
  {
    slug: "brazil",
    name: "Brazil",
    lat: -14.2,
    lng: -51.9,
    svg: "M40 12 L58 18 L70 30 L74 48 L64 66 L52 82 L38 84 L26 70 L20 52 L26 34 L32 20 Z",
  },
  {
    slug: "australia",
    name: "Australia",
    lat: -25.3,
    lng: 133.8,
    svg: "M22 34 L40 26 L58 24 L74 30 L84 44 L78 60 L62 72 L44 74 L28 66 L18 52 Z",
  },
  {
    slug: "india",
    name: "India",
    lat: 22.4,
    lng: 78.7,
    svg: "M28 16 L54 14 L72 22 L70 38 L60 52 L52 70 L46 86 L38 70 L30 54 L24 38 L22 26 Z",
  },
];

export function countryForDate(iso: string): DailyCountry {
  const dow = parseISODate(iso).getUTCDay();
  return WORLDLE_DAILY[dow % WORLDLE_DAILY.length];
}

const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Compass bearing arrow emoji from a to b. */
export function directionArrow(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): string {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  const dirs = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
  return dirs[Math.round(((brng + 360) % 360) / 45) % 8];
}

/** 0–100 proximity score (100 = correct). Earth's max distance ≈ 20000 km. */
export function proximityPct(km: number): number {
  return Math.max(0, Math.round((1 - km / 20000) * 100));
}
