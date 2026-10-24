/**
 * Original pictures for the jigsaw, drawn from the seed: landscapes (day,
 * sunset, night, autumn) and geometric art (blocks, sunburst, waves). The
 * result is a standalone SVG document string (PIC_W × PIC_H), so the same seed
 * always draws the same picture on the server and in the browser, and no
 * outside image is ever used.
 *
 * Pictures are built from big, distinct regions (sky, ridges, water, shapes)
 * with small details on top, so a player can tell pieces apart.
 */
import { createRng, type Rng } from "@/lib/games/kit/rng";
import { PIC_H, PIC_W } from "./cut";

export type Theme = "day" | "sunset" | "night" | "autumn" | "blocks" | "sunburst" | "waves";
export const THEMES: Theme[] = ["day", "sunset", "night", "autumn", "blocks", "sunburst", "waves"];

export interface Picture {
  theme: Theme;
  /** Short title, e.g. "Sunset over the ridge". */
  name: string;
  svg: string;
}

const W = PIC_W;
const H = PIC_H;
const f = (n: number) => String(Math.round(n * 10) / 10);
const between = (rng: Rng, lo: number, hi: number) => lo + rng.next() * (hi - lo);
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[rng.int(items.length)];

interface LandPalette {
  sky: [string, string];
  sun: string;
  glow: string;
  ridges: string[];
  water: string;
  shine: string;
  trees: string[];
  houses: string[];
  roof: string;
  cloud: string;
}

const LAND: Record<"day" | "sunset" | "night" | "autumn", LandPalette> = {
  day: {
    sky: ["#5DB7F5", "#D6EEFF"],
    sun: "#FFD23F",
    glow: "#FFF3B0",
    ridges: ["#A9C4F0", "#7E9BE0", "#7FD6A0", "#47A86F", "#2F7A4D"],
    water: "#3E9BE0",
    shine: "#B9E2FF",
    trees: ["#1F5E3A", "#2E7D4B"],
    houses: ["#FF9E9E", "#FFE066", "#FFFFFF"],
    roof: "#C8553D",
    cloud: "#FFFFFF",
  },
  sunset: {
    sky: ["#FF6F61", "#FFC48C"],
    sun: "#FFE066",
    glow: "#FFD9A0",
    ridges: ["#C77DA3", "#9A4F86", "#6B2F6B", "#4A1F55", "#2C1238"],
    water: "#D9738A",
    shine: "#FFD0A8",
    trees: ["#1E0D29", "#2C1238"],
    houses: ["#FFC857", "#FF9E9E", "#F3E3FF"],
    roof: "#2C1238",
    cloud: "#FFD6C2",
  },
  night: {
    sky: ["#081A3A", "#35558F"],
    sun: "#F4F1DE",
    glow: "#8FA8D8",
    ridges: ["#3F5F96", "#2C4877", "#1E365E", "#142847", "#0B1A33"],
    water: "#1F3D72",
    shine: "#C9D6F2",
    trees: ["#071226", "#0E1F3D"],
    houses: ["#FFE066", "#FFC857", "#FFD6A5"],
    roof: "#071226",
    cloud: "#5C76A8",
  },
  autumn: {
    sky: ["#8ED1E8", "#FDEBC8"],
    sun: "#FFB547",
    glow: "#FFE7B8",
    ridges: ["#B7C7D9", "#E9A23B", "#D9773A", "#B8492F", "#6B3E26"],
    water: "#5AA9C9",
    shine: "#D8F0F8",
    trees: ["#C8102E", "#E9A23B", "#8C2F1B"],
    houses: ["#FFF4DD", "#FFE066", "#9DB4FF"],
    roof: "#5B3DF5",
    cloud: "#FFFFFF",
  },
};

const LAND_NAMES: Record<keyof typeof LAND, string[]> = {
  day: ["Morning in the valley", "A clear day in the hills", "Lakeside morning"],
  sunset: ["Sunset over the ridge", "Evening in the hills", "Last light on the lake"],
  night: ["Moonlit hills", "A quiet night in the valley", "Stars over the lake"],
  autumn: ["Autumn village", "Fall colors in the hills", "October afternoon"],
};

/** A ridge line across the picture as points; smooth hills or jagged peaks. */
function ridge(rng: Rng, base: number, amp: number, jagged: boolean): [number, number][] {
  const pts: [number, number][] = [];
  let x = -30;
  while (x < W + 60) {
    pts.push([x, base - rng.next() * amp]);
    x += jagged ? between(rng, 40, 90) : between(rng, 90, 170);
  }
  return pts;
}

function ridgePath(pts: [number, number][], jagged: boolean): string {
  let d = `M${f(pts[0][0])} ${H + 10}L${f(pts[0][0])} ${f(pts[0][1])}`;
  if (jagged) {
    for (const [x, y] of pts.slice(1)) d += `L${f(x)} ${f(y)}`;
  } else {
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [x, y] = pts[i];
      d += `C${f(px + (x - px) / 2)} ${f(py)} ${f(px + (x - px) / 2)} ${f(y)} ${f(x)} ${f(y)}`;
    }
  }
  return `${d}L${f(pts[pts.length - 1][0])} ${H + 10}Z`;
}

/** Height of a ridge at x (linear between its points: close enough to place things on it). */
function ridgeY(pts: [number, number][], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= x) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

function cloud(rng: Rng, color: string, opacity: number): string {
  const cx = between(rng, 20, W - 20);
  const cy = between(rng, 30, 130);
  const s = between(rng, 0.7, 1.4);
  const parts = [
    [0, 0, 40, 16],
    [-28, 6, 26, 12],
    [26, 6, 30, 13],
    [-6, -10, 24, 14],
  ];
  return `<g fill="${color}" opacity="${opacity}">${parts
    .map(([dx, dy, rx, ry]) => `<ellipse cx="${f(cx + dx * s)}" cy="${f(cy + dy * s)}" rx="${f(rx * s)}" ry="${f(ry * s)}"/>`)
    .join("")}</g>`;
}

function pine(x: number, y: number, h: number, color: string): string {
  const w = h * 0.45;
  return (
    `<rect x="${f(x - h * 0.05)}" y="${f(y - h * 0.18)}" width="${f(h * 0.1)}" height="${f(h * 0.2)}" fill="#4A2E1F"/>` +
    `<path d="M${f(x)} ${f(y - h)}L${f(x + w / 2)} ${f(y - h * 0.15)}L${f(x - w / 2)} ${f(y - h * 0.15)}Z" fill="${color}"/>`
  );
}

function roundTree(x: number, y: number, h: number, color: string): string {
  return (
    `<rect x="${f(x - h * 0.06)}" y="${f(y - h * 0.4)}" width="${f(h * 0.12)}" height="${f(h * 0.42)}" fill="#5A3A22"/>` +
    `<circle cx="${f(x)}" cy="${f(y - h * 0.62)}" r="${f(h * 0.36)}" fill="${color}"/>`
  );
}

function house(x: number, y: number, s: number, wall: string, roof: string, lit: boolean): string {
  const w = 34 * s;
  const h = 24 * s;
  const win = lit ? "#FFE066" : "#5B6B8C";
  return (
    `<rect x="${f(x - w / 2)}" y="${f(y - h)}" width="${f(w)}" height="${f(h + 4)}" fill="${wall}"/>` +
    `<path d="M${f(x - w / 2 - 4 * s)} ${f(y - h)}L${f(x)} ${f(y - h - 18 * s)}L${f(x + w / 2 + 4 * s)} ${f(y - h)}Z" fill="${roof}"/>` +
    `<rect x="${f(x - w / 2 + 5 * s)}" y="${f(y - h + 6 * s)}" width="${f(8 * s)}" height="${f(8 * s)}" fill="${win}"/>` +
    `<rect x="${f(x + 3 * s)}" y="${f(y - h + 10 * s)}" width="${f(8 * s)}" height="${f(h - 6 * s)}" fill="${roof}"/>`
  );
}

function landscape(rng: Rng, theme: keyof typeof LAND): string {
  const p = LAND[theme];
  const out: string[] = [];
  out.push(
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>` +
      `<radialGradient id="glow"><stop offset="0" stop-color="${p.glow}" stop-opacity="0.9"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient></defs>`
  );
  out.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);
  if (theme === "night") {
    for (let i = 0; i < 70; i++) {
      out.push(`<circle cx="${f(rng.next() * W)}" cy="${f(rng.next() * 210)}" r="${f(between(rng, 0.6, 2))}" fill="#FFFFFF" opacity="${f(between(rng, 0.4, 1))}"/>`);
    }
  }
  const sunX = between(rng, 70, W - 70);
  const sunY = theme === "sunset" ? between(rng, 150, 200) : between(rng, 50, 120);
  const sunR = between(rng, 26, 42);
  out.push(`<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(sunR * 2.6)}" fill="url(#glow)"/>`);
  out.push(`<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(sunR)}" fill="${p.sun}"/>`);
  if (theme === "night") out.push(`<circle cx="${f(sunX + sunR * 0.45)}" cy="${f(sunY - sunR * 0.25)}" r="${f(sunR * 0.85)}" fill="${p.sky[0]}" opacity="0.92"/>`);
  if (theme === "sunset") {
    for (let i = 0; i < 4; i++) out.push(`<rect x="0" y="${f(sunY - 20 + i * 14)}" width="${W}" height="3" fill="${p.sky[0]}" opacity="0.35"/>`);
  }
  const clouds = theme === "night" ? 2 : 2 + rng.int(3);
  for (let i = 0; i < clouds; i++) out.push(cloud(rng, p.cloud, theme === "night" ? 0.35 : 0.9));

  const lake = rng.next() < 0.55;
  const waterTop = lake ? between(rng, 270, 300) : H + 20;
  // Far mountains (jagged), then rolling hills; the last ridges stop at the lake.
  const layers = [
    { base: between(rng, 200, 230), amp: between(rng, 70, 110), jagged: true },
    { base: between(rng, 240, 262), amp: between(rng, 40, 70), jagged: true },
    { base: between(rng, 280, 300), amp: between(rng, 30, 55), jagged: false },
  ];
  const ridges = layers.map((l) => ridge(rng, l.base, l.amp, l.jagged));
  ridges.forEach((pts, i) => {
    out.push(`<path d="${ridgePath(pts, layers[i].jagged)}" fill="${p.ridges[i]}"/>`);
    if (i === 0 && theme !== "sunset") {
      // Snow caps on the far peaks.
      for (const [x, y] of pts) {
        if (y < layers[0].base - layers[0].amp * 0.55) {
          out.push(`<path d="M${f(x)} ${f(y)}L${f(x + 14)} ${f(y + 16)}L${f(x + 4)} ${f(y + 13)}L${f(x - 4)} ${f(y + 18)}L${f(x - 14)} ${f(y + 16)}Z" fill="#FFFFFF" opacity="0.85"/>`);
        }
      }
    }
  });
  if (lake) {
    out.push(`<rect x="0" y="${f(waterTop)}" width="${W}" height="${f(H - waterTop)}" fill="${p.water}"/>`);
    for (let i = 0; i < 9; i++) {
      const y = waterTop + 8 + i * ((H - waterTop) / 9);
      const w = between(rng, 30, 110);
      out.push(`<rect x="${f(between(rng, 0, W - w))}" y="${f(y)}" width="${f(w)}" height="2.5" rx="1.2" fill="${p.shine}" opacity="0.6"/>`);
    }
    for (let i = 0; i < 6; i++) {
      const w = sunR * (1.6 - i * 0.22);
      out.push(`<rect x="${f(sunX - w)}" y="${f(waterTop + 6 + i * 12)}" width="${f(w * 2)}" height="4" rx="2" fill="${p.sun}" opacity="${f(0.75 - i * 0.1)}"/>`);
    }
  }
  // Near hills with trees and a village, in front of the water (left or right shore).
  const shoreLeft = rng.next() < 0.5;
  const near = ridge(rng, lake ? between(rng, 318, 340) : between(rng, 320, 345), between(rng, 26, 46), false);
  const clip = lake ? (shoreLeft ? [-30, W * between(rng, 0.42, 0.58)] : [W * between(rng, 0.42, 0.58), W + 60]) : [-30, W + 60];
  const nearPts = near.filter(([x]) => x >= clip[0] - 120 && x <= clip[1] + 120);
  // The shore curves out into the water instead of ending in a straight cut.
  const edge = shoreLeft ? clip[1] : clip[0];
  const out_ = shoreLeft ? 70 : -70;
  const bank = !lake
    ? `<clipPath id="bank"><rect x="-30" y="0" width="${W + 90}" height="${H}"/></clipPath>`
    : shoreLeft
      ? `<clipPath id="bank"><path d="M-30 0H${f(edge)}V${f(waterTop - 6)}Q${f(edge + 8)} ${f(H - 10)} ${f(edge + out_)} ${H + 10}H-30Z"/></clipPath>`
      : `<clipPath id="bank"><path d="M${W + 60} 0H${f(edge)}V${f(waterTop - 6)}Q${f(edge - 8)} ${f(H - 10)} ${f(edge + out_)} ${H + 10}H${W + 60}Z"/></clipPath>`;
  out.push(bank);
  out.push(`<g clip-path="url(#bank)"><path d="${ridgePath(nearPts, false)}" fill="${p.ridges[3]}"/>`);
  const front = ridge(rng, H - between(rng, 10, 30), 20, false).filter(([x]) => x >= clip[0] - 120 && x <= clip[1] + 120);
  out.push(`<path d="${ridgePath(front, false)}" fill="${p.ridges[4]}"/></g>`);
  const lo = Math.max(10, clip[0] + 10);
  const hi = Math.min(W - 10, clip[1] - 10);
  const houses = 1 + rng.int(3);
  const hx = between(rng, lo + 30, Math.max(lo + 31, hi - 30 - houses * 44));
  const trees = 8 + rng.int(10);
  for (let i = 0; i < trees; i++) {
    const x = between(rng, lo, hi);
    if (x > hx - 30 && x < hx + houses * 44 + 10) continue;
    const y = ridgeY(nearPts, x) + between(rng, 4, 26);
    const h = between(rng, 26, 48);
    const color = pick(rng, p.trees);
    out.push(theme === "autumn" && rng.next() < 0.6 ? roundTree(x, y, h, color) : pine(x, y, h, color));
  }
  for (let i = 0; i < houses; i++) {
    const x = hx + i * 44;
    out.push(house(x, ridgeY(nearPts, x) + 14, between(rng, 0.9, 1.2), pick(rng, p.houses), p.roof, theme === "night" || theme === "sunset"));
  }
  // Birds in the day skies.
  if (theme === "day" || theme === "autumn") {
    for (let i = 0; i < 3 + rng.int(3); i++) {
      const x = between(rng, 40, W - 40);
      const y = between(rng, 40, 160);
      out.push(`<path d="M${f(x - 7)} ${f(y)}Q${f(x - 3)} ${f(y - 5)} ${f(x)} ${f(y)}Q${f(x + 3)} ${f(y - 5)} ${f(x + 7)} ${f(y)}" fill="none" stroke="#1E2A55" stroke-width="1.6"/>`);
    }
  }
  return out.join("");
}

const ART = ["#FFC857", "#FFA978", "#A9CBFF", "#9DB4FF", "#7FD6A0", "#F6A6A1", "#C9B8E8", "#8FE3CF", "#FF9E9E", "#5B3DF5", "#111111", "#FFFFFF", "#1F7A4D", "#C8102E"];

/** A 3×2 (or 4×3) grid of blocks, each with its own bold motif. */
function blocks(rng: Rng): string {
  const cols = rng.next() < 0.5 ? 3 : 4;
  const rows = cols === 3 ? 2 : 3;
  const bw = W / cols;
  const bh = H / rows;
  const colors = rng.shuffle([...ART]);
  const out: string[] = [];
  let k = 0;
  const c = () => colors[k++ % colors.length];
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const x = q * bw;
      const y = r * bh;
      const bg = c();
      const fg = c();
      const fg2 = c();
      out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(bw)}" height="${f(bh)}" fill="${bg}"/>`);
      const cx = x + bw / 2;
      const cy = y + bh / 2;
      const s = Math.min(bw, bh);
      switch (rng.int(6)) {
        case 0:
          out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.38)}" fill="${fg}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.18)}" fill="${fg2}"/>`);
          break;
        case 1: {
          // Half circle on the block's bottom edge.
          out.push(`<path d="M${f(x)} ${f(y + bh)}A${f(bw / 2)} ${f(bw / 2)} 0 0 1 ${f(x + bw)} ${f(y + bh)}Z" fill="${fg}"/>`);
          out.push(`<circle cx="${f(x + bw * 0.78)}" cy="${f(y + bh * 0.24)}" r="${f(s * 0.1)}" fill="${fg2}"/>`);
          break;
        }
        case 2:
          for (let i = 0; i < 5; i++) out.push(`<rect x="${f(x)}" y="${f(y + (i * bh) / 5)}" width="${f(bw)}" height="${f(bh / 10)}" fill="${i % 2 ? fg2 : fg}"/>`);
          break;
        case 3:
          out.push(`<path d="M${f(x)} ${f(y + bh)}L${f(cx)} ${f(y)}L${f(x + bw)} ${f(y + bh)}Z" fill="${fg}"/>`);
          out.push(`<path d="M${f(x + bw * 0.3)} ${f(y + bh)}L${f(cx)} ${f(y + bh * 0.45)}L${f(x + bw * 0.7)} ${f(y + bh)}Z" fill="${fg2}"/>`);
          break;
        case 4:
          for (let i = 3; i > 0; i--) out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f((s * i) / 3)}" fill="${i % 2 ? fg : fg2}"/>`);
          break;
        default:
          for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
            out.push(`<circle cx="${f(x + (bw * (i + 0.5)) / 4)}" cy="${f(y + (bh * (j + 0.5)) / 3)}" r="${f(s * 0.07)}" fill="${(i + j) % 2 ? fg : fg2}"/>`);
          }
      }
      out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(bw)}" height="${f(bh)}" fill="none" stroke="#111111" stroke-width="3"/>`);
    }
  }
  return `<clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath><g clip-path="url(#frame)">${out.join("")}</g>`;
}

function sunburst(rng: Rng): string {
  const colors = rng.shuffle([...ART.slice(0, 10)]);
  const cx = between(rng, W * 0.3, W * 0.7);
  const cy = between(rng, H * 0.35, H * 0.65);
  const rays = 16 + 2 * rng.int(6);
  const out: string[] = [`<rect width="${W}" height="${H}" fill="${colors[0]}"/>`];
  const R = 900;
  for (let i = 0; i < rays; i++) {
    if (i % 2) continue;
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = ((i + 1) / rays) * Math.PI * 2;
    out.push(`<path d="M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a0) * R)} ${f(cy + Math.sin(a0) * R)}L${f(cx + Math.cos(a1) * R)} ${f(cy + Math.sin(a1) * R)}Z" fill="${colors[1]}"/>`);
  }
  // Quarter-tinted corners so each area of the picture looks different.
  out.push(`<path d="M0 0H${f(W * 0.32)}A${f(W * 0.32)} ${f(W * 0.32)} 0 0 1 0 ${f(W * 0.32)}Z" fill="${colors[5]}" opacity="0.85"/>`);
  out.push(`<path d="M${W} ${H}H${f(W - W * 0.28)}A${f(W * 0.28)} ${f(W * 0.28)} 0 0 1 ${W} ${f(H - W * 0.28)}Z" fill="${colors[6]}" opacity="0.85"/>`);
  for (let i = 5; i > 0; i--) out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(i * 22)}" fill="${colors[1 + (i % 4) + 1]}"/>`);
  for (let i = 0; i < 18; i++) {
    out.push(`<circle cx="${f(rng.next() * W)}" cy="${f(rng.next() * H)}" r="${f(between(rng, 4, 12))}" fill="${pick(rng, ["#FFFFFF", "#111111", colors[7]])}"/>`);
  }
  return out.join("");
}

function waves(rng: Rng): string {
  const palettes = [
    ["#FFE066", "#FFC857", "#FFA978", "#FF9E9E", "#F6A6A1", "#C9B8E8", "#9DB4FF", "#5B3DF5"],
    ["#FFF4DD", "#8FE3CF", "#7FD6A0", "#6FD0E8", "#A9CBFF", "#9DB4FF", "#5B3DF5", "#111111"],
    ["#FFD6A5", "#FFC857", "#7FD6A0", "#1F7A4D", "#6FD0E8", "#3A22C9", "#C8102E", "#111111"],
  ];
  const pal = pick(rng, palettes);
  const out: string[] = [`<rect width="${W}" height="${H}" fill="${pal[0]}"/>`];
  const sunX = between(rng, 80, W - 80);
  out.push(`<circle cx="${f(sunX)}" cy="${f(between(rng, 60, 100))}" r="${f(between(rng, 34, 50))}" fill="#FFFFFF" opacity="0.9"/>`);
  const bands = 7;
  for (let i = 1; i < pal.length && i <= bands; i++) {
    const base = 90 + i * 42;
    const amp = between(rng, 10, 26);
    const period = between(rng, 110, 220);
    const phase = rng.next() * period;
    let d = `M-10 ${H + 10}L-10 ${f(base)}`;
    for (let x = -10; x <= W + 20; x += 20) d += `L${x} ${f(base + Math.sin(((x + phase) / period) * Math.PI * 2) * amp)}`;
    out.push(`<path d="${d}L${W + 20} ${H + 10}Z" fill="${pal[i]}"/>`);
    // A row of dots riding each wave.
    if (i % 2 === 0) {
      for (let x = 20 + rng.int(40); x < W; x += 60 + rng.int(40)) {
        out.push(`<circle cx="${x}" cy="${f(base + 14 + Math.sin(((x + phase) / period) * Math.PI * 2) * amp)}" r="4" fill="#FFFFFF" opacity="0.8"/>`);
      }
    }
  }
  // A little boat on the second band.
  const bx = between(rng, 60, W - 60);
  const by = 90 + 42 * 2 + 4;
  out.push(`<path d="M${f(bx - 30)} ${f(by)}H${f(bx + 30)}L${f(bx + 20)} ${f(by + 14)}H${f(bx - 20)}Z" fill="#111111"/><path d="M${f(bx)} ${f(by - 46)}V${f(by)}H${f(bx + 26)}Z" fill="#FFFFFF"/><path d="M${f(bx - 3)} ${f(by - 40)}V${f(by - 4)}H${f(bx - 22)}Z" fill="#FF9E9E"/>`);
  return out.join("");
}

const ART_NAMES: Record<"blocks" | "sunburst" | "waves", string[]> = {
  blocks: ["Shapes and colors", "Color blocks", "Bold geometry"],
  sunburst: ["Sunburst", "Rays and circles"],
  waves: ["Waves at sea", "Rolling waves", "Sea of color"],
};

/** Draw the picture for `seed`. Same seed, same picture. */
export function drawPicture(seed: string): Picture {
  const rng = createRng(`${seed}:picture`);
  const theme = pick(rng, THEMES);
  const body =
    theme === "blocks" ? blocks(rng) : theme === "sunburst" ? sunburst(rng) : theme === "waves" ? waves(rng) : landscape(rng, theme);
  const name = pick(rng, theme in LAND_NAMES ? LAND_NAMES[theme as keyof typeof LAND_NAMES] : ART_NAMES[theme as keyof typeof ART_NAMES]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
  return { theme, name, svg };
}

/** The picture as a data URL (for <image href>). */
export function pictureDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
