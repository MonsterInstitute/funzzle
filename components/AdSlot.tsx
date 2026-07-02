type AdSize = {
  width: number;
  height: number;
  /** Responsive visibility utility classes. */
  visibility: string;
  label: string;
};

const SIZES: Record<"leaderboard" | "rectangle" | "mobile-banner", AdSize> = {
  // Hidden on mobile, shown from md up.
  leaderboard: {
    width: 728,
    height: 90,
    visibility: "hidden md:flex",
    label: "leaderboard",
  },
  // Shown at every breakpoint.
  rectangle: {
    width: 300,
    height: 250,
    visibility: "flex",
    label: "rectangle",
  },
  // Shown on mobile only, hidden from md up.
  "mobile-banner": {
    width: 320,
    height: 50,
    visibility: "flex md:hidden",
    label: "mobile-banner",
  },
};

// Replace with your real AdSense publisher + slot IDs.
const AD_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";
const AD_SLOT = "XXXXXXXXXX";

export default function AdSlot({
  slot,
  className = "",
}: {
  slot: keyof typeof SIZES;
  className?: string;
}) {
  const { width, height, visibility } = SIZES[slot];

  return (
    <div className={`${visibility} justify-center ${className}`}>
      <div
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format={slot}
        aria-label="Advertisement"
        className="flex items-center justify-center border border-dashed border-[#d1d5db] bg-[#f3f4f6]"
        style={{
          width: "100%",
          maxWidth: width,
          height,
        }}
      >
        <span className="text-[10px] uppercase tracking-widest text-gray-400">
          Advertisement
        </span>
      </div>
    </div>
  );
}
