/**
 * Pixel layout for a Mahjong board: where each tile sits on screen. Layouts
 * use a half-tile grid (lib/games/mahjong/layouts.ts); tiles are taller than
 * wide, and each layer is drawn a little up and to the left with a visible
 * edge on the bottom-right, so stacks read as 3D. The board scales to fit
 * the space it gets, so even the 144-tile Turtle fits a phone's width.
 */
import { getLayout, type LayoutId } from "@/lib/games/mahjong";

/** Tile height / width. */
export const TILE_RATIO = 1.3;
/** Layer offset (up-left per layer) and the tile's edge thickness, as fractions of tile width. */
export const DEPTH_STEP = 0.15;
export const EDGE = 0.14;
/** Tiles never get larger than this, so the board doesn't sprawl on big screens. */
export const MAX_TILE_W = 58;
/** Widest the game column gets (GameShell maxWidth, and GameRails' board width). */
export const MAHJONG_BOARD_MAX = 760;
/** Below this width a tile is fiddly to tap: the game offers a zoom. */
export const COMFORT_TILE_W = 32;

export interface TileBox {
  /** Position index into the layout's cells. */
  p: number;
  left: number;
  top: number;
  z: number;
}

export interface BoardLayout {
  tileW: number;
  tileH: number;
  /** Shift per layer, px. */
  step: number;
  /** Edge thickness, px. */
  edge: number;
  /** Board size, px. */
  width: number;
  height: number;
  /** In drawing order (lower layers first, then top to bottom, left to right). */
  tiles: TileBox[];
}

/** Board size in tile widths for a tile width of 1. */
function extent(id: LayoutId) {
  const l = getLayout(id);
  const extra = (l.depth - 1) * DEPTH_STEP + EDGE;
  return { w: l.width / 2 + extra, h: (l.height / 2) * TILE_RATIO + extra };
}

/** The tile width that fits a board into availW × availH (at zoom 1). */
export function fitTileWidth(id: LayoutId, availW: number, availH = Infinity): number {
  const e = extent(id);
  return Math.max(8, Math.min(MAX_TILE_W, availW / e.w, availH / e.h));
}

/**
 * Lay out a board to fit availW × availH. `zoom` > 1 enlarges it past the
 * fit (the board then scrolls sideways), up to MAX_TILE_W.
 */
export function computeBoard(id: LayoutId, availW: number, availH = Infinity, zoom = 1): BoardLayout {
  const l = getLayout(id);
  const fit = fitTileWidth(id, availW, availH);
  const tileW = Math.floor(Math.min(Math.max(fit, fit * zoom), Math.max(fit, MAX_TILE_W)) * 10) / 10;
  const tileH = Math.round(tileW * TILE_RATIO * 10) / 10;
  const step = tileW * DEPTH_STEP;
  const edge = tileW * EDGE;
  const pad = (l.depth - 1) * step;
  const tiles = l.cells.map((c, p) => ({
    p,
    z: c.z,
    left: pad + (c.x / 2) * tileW - c.z * step,
    top: pad + (c.y / 2) * tileH - c.z * step,
  }));
  return {
    tileW,
    tileH,
    step,
    edge,
    width: Math.ceil(pad + (l.width / 2) * tileW + edge),
    height: Math.ceil(pad + (l.height / 2) * tileH + edge),
    tiles,
  };
}
