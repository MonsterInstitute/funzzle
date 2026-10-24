import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/content/countries";
import { GEO_SHAPES } from "./data/geoShapes";
import { GEO_ANSWERS, GEO_COUNTRIES } from "./geoData";
import { bearing, compass, distanceKm, findCountry, normalizeName, practiceCountry, proximityPct, scoreGeo, suggestCountries } from "./geo";

const c = (name: string) => findCountry(name, GEO_COUNTRIES)!;

describe("geo", () => {
  it("measures great-circle distance and direction", () => {
    expect(distanceKm(c("France"), c("Spain"))).toBeGreaterThan(700);
    expect(distanceKm(c("France"), c("Spain"))).toBeLessThan(1100);
    expect(compass(bearing(c("France"), c("Spain")))).toBe("SW");
    expect(compass(bearing(c("Egypt"), c("Kenya")))).toBe("S");
    expect(compass(bearing(c("Brazil"), c("Australia")))).toMatch(/^(S|SE|E|SW)$/);
    expect(proximityPct(0)).toBe(100);
    expect(proximityPct(20_000)).toBe(0);
    expect(proximityPct(30_000)).toBe(0);
  });

  it("scores a guess", () => {
    const hit = scoreGeo(c("Kenya"), c("Kenya"));
    expect(hit).toMatchObject({ correct: true, km: 0, pct: 100 });
    const miss = scoreGeo(c("Egypt"), c("Kenya"));
    expect(miss.correct).toBe(false);
    expect(miss.pct).toBeGreaterThan(80);
    expect(miss.pct).toBeLessThan(100);
  });

  it("autocompletes names, accents and spacing aside", () => {
    expect(suggestCountries("ken", GEO_COUNTRIES)[0].name).toBe("Kenya");
    expect(suggestCountries("korea", GEO_COUNTRIES).map((x) => x.name)).toEqual(["North Korea", "South Korea"]);
    expect(suggestCountries("", GEO_COUNTRIES)).toEqual([]);
    expect(normalizeName("Côte d'Ivoire")).toBe("cotedivoire");
    expect(findCountry("united states", GEO_COUNTRIES)?.slug).toBe("united-states");
  });

  it("covers every country, with silhouettes for the answers", () => {
    expect(GEO_COUNTRIES).toHaveLength(COUNTRIES.length);
    for (const slug of GEO_ANSWERS) expect(GEO_SHAPES[slug]).toMatch(/^M\d+ \d+(L\d+ \d+)+Z/);
    // Large countries are answers; microstates aren't.
    for (const big of ["france", "japan", "brazil", "united-states", "russia", "india", "united-kingdom"]) expect(GEO_ANSWERS).toContain(big);
    for (const tiny of ["monaco", "vatican-city", "nauru"]) expect(GEO_ANSWERS).not.toContain(tiny);
    expect(practiceCountry("seed", GEO_COUNTRIES).shape).toBe(true);
  });
});
