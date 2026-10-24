import { ImageResponse } from "next/og";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { formatTime } from "@/lib/games/kit/results";
import { SUIT_PATHS } from "@/components/kit/SuitIcon";
import { bricolage800, geist500, geist700, geistMono600 } from "@/lib/games/kit/shareFonts";

/**
 * 1080×1080 social result card (design/ShareCard.dc.html), spoiler-free:
 * the Sudoku map shows only givens (black) and the order the player filled
 * cells (lighter = later), never digits.
 *
 * GET ?g=sudoku&d=2026-10-24&t=408000&top=27&s=12&m=0&h=1&lv=Hard&map=<81 chars 0-4>
 * Every input is validated; the image for a URL never changes, so it is cached
 * for a year.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LABEL_RE = /^[A-Za-z0-9 ·-]{0,24}$/;
const GAMES: Record<string, string> = { sudoku: "Daily Sudoku", solitaire: "Daily Solitaire", minesweeper: "Daily Minesweeper", freecell: "Daily FreeCell" };

/**
 * Minesweeper's card shows a fixed, made-up corner of a board (consistent
 * numbers, never the real layout): h hidden, F flag, . open, 1–9 numbers.
 */
const MINE_ART = ["hh1...", "hF21..", "12F1..", ".11211", "...1Fh", "...1hh"];
const MINE_NUMBER = ["", "#2563EB", "#15803D", "#DC2626"];
const SUITS = [
  { s: "S", red: false },
  { s: "H", red: true },
  { s: "D", red: true },
  { s: "C", red: false },
] as const;

function font(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function int(value: string | null, max: number): number | null {
  if (value === null || !/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n <= max ? n : null;
}

const SHADES = ["#111111", "#FFFFFF", "rgba(255,255,255,0.72)", "rgba(255,255,255,0.45)", "rgba(255,255,255,0.22)"];

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const game = q.get("g") ?? "";
  const date = q.get("d") ?? "";
  const time = int(q.get("t"), 86_400_000);
  const top = q.get("top") === null ? null : int(q.get("top"), 100);
  const streak = int(q.get("s") ?? "0", 10_000);
  const mistakes = int(q.get("m") ?? "0", 999);
  const hints = int(q.get("h") ?? "0", 999);
  const moves = q.get("mv") === null ? null : int(q.get("mv"), 100_000);
  const label = q.get("lv") ?? "";
  const map = q.get("map") ?? "";
  if (
    !GAMES[game] ||
    !DATE_RE.test(date) ||
    time === null ||
    (q.get("top") !== null && top === null) ||
    streak === null ||
    mistakes === null ||
    hints === null ||
    (q.get("mv") !== null && moves === null) ||
    !LABEL_RE.test(label) ||
    (map && !/^[0-4]{81}$/.test(map))
  ) {
    return new Response("bad request", { status: 400 });
  }

  const accent = GAME_BY_SLUG[game].color;
  const day = new Date(`${date}T00:00:00Z`);
  const dateLabel = `${day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} · ${day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  const lines = [
    top !== null ? `Top ${Math.max(1, top)}% today` : "First to finish today",
    streak > 0 ? `${streak}-day streak` : null,
    game === "sudoku"
      ? `${mistakes} mistake${mistakes === 1 ? "" : "s"} · ${hints} hint${hints === 1 ? "" : "s"}`
      : game === "minesweeper"
        ? `${mistakes ? `${mistakes} mine${mistakes === 1 ? "" : "s"} hit` : "No mines hit"} · ${hints} hint${hints === 1 ? "" : "s"}`
        : `${moves ?? 0} moves · ${hints} hint${hints === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

  const board =
    game === "minesweeper" ? (
      <div style={{ display: "flex", flexWrap: "wrap", width: 432, height: 432, padding: 16, gap: 8, borderRadius: 36, background: "rgba(17,17,17,0.08)" }}>
        {MINE_ART.join("")
          .split("")
          .map((c, i) => (
            <div
              key={i}
              style={{
                width: 60,
                height: 60,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: c === "h" || c === "F" ? "rgba(255,255,255,0.45)" : "#FFFFFF",
                fontFamily: "Bricolage",
                fontSize: 38,
                color: MINE_NUMBER[Number(c)] ?? "#111111",
              }}
            >
              {c === "F" ? (
                <svg width="40" height="40" viewBox="0 0 24 24">
                  <path d="M7 21V4M4 21h7" stroke="#111111" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M7 4h11l-3 4.5 3 4.5H7z" fill="#C8102E" />
                </svg>
              ) : /\d/.test(c) ? (
                c
              ) : null}
            </div>
          ))}
      </div>
    ) : game === "sudoku" && map ? (
      <div style={{ display: "flex", flexWrap: "wrap", width: 432, height: 432, padding: 16, gap: 6, borderRadius: 36, background: "rgba(17,17,17,0.08)" }}>
        {map.split("").map((c, i) => (
          <div key={i} style={{ width: 38, height: 38, borderRadius: 8, background: SHADES[Number(c)] }} />
        ))}
      </div>
    ) : (
      <div style={{ display: "flex", flexWrap: "wrap", width: 432, height: 432, padding: 28, gap: 24, borderRadius: 36, background: "rgba(17,17,17,0.08)" }}>
        {SUITS.map(({ s, red }) => (
          <div key={s} style={{ width: 176, height: 176, borderRadius: 22, background: "#FFFFFF", display: "flex", flexDirection: "column", padding: 16, color: red ? "#C8102E" : "#111111" }}>
            <span style={{ fontFamily: "Bricolage", fontSize: 44, lineHeight: 1 }}>K</span>
            <svg style={{ marginTop: "auto", alignSelf: "center" }} width="84" height="84" viewBox="0 0 24 24">
              <path d={SUIT_PATHS[s]} fill={red ? "#C8102E" : "#111111"} />
            </svg>
          </div>
        ))}
      </div>
    );

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1080, display: "flex", flexDirection: "column", padding: 80, gap: 44, background: accent, color: "#111111", fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="60" height="60" viewBox="0 0 34 34">
              <rect x="1" y="1" width="15" height="15" rx="4" fill="#111111" />
              <rect x="18" y="1" width="15" height="15" rx="7.5" fill="#FFFFFF" />
              <rect x="1" y="18" width="15" height="15" rx="7.5" fill="#FFFFFF" />
              <rect x="18" y="18" width="15" height="15" rx="4" fill="#111111" />
            </svg>
            <span style={{ fontFamily: "Bricolage", fontSize: 48, letterSpacing: "-0.03em" }}>funzzle</span>
          </div>
          <span style={{ fontFamily: "Geist Mono", fontSize: 28 }}>{dateLabel}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontFamily: "Bricolage", fontSize: GAMES[game].length > 15 ? 68 : 92, lineHeight: 1, letterSpacing: "-0.035em" }}>{GAMES[game]}</span>
          {label && (
            <span style={{ padding: "10px 20px", borderRadius: 999, background: "#111111", color: "#FFFFFF", fontSize: 26, fontWeight: 700 }}>{label}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 56, alignItems: "center" }}>
          {board}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontFamily: "Geist Mono", fontSize: 152, lineHeight: 1, letterSpacing: "-0.04em" }}>{formatTime(time)}</span>
            {lines.map((line, i) => (
              <span key={line} style={{ fontSize: i === 0 ? 38 : 32, fontWeight: i === 0 ? 700 : 500 }}>{line}</span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 36, borderTop: "4px solid #111111" }}>
          <span style={{ fontFamily: "Bricolage", fontSize: 44, letterSpacing: "-0.02em" }}>Can you beat it?</span>
          <span style={{ fontFamily: "Geist Mono", fontSize: 30 }}>funzzle.com/daily</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: "Bricolage", data: font(bricolage800), weight: 800, style: "normal" },
        { name: "Geist", data: font(geist500), weight: 500, style: "normal" },
        { name: "Geist", data: font(geist700), weight: 700, style: "normal" },
        { name: "Geist Mono", data: font(geistMono600), weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}
