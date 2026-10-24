"use client";

import { useSyncExternalStore } from "react";
import { AD_SLOTS } from "@/lib/ads/adsense";
import AdUnit from "./AdUnit";

/**
 * Desktop rail ads beside a game board, pinned to the left and right edges of
 * the game screen, so there are always 90+ px between an ad and the board's
 * column (max 520 px) and nothing overlaps a control. Render it inside a
 * `relative` wrapper around the game only: the rails stick while the game is
 * on screen and scroll away with it, never over the text below.
 *
 * A rail shows only when the viewport leaves GAP px between it and the board:
 * 160×600 from board + 2×(16 + 160 + GAP), 300×600 from board + 2×(16 + 300 +
 * GAP), so ≥ 1024 / 1300 px for the 520 px Game Kit board. Below that nothing
 * is rendered — phones and tablets get no ads during play, and the AdSense
 * script isn't loaded for them.
 */

const GAP = 64;
const minWidth = (board: number, rail: number) => board + 2 * (16 + rail + GAP);

function subscribe(cb: () => void) {
  addEventListener("resize", cb);
  return () => removeEventListener("resize", cb);
}

/** Widest rail that fits beside a `board`-px column. */
export function railFor(viewport: number, board: number): "wide" | "narrow" | "none" {
  if (viewport >= minWidth(board, 300)) return "wide";
  if (viewport >= minWidth(board, 160) && viewport >= 1024) return "narrow";
  return "none";
}

export default function GameRails({ board = 520 }: { board?: number }) {
  const size = useSyncExternalStore(subscribe, () => railFor(innerWidth, board), () => "none" as const);
  if (size === "none") return null;
  const wide = size === "wide";
  const slot = wide ? AD_SLOTS.rail : AD_SLOTS.railNarrow;
  const width = wide ? 300 : 160;
  return (
    <>
      {(["left", "right"] as const).map((side) => (
        <div key={`${side}-${size}`} className="absolute inset-y-0 z-10" style={{ [side]: 16 }}>
          <div className="sticky top-24">
            <AdUnit slotId={slot} width={width} height={600} />
          </div>
        </div>
      ))}
    </>
  );
}
