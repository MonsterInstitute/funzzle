/**
 * Funzzle's own chess pieces: flat, geometric silhouettes drawn for this
 * game (45×45 viewBox), white pieces in white with an ink outline, black
 * pieces in ink with light detail lines.
 */
import type { PieceCode } from "@/lib/games/chess";

const BODY: Record<string, string> = {
  // Round head on a flared stem.
  P: "M22.5 8.5a5.5 5.5 0 0 1 3.4 9.8c2.6 1.6 4.1 4.2 4.6 7.7h-16c.5-3.5 2-6.1 4.6-7.7a5.5 5.5 0 0 1 3.4-9.8zM13 30h19l2 6H11z",
  // Squared tower with three merlons.
  R: "M11.5 9h5v3.5h3.5V9h5v3.5h3.5V9h5v7.5l-3 2.5 1.5 11h-19l1.5-11-3-2.5zM10 32h25v4.5H10z",
  // Tall mitre with a ball finial.
  B: "M22.5 4.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM22.5 10c4.6 3.8 8 8.3 7.2 13.2-.5 2.9-2.4 4.8-4.6 5.6h-5.2c-2.2-.8-4.1-2.7-4.6-5.6-.8-4.9 2.6-9.4 7.2-13.2zM15 30h15v2.5H15zM11 34h23l1 3H10z",
  // Horse head in profile: muzzle left, mane right.
  N: "M14 37h20c.3-7-.4-13.6-3.3-18.6-2.2-3.8-5.6-6.4-9.7-7.4l-1.5-3.8-2.3 4.3c-3.6 2.4-6.2 5.9-7.7 10.2-.4 1.2 0 2.3 1 2.8l2.4 1.2c.9.4 1.9.2 2.6-.5l2.6-2.6 3.3-.6c-1.6 2.8-4.6 5.2-7.4 7.4-1.4 1.1-2 2.6-2 4.3z",
  // Crown with five points.
  Q: "M8 12.5a2.3 2.3 0 1 1 0 .1zM15.3 9a2.3 2.3 0 1 1 0 .1zM22.5 7.5a2.3 2.3 0 1 1 0 .1zM29.7 9a2.3 2.3 0 1 1 0 .1zM37 12.5a2.3 2.3 0 1 1 0 .1zM9.5 16l5.5 7 1-10.5 4.5 9.5 2-11.5 2 11.5 4.5-9.5 1 10.5 5.5-7-3.5 15h-19zM11 33h23l1.5 4h-26z",
  // Cross on a rounded body.
  K: "M21 3.5h3v3.2h3.2v3H24v3.6h-3V9.7h-3.2v-3H21zM22.5 14c2.4 0 4.1 1.6 4.6 4 3.6-2.6 9-1.6 9.6 3.3.4 3.4-2 6.5-5 9.2H13.3c-3-2.7-5.4-5.8-5-9.2.6-4.9 6-5.9 9.6-3.3.5-2.4 2.2-4 4.6-4zM11 32.5h23l1.5 4.5h-26z",
};

/** Detail strokes drawn on top (eye, slit, bands). */
const DETAIL: Record<string, string> = {
  P: "M16 30h13",
  R: "M14 19h17M13.5 30h18",
  B: "M24.5 14.5l-4 5M15 30h15",
  N: "M17.2 15.6h.1M22 11.5c3.6 1.6 6.4 5.6 7.4 11",
  Q: "M14 29h17",
  K: "M22.5 18.5v12M13.5 30h18",
};

export function PieceSvg({ code, size }: { code: PieceCode; size?: number | string }) {
  const white = code[0] === "w";
  const t = code[1];
  return (
    <svg viewBox="0 0 45 45" width={size} height={size} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <path d={BODY[t]} fill={white ? "#FFFFFF" : "#26221F"} stroke="#111111" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={DETAIL[t]} fill="none" stroke={white ? "#111111" : "#F7F3EC"} strokeWidth={t === "N" ? 1.6 : 1.4} strokeLinecap="round" strokeLinejoin="round" opacity={white ? 0.75 : 0.85} />
    </svg>
  );
}
