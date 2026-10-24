/**
 * Card suits as SVG, so they render the same everywhere (including the share
 * card, whose fonts have no suit glyphs). 24×24 viewBox, filled.
 */
export const SUIT_PATHS: Record<"S" | "H" | "D" | "C", string> = {
  S: "M12 2C9 6.5 4 9.2 4 13.4 4 16 6 18 8.4 18c1.3 0 2.4-.6 3-1.4-.2 2-1 3.6-2.4 5.4h6c-1.4-1.8-2.2-3.4-2.4-5.4.6.8 1.7 1.4 3 1.4C18 18 20 16 20 13.4 20 9.2 15 6.5 12 2z",
  H: "M12 21s-8.5-5.3-8.5-11.2C3.5 6.7 5.8 4.5 8.6 4.5c1.5 0 2.7.7 3.4 1.8.7-1.1 1.9-1.8 3.4-1.8 2.8 0 5.1 2.2 5.1 5.3C20.5 15.7 12 21 12 21z",
  D: "M12 2.5l7.5 9.5-7.5 9.5L4.5 12z",
  C: "M12 3a4.2 4.2 0 0 0-3.3 6.8A4.2 4.2 0 1 0 10.8 17c-.3 1.9-1 3.2-2.3 4.9h7c-1.3-1.7-2-3-2.3-4.9a4.2 4.2 0 1 0 2.1-7.2A4.2 4.2 0 0 0 12 3z",
};

export default function SuitIcon({ suit, size = 14, color = "currentColor" }: { suit: "S" | "H" | "D" | "C"; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={SUIT_PATHS[suit]} fill={color} />
    </svg>
  );
}
