"use client";

import { useEffect } from "react";
import { AD_CLIENT, fillUnit, loadAdSense } from "@/lib/ads/adsense";

/**
 * One labeled AdSense display unit. Renders nothing when the publisher id or
 * this placement's unit id isn't configured, so an unconfigured slot never
 * leaves an empty box. `loadScript` still loads AdSense in that case, so a
 * content page keeps whatever Auto ads placements the account has; game
 * screens never pass it.
 */
export default function AdUnit({
  slotId,
  width,
  height,
  format,
  className = "",
  note,
  loadScript = false,
}: {
  slotId: string;
  width: number;
  height: number;
  format?: "rectangle" | "vertical" | "auto";
  className?: string;
  note?: string;
  loadScript?: boolean;
}) {
  const live = Boolean(AD_CLIENT && slotId);
  useEffect(() => {
    if (live) fillUnit();
    else if (loadScript) loadAdSense();
  }, [live, loadScript]);
  if (!live) return null;
  return (
    <aside aria-label="Advertisement" className={`flex flex-col items-center gap-1.5 ${className}`}>
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#8A8A99]">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width, height }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slotId}
        {...(format ? { "data-ad-format": format } : {})}
      />
      {note && <span className="text-xs text-[#8A8A99]">{note}</span>}
    </aside>
  );
}
