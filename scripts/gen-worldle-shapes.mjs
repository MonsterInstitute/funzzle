/**
 * Build real country silhouettes for Worldle from GeoJSON.
 * Fetches the datasets/geo-countries file, extracts the 7 daily countries,
 * filters to their main landmasses, projects to a 0..100 viewBox (equirect,
 * per-country bbox fit, Y flipped), simplifies, and writes
 * lib/content/worldleShapes.ts.
 *
 * Run:  node scripts/gen-worldle-shapes.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "lib", "content", "worldleShapes.ts");
const URL =
  "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

// slug -> { iso3, names[], centroid [lng,lat] }
const TARGETS = {
  france: { iso: "FRA", names: ["France"], c: [2.2, 46.2] },
  japan: { iso: "JPN", names: ["Japan"], c: [138.3, 36.2] },
  italy: { iso: "ITA", names: ["Italy"], c: [12.6, 41.9] },
  egypt: { iso: "EGY", names: ["Egypt"], c: [30.8, 26.8] },
  brazil: { iso: "BRA", names: ["Brazil"], c: [-51.9, -14.2] },
  australia: { iso: "AUS", names: ["Australia"], c: [133.8, -25.3] },
  india: { iso: "IND", names: ["India"], c: [78.7, 22.4] },
};

const PAD = 8;
const EPS = 0.45; // simplification threshold in viewBox units

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a / 2);
}
function ringCentroid(ring) {
  let x = 0, y = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}
function degDist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Exterior rings from a Polygon or MultiPolygon geometry. */
function exteriorRings(geom) {
  if (geom.type === "Polygon") return [geom.coordinates[0]];
  if (geom.type === "MultiPolygon") return geom.coordinates.map((p) => p[0]);
  return [];
}

function buildPath(rings, centroid) {
  // Keep the biggest ring, plus other rings that are large-ish AND near it.
  const scored = rings.map((r) => ({
    ring: r,
    area: ringArea(r),
    dist: degDist(ringCentroid(r), centroid),
  }));
  const maxArea = Math.max(...scored.map((s) => s.area));
  const kept = scored.filter(
    (s) => s.area === maxArea || (s.area >= 0.012 * maxArea && s.dist <= 25)
  );

  // Combined bbox.
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const { ring } of kept) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const w = maxLng - minLng || 1;
  const h = maxLat - minLat || 1;
  const scale = Math.min((100 - 2 * PAD) / w, (100 - 2 * PAD) / h);
  const xOff = PAD + (100 - 2 * PAD - w * scale) / 2;
  const yOff = PAD + (100 - 2 * PAD - h * scale) / 2;
  const project = ([lng, lat]) => [
    +(xOff + (lng - minLng) * scale).toFixed(1),
    +(yOff + (maxLat - lat) * scale).toFixed(1), // flip Y
  ];

  // Largest first so the fill reads as one silhouette.
  kept.sort((a, b) => b.area - a.area);

  const subpaths = [];
  for (const { ring } of kept) {
    const pts = ring.map(project);
    // Simplify: drop points closer than EPS to the last kept point.
    const simp = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = simp[simp.length - 1];
      if (Math.hypot(pts[i][0] - px, pts[i][1] - py) >= EPS) simp.push(pts[i]);
    }
    if (simp.length < 3) continue;
    let d = `M${simp[0][0]} ${simp[0][1]}`;
    for (let i = 1; i < simp.length; i++) d += `L${simp[i][0]} ${simp[i][1]}`;
    subpaths.push(d + "Z");
  }
  return subpaths.join("");
}

async function main() {
  console.error("Fetching GeoJSON (~25MB)…");
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const geo = await res.json();
  console.error(`Loaded ${geo.features.length} features.`);

  const shapes = {};
  for (const [slug, t] of Object.entries(TARGETS)) {
    const feat = geo.features.find((f) => {
      const p = f.properties || {};
      const iso =
        p.ISO_A3 || p["ISO3166-1-Alpha-3"] || p.iso_a3 || p.ADM0_A3;
      const name = p.ADMIN || p.name || p.NAME || p.admin || p.SOVEREIGNT;
      return iso === t.iso || (name && t.names.includes(name));
    });
    if (!feat) {
      throw new Error(`Country not found: ${slug} (${t.iso})`);
    }
    const rings = exteriorRings(feat.geometry);
    const path = buildPath(rings, t.c);
    shapes[slug] = path;
    console.error(`${slug}: ${rings.length} rings → path ${path.length} chars`);
  }

  const body = `// Auto-generated country silhouettes for Worldle, projected from
// datasets/geo-countries GeoJSON into a 0..100 viewBox (Y flipped).
export const WORLDLE_SHAPES: Record<string, string> = ${JSON.stringify(shapes, null, 2)};
`;
  writeFileSync(OUT, body);
  console.error(`\nWrote ${OUT}`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
