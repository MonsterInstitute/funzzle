"use client";

import { useEffect } from "react";

/**
 * Renders a live AdSense unit and requests a fill. Only used when a real
 * publisher id is configured via NEXT_PUBLIC_ADSENSE_CLIENT.
 */
export default function AdUnit({
  client,
  slotId,
  format,
  width,
  height,
}: {
  client: string;
  slotId: string;
  format: string;
  width: number;
  height: number;
}) {
  useEffect(() => {
    try {
      // @ts-expect-error adsbygoogle is injected by the AdSense loader script.
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Loader not ready yet — AdSense retries on its own.
    }
  }, []);

  return (
    <ins
      className="adsbygoogle block"
      style={{ display: "inline-block", width: "100%", maxWidth: width, height }}
      data-ad-client={client}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
