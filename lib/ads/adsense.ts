/**
 * AdSense loader shared by display units (components/ads/AdUnit) and the H5
 * Games Ad Placement API (interstitials and rewarded ads, lib/ads/placements).
 *
 * The script is injected on first use only, so a page that shows no ad never
 * loads it: no ads during play on mobile. AdSense Auto ads must stay off for
 * funzzle.com (or exclude /play/*), or Google could place its own ads on a
 * game page once the script is there.
 */

export const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

/** Ad unit ids per placement (AdSense → Ads → By ad unit). A missing id renders nothing. */
export const AD_SLOTS = {
  rectangle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE ?? "",
  inContent: process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT ?? "",
  rail: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL ?? "",
  railNarrow: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL_NARROW ?? "",
} as const;

type AdsQueue = { push: (o: object) => void } & unknown[];
declare global {
  interface Window {
    adsbygoogle?: AdsQueue;
  }
}

let configured = false;

export function loadAdSense(): boolean {
  if (!AD_CLIENT || typeof document === "undefined") return false;
  if (!document.getElementById("adsbygoogle-js")) {
    const s = document.createElement("script");
    s.id = "adsbygoogle-js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
    s.dataset.adClient = AD_CLIENT;
    // At most one interstitial per 90 s, whatever the code asks for.
    s.dataset.adFrequencyHint = "90s";
    // ?adtest=on shows Google's test ads (and never counts impressions).
    if (new URLSearchParams(location.search).get("adtest") === "on") s.dataset.adbreakTest = "on";
    document.head.appendChild(s);
  }
  window.adsbygoogle = window.adsbygoogle || ([] as unknown as AdsQueue);
  if (!configured) {
    configured = true;
    window.adsbygoogle.push({ preloadAdBreaks: "on", sound: "on" });
  }
  return true;
}

/** Request a fill for an <ins class="adsbygoogle"> that was just rendered. */
export function fillUnit(): void {
  if (!loadAdSense()) return;
  try {
    window.adsbygoogle!.push({});
  } catch {
    // Loader not ready yet: AdSense retries on its own.
  }
}

/** H5 Games Ad Placement API call (adBreak). */
export function adBreak(options: Record<string, unknown>): boolean {
  if (!loadAdSense()) return false;
  window.adsbygoogle!.push(options);
  return true;
}
