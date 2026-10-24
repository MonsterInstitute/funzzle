#!/usr/bin/env node
/**
 * Country silhouettes for Funzzle Word Geo (lib/games/word/data/geoShapes.ts).
 *
 *   node scripts/gen-geo-shapes.mjs
 *
 * Source: datasets/geo-countries (Natural Earth admin-0 boundaries, ODC-PDDL /
 * public domain), pinned to one commit and checked by SHA-256. The download
 * is cached in scripts/.geo-cache/ (gitignored).
 *
 * For every country in lib/content/countries.ts: keep its main landmass plus
 * nearby large islands, project equirectangular with a cos(latitude) x-scale
 * (so shapes aren't stretched), fit into a 0..100 viewBox, simplify, and
 * write integer path coordinates. Countries whose main landmass is too small
 * to recognise (microstates, atolls) get no shape and are never Geo answers;
 * they can still be guessed.
 *
 * Needs Node >= 22.18 (imports the TypeScript country list with type stripping).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES } from "../lib/content/countries.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "scripts/.geo-cache");
const OUT = path.join(ROOT, "lib/games/word/data/geoShapes.ts");
const COMMIT = "72f7d8069cbeef76757b3a49a1c38f8a7b5b5fd0";
const URL = `https://raw.githubusercontent.com/datasets/geo-countries/${COMMIT}/data/countries.geojson`;
const SHA256 = "392a03db8aa3ba82c105852655620129b11182b95dfc34ef046827ea7d0e5b8c";

/** countries.ts name → GeoJSON name, where they differ. */
const ALIAS = {
  Bahamas: "The Bahamas",
  "Cape Verde": "Cabo Verde",
  Eswatini: "eSwatini",
  Micronesia: "Federated States of Micronesia",
  "Sao Tome and Principe": "São Tomé and Principe",
  Serbia: "Republic of Serbia",
  Tanzania: "United Republic of Tanzania",
  "United States": "United States of America",
  "Vatican City": "Vatican",
};

/** Main landmass smaller than this (km²) → no silhouette. */
const MIN_AREA_KM2 = 9000;
const PAD = 6;
/** Douglas-Peucker tolerance in viewBox units. */
const TOLERANCE = 0.7;

async function download() {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `countries-${COMMIT.slice(0, 8)}.geojson`);
  if (!fs.existsSync(file)) {
    console.error(`Downloading ${URL}`);
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const buf = fs.readFileSync(file);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== SHA256) throw new Error(`SHA-256 mismatch for ${file}: ${sha}`);
  return JSON.parse(buf.toString("utf8"));
}

const toRad = (d) => (d * Math.PI) / 180;

/** Approximate ring area in km² (equirectangular, cos-lat corrected). */
function areaKm2(ring) {
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const kx = 111.32 * Math.cos(toRad(lat0));
  const ky = 110.57;
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * kx * ring[i + 1][1] * ky - ring[i + 1][0] * kx * ring[i][1] * ky;
  }
  return Math.abs(a / 2);
}

function centroid(ring) {
  let x = 0;
  let y = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}

function exteriorRings(geom) {
  if (geom.type === "Polygon") return [geom.coordinates[0]];
  if (geom.type === "MultiPolygon") return geom.coordinates.map((p) => p[0]);
  return [];
}

/** Douglas-Peucker on an open polyline. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** A closed ring: split at the point farthest from the start, simplify both halves. */
function simplifyRing(pts, tol) {
  let far = 0;
  let farD = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  return [...simplify(pts.slice(0, far + 1), tol).slice(0, -1), ...simplify(pts.slice(far), tol)];
}

function buildShape(geom) {
  const rings = exteriorRings(geom).map((ring) => ({ ring, area: areaKm2(ring), c: centroid(ring) }));
  rings.sort((a, b) => b.area - a.area);
  const main = rings[0];
  if (!main || main.area < MIN_AREA_KM2) return null;
  // Main landmass, plus islands at least 2% of it within ~1,500 km
  // (Japan's islands, the UK's Northern Ireland, not France's overseas regions).
  const kept = rings.filter(
    (r) => r === main || (r.area >= 0.02 * main.area && Math.hypot(r.c[0] - main.c[0], r.c[1] - main.c[1]) <= 14)
  );
  // Rings crossing the antimeridian (Russia, Fiji): shift negative longitudes east.
  const lngs = kept.flatMap((r) => r.ring.map((p) => p[0]));
  const wrap = Math.max(...lngs) - Math.min(...lngs) > 180;
  const fix = ([lng, lat]) => [wrap && lng < 0 ? lng + 360 : lng, lat];
  const all = kept.map((r) => r.ring.map(fix));
  const lat0 = all.flat().reduce((s, p) => s + p[1], 0) / all.flat().length;
  const kx = Math.cos(toRad(lat0));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lng, lat] of all.flat()) {
    minX = Math.min(minX, lng * kx);
    maxX = Math.max(maxX, lng * kx);
    minY = Math.min(minY, lat);
    maxY = Math.max(maxY, lat);
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min((100 - 2 * PAD) / w, (100 - 2 * PAD) / h);
  const xOff = PAD + (100 - 2 * PAD - w * scale) / 2;
  const yOff = PAD + (100 - 2 * PAD - h * scale) / 2;
  const project = ([lng, lat]) => [xOff + (lng * kx - minX) * scale, yOff + (maxY - lat) * scale];
  const parts = [];
  for (const ring of all) {
    const pts = simplifyRing(ring.map(project), TOLERANCE).map(([x, y]) => [Math.round(x), Math.round(y)]);
    const dedup = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (dedup.length < 4) continue;
    parts.push(`M${dedup.map((p) => p.join(" ")).join("L")}Z`);
  }
  return parts.length ? { path: parts.join(""), area: Math.round(main.area) } : null;
}

async function main() {
  const geo = await download();
  const byName = new Map(geo.features.map((f) => [f.properties.name, f]));
  const shapes = {};
  const skipped = [];
  for (const c of COUNTRIES) {
    const feat = byName.get(ALIAS[c.name] ?? c.name);
    if (!feat) throw new Error(`no GeoJSON feature for ${c.name}`);
    const shape = buildShape(feat.geometry);
    if (shape) shapes[c.slug] = shape.path;
    else skipped.push(c.name);
  }
  const body = `// GENERATED by scripts/gen-geo-shapes.mjs — do not edit.
// Country silhouettes in a 0..100 viewBox from datasets/geo-countries
// (Natural Earth, public domain) @ ${COMMIT.slice(0, 8)}. ${Object.keys(shapes).length} countries;
// the rest are too small to recognise and are never Geo answers.
export const GEO_SHAPES: Record<string, string> = ${JSON.stringify(shapes, null, 0).replace(/","/g, '",\n  "').replace(/^\{/, "{\n  ").replace(/\}$/, ",\n}")};
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);
  console.error(`Wrote ${Object.keys(shapes).length} shapes (${body.length} bytes) to ${path.relative(ROOT, OUT)}`);
  console.error(`No shape (too small): ${skipped.join(", ")}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
