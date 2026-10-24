import type { ReactNode } from "react";
import type { TileId } from "@/lib/games/mahjong";

/**
 * Original, simple tile faces drawn in SVG (no traditional tile artwork):
 * dots are coins, bamboo are sticks, characters are a red numeral over a
 * seal mark, winds are a compass letter with an arrow, the three dragons are
 * a red disc, a green diamond and a blue frame, flowers share one flower
 * shape and seasons one ringed badge, each numbered 1–4.
 */

const VB_W = 60;
const VB_H = 78;

const DOT = "#2456A6";
const BAMBOO = "#1F7A4D";
const CHAR = "#C8102E";
const INK = "#111111";

/** Pip centres per count for dots and bamboo. */
const PIPS: Record<number, [number, number][]> = {
  1: [[30, 44]],
  2: [
    [30, 30],
    [30, 58],
  ],
  3: [
    [18, 27],
    [30, 44],
    [42, 61],
  ],
  4: [
    [20, 31],
    [40, 31],
    [20, 57],
    [40, 57],
  ],
  5: [
    [19, 29],
    [41, 29],
    [30, 44],
    [19, 59],
    [41, 59],
  ],
  6: [
    [21, 27],
    [39, 27],
    [21, 44],
    [39, 44],
    [21, 61],
    [39, 61],
  ],
  7: [
    [16, 24],
    [30, 30],
    [44, 36],
    [21, 51],
    [39, 51],
    [21, 65],
    [39, 65],
  ],
  8: [
    [21, 23],
    [39, 23],
    [21, 38],
    [39, 38],
    [21, 53],
    [39, 53],
    [21, 68],
    [39, 68],
  ],
  9: [
    [17, 27],
    [30, 27],
    [43, 27],
    [17, 44],
    [30, 44],
    [43, 44],
    [17, 61],
    [30, 61],
    [43, 61],
  ],
};

const pipR = (n: number) => (n === 1 ? 13 : n <= 4 ? 7.5 : n <= 6 ? 6.6 : 5.6);

function Corner({ n, color }: { n: number | string; color: string }) {
  return (
    <text x="6" y="15" fontSize="13" fontWeight="800" fill={color} fontFamily="system-ui, sans-serif">
      {n}
    </text>
  );
}

function Dots({ n }: { n: number }) {
  const r = pipR(n);
  return (
    <>
      <Corner n={n} color={DOT} />
      {PIPS[n].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={DOT} />
          <circle cx={x} cy={y} r={r * 0.45} fill="#FFFDF7" />
          {n === 1 && <circle cx={x} cy={y} r={r * 0.22} fill={BAMBOO} />}
        </g>
      ))}
    </>
  );
}

function Bamboo({ n }: { n: number }) {
  if (n === 1) {
    return (
      <>
        <Corner n={1} color={BAMBOO} />
        <rect x="25" y="20" width="10" height="50" rx="5" fill={BAMBOO} />
        <path d="M25 37h10M25 53h10" stroke="#FFFDF7" strokeWidth="2" />
        <path d="M35 32c8-6 12-4 14 0-6 1-10 3-14 4zM25 46c-8-6-12-4-14 0 6 1 10 3 14 4z" fill={BAMBOO} />
      </>
    );
  }
  const h = n >= 7 ? 12 : n >= 5 ? 14 : 18;
  const w = n >= 7 ? 5 : 6;
  return (
    <>
      <Corner n={n} color={BAMBOO} />
      {PIPS[n].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill={n === 5 && i === 2 ? CHAR : BAMBOO} />
          <path d={`M${x - w / 2} ${y}h${w}`} stroke="#FFFDF7" strokeWidth="1.4" />
        </g>
      ))}
    </>
  );
}

function Characters({ n }: { n: number }) {
  return (
    <>
      <text x="30" y="46" textAnchor="middle" fontSize="34" fontWeight="800" fill={CHAR} fontFamily="system-ui, sans-serif">
        {n}
      </text>
      {/* An original "character" seal mark, not a real glyph. */}
      <path d="M17 56h26M21 56v10M39 56v10M17 66h26M26 61h8" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </>
  );
}

const ARROWS: Record<string, string> = {
  wn: "M30 13l-6 7h12z",
  ws: "M30 73l-6-7h12z",
  we: "M53 44l-7-6v12z",
  ww: "M7 44l7-6v12z",
};

function Wind({ id }: { id: string }) {
  const letter = { wn: "N", we: "E", ws: "S", ww: "W" }[id] ?? "?";
  return (
    <>
      <circle cx="30" cy="44" r="17" fill="none" stroke={INK} strokeWidth="1.6" opacity="0.35" />
      <text x="30" y="55" textAnchor="middle" fontSize="30" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">
        {letter}
      </text>
      <path d={ARROWS[id]} fill={INK} />
    </>
  );
}

function Dragon({ id }: { id: string }) {
  if (id === "rd") {
    return (
      <>
        <circle cx="30" cy="40" r="18" fill={CHAR} />
        <circle cx="30" cy="40" r="8" fill="#FFFDF7" />
        <circle cx="30" cy="40" r="3.5" fill={CHAR} />
      </>
    );
  }
  if (id === "gd") {
    return (
      <>
        <path d="M30 18l20 22-20 22-20-22z" fill={BAMBOO} />
        <path d="M30 30l9 10-9 10-9-10z" fill="#FFFDF7" />
      </>
    );
  }
  return (
    <>
      <rect x="12" y="20" width="36" height="42" rx="4" fill="none" stroke={DOT} strokeWidth="3.4" />
      <rect x="19" y="27" width="22" height="28" rx="2" fill="none" stroke={DOT} strokeWidth="2" />
    </>
  );
}

const PETALS = ["#D6337F", "#7B4BD6", "#E0761C", "#C2378A"];

function Flower({ n }: { n: number }) {
  const color = PETALS[n - 1];
  const petals: [number, number][] = [
    [30, 28],
    [41, 36],
    [37, 49],
    [23, 49],
    [19, 36],
  ];
  return (
    <>
      <Corner n={n} color={color} />
      <path d="M30 52c0 8-2 14-6 18M30 62c5-4 10-4 13-2" stroke={BAMBOO} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {petals.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7.5" fill={color} />
      ))}
      <circle cx="30" cy="40" r="5.5" fill="#F2B233" />
    </>
  );
}

const SEASON_ICONS: Record<number, ReactNode> = {
  // Spring: a sprout.
  1: <path d="M30 56V40M30 44c-8 0-11-5-11-10 6 0 11 3 11 10zM30 40c0-8 5-11 11-11 0 6-3 11-11 11z" stroke={BAMBOO} strokeWidth="2.2" fill={BAMBOO} strokeLinejoin="round" />,
  // Summer: a sun.
  2: (
    <g stroke="#E0761C" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="30" cy="44" r="7" fill="#F2B233" />
      <path d="M30 29v4M30 55v4M15 44h4M41 44h4M19.5 33.5l2.8 2.8M37.7 51.7l2.8 2.8M40.5 33.5l-2.8 2.8M22.3 51.7l-2.8 2.8" />
    </g>
  ),
  // Autumn: a falling leaf.
  3: <path d="M20 56c0-14 8-24 22-26-1 14-9 24-22 26zM20 56l12-14" stroke="#B8541A" strokeWidth="2" fill="#E0761C" strokeLinejoin="round" />,
  // Winter: a snowflake.
  4: (
    <g stroke={DOT} strokeWidth="2.4" strokeLinecap="round" fill="none">
      <path d="M30 30v28M17.9 37l24.2 14M17.9 51l24.2-14" />
      <path d="M26 32l4 3 4-3M26 56l4-3 4 3" />
    </g>
  ),
};

function Season({ n }: { n: number }) {
  return (
    <>
      <Corner n={n} color="#8A3605" />
      <circle cx="30" cy="44" r="19" fill="#FFF1D6" stroke="#E0A040" strokeWidth="2" />
      {SEASON_ICONS[n]}
    </>
  );
}

function Face({ id }: { id: TileId }) {
  const n = Number(id[0]);
  if (n >= 1 && n <= 9) {
    if (id[1] === "d") return <Dots n={n} />;
    if (id[1] === "b") return <Bamboo n={n} />;
    return <Characters n={n} />;
  }
  if (id[0] === "w" && id !== "wd") return <Wind id={id} />;
  if (id === "rd" || id === "gd" || id === "wd") return <Dragon id={id} />;
  if (id[0] === "f") return <Flower n={Number(id[1])} />;
  return <Season n={Number(id[1])} />;
}

/** The face of one tile, filling its box. Decorative: the button carries the name. */
export default function TileFace({ id }: { id: TileId }) {
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <Face id={id} />
    </svg>
  );
}
