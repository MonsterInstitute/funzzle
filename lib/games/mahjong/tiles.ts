/**
 * The 144-tile Mahjong Solitaire set. Each physical tile has a short, stable
 * id ("5b", "rd", "f2"); tiles match when their match keys are equal, which
 * is the id itself except for flowers and seasons: any flower matches any
 * flower and any season matches any season.
 */

export type Suit = "d" | "b" | "c";

/**
 * "1d".."9d" dots, "1b".."9b" bamboo, "1c".."9c" characters,
 * "we" "ws" "ww" "wn" winds, "rd" "gd" "wd" dragons,
 * "f1".."f4" flowers, "s1".."s4" seasons.
 */
export type TileId = string;

const SUIT_NAMES: Record<Suit, string> = { d: "Dots", b: "Bamboo", c: "Characters" };
const HONOR_NAMES: Record<string, string> = {
  we: "East Wind",
  ws: "South Wind",
  ww: "West Wind",
  wn: "North Wind",
  rd: "Red Dragon",
  gd: "Green Dragon",
  wd: "White Dragon",
};
const FLOWER_NAMES = ["Plum", "Orchid", "Chrysanthemum", "Bamboo Flower"];
const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter"];

/** The 34 kinds that come four of a kind, in display order. */
export const KINDS: readonly TileId[] = Object.freeze([
  ...(["d", "b", "c"] as Suit[]).flatMap((s) => Array.from({ length: 9 }, (_, i) => `${i + 1}${s}`)),
  ...Object.keys(HONOR_NAMES),
]);

export const FLOWERS: readonly TileId[] = Object.freeze(["f1", "f2", "f3", "f4"]);
export const SEASONS: readonly TileId[] = Object.freeze(["s1", "s2", "s3", "s4"]);

/** All 144 tiles: four of each kind, then the four flowers and four seasons. */
export const TILE_SET: readonly TileId[] = Object.freeze([
  ...KINDS.flatMap((k) => [k, k, k, k]),
  ...FLOWERS,
  ...SEASONS,
]);

const VALID = new Set<string>(TILE_SET);

export function isTileId(id: string): id is TileId {
  return VALID.has(id);
}

/** What a tile matches against: "f" for any flower, "s" for any season, else its id. */
export function matchKey(id: TileId): string {
  if (id[0] === "f" || id[0] === "s") return id[0];
  return id;
}

export function tilesMatch(a: TileId, b: TileId): boolean {
  return matchKey(a) === matchKey(b);
}

/** "5 Bamboo", "Red Dragon", "Plum", "Autumn". */
export function tileName(id: TileId): string {
  if (HONOR_NAMES[id]) return HONOR_NAMES[id];
  const n = Number(id[1]);
  if (id[0] === "f") return FLOWER_NAMES[n - 1];
  if (matchKey(id) === "s") return SEASON_NAMES[n - 1];
  return `${id[0]} ${SUIT_NAMES[id[1] as Suit]}`;
}

/** One tile of a match group, for "the third 7 Dots": "7 Dots", "Red Dragon", "Flower". */
export function groupNameOne(id: TileId): string {
  const key = matchKey(id);
  if (key === "f") return "Flower";
  if (key === "s") return "Season";
  return tileName(key);
}

/**
 * The name of a match group in the plural, for sentences such as "the two
 * Red Dragons": "7 Dots", "5 Bamboo", "Red Dragons", "Flowers", "Seasons".
 */
export function groupName(id: TileId): string {
  const key = matchKey(id);
  if (key === "f") return "Flowers";
  if (key === "s") return "Seasons";
  if (HONOR_NAMES[key]) return `${HONOR_NAMES[key]}s`;
  return tileName(key);
}
