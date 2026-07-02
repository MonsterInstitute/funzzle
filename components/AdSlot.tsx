import AdUnit from "./AdUnit";

type AdSize = {
  width: number;
  height: number;
  /** Responsive visibility utility classes. */
  visibility: string;
  /** AdSense format hint. */
  format: string;
};

const SIZES: Record<
  "leaderboard" | "rectangle" | "mobile-banner",
  AdSize
> = {
  // Hidden on mobile, shown from md up.
  leaderboard: {
    width: 728,
    height: 90,
    visibility: "hidden md:flex",
    format: "horizontal",
  },
  // Shown at every breakpoint (used for sidebar, in-content, post-content).
  rectangle: {
    width: 300,
    height: 250,
    visibility: "flex",
    format: "rectangle",
  },
  // Shown on mobile only, hidden from md up.
  "mobile-banner": {
    width: 320,
    height: 50,
    visibility: "flex md:hidden",
    format: "horizontal",
  },
};

// Per-placement slot ids. Replace the placeholders with real AdSense slot ids.
const SLOT_IDS: Record<keyof typeof SIZES, string> = {
  leaderboard: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD ?? "0000000001",
  rectangle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE ?? "0000000002",
  "mobile-banner":
    process.env.NEXT_PUBLIC_ADSENSE_SLOT_MOBILE ?? "0000000003",
};

// When a real publisher id is set, live ads render; otherwise a labeled
// placeholder keeps layout stable during development.
const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

export default function AdSlot({
  slot,
  className = "",
}: {
  slot: keyof typeof SIZES;
  className?: string;
}) {
  const { width, height, visibility, format } = SIZES[slot];
  const slotId = SLOT_IDS[slot];

  return (
    <div className={`${visibility} justify-center ${className}`}>
      {AD_CLIENT ? (
        <AdUnit
          client={AD_CLIENT}
          slotId={slotId}
          format={format}
          width={width}
          height={height}
        />
      ) : (
        <div
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
          data-ad-slot={slotId}
          data-ad-format={format}
          aria-label="Advertisement"
          className="flex items-center justify-center border border-dashed border-[#d1d5db] bg-[#f3f4f6]"
          style={{ width: "100%", maxWidth: width, height }}
        >
          <span className="text-[10px] uppercase tracking-widest text-gray-400">
            Advertisement
          </span>
        </div>
      )}
    </div>
  );
}
