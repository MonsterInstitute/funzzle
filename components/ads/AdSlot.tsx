import { AD_SLOTS } from "@/lib/ads/adsense";
import AdUnit from "./AdUnit";

/**
 * Content-page and recap placements (never on a game screen during play):
 *   rectangle   300×250, the game recap and the homepage below the fold
 *   in-content  300×250 between sections of an article or answer page;
 *               keep 40 px+ from any button or reveal control (my-10)
 */
export default function AdSlot({ slot, className = "", note }: { slot: "rectangle" | "in-content"; className?: string; note?: string }) {
  return (
    <AdUnit
      slotId={slot === "rectangle" ? AD_SLOTS.rectangle : AD_SLOTS.inContent}
      width={300}
      height={250}
      className={className}
      note={note}
      loadScript
    />
  );
}
