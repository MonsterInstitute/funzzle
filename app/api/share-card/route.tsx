import { ImageResponse } from "next/og";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { formatScore, formatTime } from "@/lib/games/kit/results";
import { LEVEL_COLOR, type Level } from "@/lib/games/groups/puzzle";
import { SUIT_PATHS } from "@/components/kit/SuitIcon";
import {
  bricolage800,
  geist500,
  geist700,
  geistMono600,
} from "@/lib/games/kit/shareFonts";

/**
 * 1080×1080 social result card (design/ShareCard.dc.html), spoiler-free:
 * the Sudoku map shows only givens (black) and the order the player filled
 * cells (lighter = later), never digits.
 *
 * GET ?g=sudoku&d=2026-10-24&t=408000&top=27&s=12&m=0&h=1&lv=Hard&map=<81 chars 0-4>
 * Spelling Hive adds sc=<score>&w=<words found> (the honeycomb has no letters);
 * Letter Box adds w=<words used>&p=<box positions 0-b in play order> (the
 * square shows the path, never the letters).
 * Groups: map = the level (1-4) of every word of every guess, 4 per guess
 * (colors only, never words), and f = groups found (0-4).
 * Funzzle Word: ?g=word&…&lv=Classic&gs=3/6&map=<rows of tile marks 0-2,
 * "-" between rows, "_" between Quad boards> (colors only, never letters).
 * Word Hunt: map = one letter per theme word in the order found (s span,
 * t theme word, r revealed by the coach), bw = bonus words found.
 * Word Search: &wl=<word lengths in the order found, comma-separated> (bars,
 * no letters or positions). Crossword: &cw=<size² chars: 0 black, 1 solved,
 * 2 helped> (the grid's black-square shape, no letters).
 * Every input is validated; the image for a URL never changes, so it is cached
 * for a year.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LABEL_RE = /^[A-Za-z0-9 ·-]{0,24}$/;
const GAMES: Record<string, string> = {
  sudoku: "Daily Sudoku",
  solitaire: "Daily Solitaire",
  minesweeper: "Daily Minesweeper",
  freecell: "Daily FreeCell",
  mahjong: "Daily Mahjong",
  "spider-solitaire": "Daily Spider",
  "spelling-hive": "Spelling Hive",
  "letter-box": "Letter Box",
  groups: "Groups",
  chess: "Chess Puzzle",
  "mini-crossword": "Mini Crossword",
  word: "Funzzle Word",
  "word-hunt": "Word Hunt",
  "2048": "Daily 2048",
  "block-puzzle": "Daily Block Puzzle",
  jigsaw: "Daily Jigsaw",
  "word-search": "Word Search",
  crossword: "Daily Crossword",
  nonogram: "Daily Nonogram",
  kakuro: "Daily Kakuro",
};
/** Games whose card shows mistakes and hints, with the game glyph as a spoiler-free board. */
const GLYPH_BOARD = new Set(["nonogram", "kakuro"]);
/** 2048 tile colors by exponent (lib/games/t2048 uses the same ramp). */
const TILE_BG = [
  "#FFF4DD",
  "#FFE9B8",
  "#FFD98A",
  "#FFC857",
  "#FFB547",
  "#FF9F43",
  "#FF8A3D",
  "#F7B32B",
  "#F29E1F",
  "#EC8A12",
  "#E07A00",
  "#111111",
];
const HUNT_DOT: Record<string, { bg: string; border: string }> = {
  s: { bg: "#FFE066", border: "#111111" },
  t: { bg: "#FFFFFF", border: "#FFFFFF" },
  r: { bg: "transparent", border: "#111111" },
};
const WORD_MAP_RE =
  /^[0-2]{5,8}(-[0-2]{5,8}){0,8}(_[0-2]{5,8}(-[0-2]{5,8}){0,8}){0,3}$/;
const WORD_TILE = ["#FFFFFF", "#F2C230", "#2E7D32"];

/** Chess vs the computer (?g=chess&r=win|draw|loss): a game result, not a daily rank. */
const CHESS_RESULT: Record<string, string> = {
  win: "Won",
  draw: "Drew",
  loss: "Lost",
};

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

/** Four original tile faces for the Mahjong card: dots, bamboo, a dragon, a flower. */
const MAHJONG_TILES = [
  <g key="dots" fill="#2456A6">
    <circle cx="31" cy="22" r="7" />
    <circle cx="31" cy="40" r="7" />
    <circle cx="31" cy="58" r="7" />
  </g>,
  <g key="bamboo" fill="#1F7A4D">
    <rect x="17" y="16" width="7" height="48" rx="3.5" />
    <rect x="27.5" y="16" width="7" height="48" rx="3.5" />
    <rect x="38" y="16" width="7" height="48" rx="3.5" />
  </g>,
  <g key="dragon">
    <circle cx="31" cy="40" r="19" fill="#C8102E" />
    <circle cx="31" cy="40" r="9" fill="#FFFDF7" />
  </g>,
  <g key="flower" fill="#C2378A">
    <circle cx="31" cy="27" r="8" />
    <circle cx="43" cy="36" r="8" />
    <circle cx="38" cy="50" r="8" />
    <circle cx="24" cy="50" r="8" />
    <circle cx="19" cy="36" r="8" />
    <circle cx="31" cy="40" r="6" fill="#F2B233" />
  </g>,
];

const SHADES = [
  "#111111",
  "#FFFFFF",
  "rgba(255,255,255,0.72)",
  "rgba(255,255,255,0.45)",
  "rgba(255,255,255,0.22)",
];

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
  const bonusWords = q.get("bw") === null ? null : int(q.get("bw"), 999);
  const label = q.get("lv") ?? "";
  const map = q.get("map") ?? "";
  const score = q.get("sc") === null ? null : int(q.get("sc"), 10_000_000);
  const words = q.get("w") === null ? null : int(q.get("w"), 999);
  const path = q.get("p") ?? "";
  const found = int(q.get("f") ?? "4", 4);
  const chessResult = q.get("r");
  const gs = q.get("gs") ?? "";
  const bestTile = q.get("bt") === null ? null : int(q.get("bt"), 1 << 20);
  const wl = q.get("wl") ?? "";
  const cw = q.get("cw") ?? "";
  const cwSize = Math.round(Math.sqrt(cw.length));
  if (
    (chessResult !== null &&
      (game !== "chess" || !CHESS_RESULT[chessResult])) ||
    !GAMES[game] ||
    !DATE_RE.test(date) ||
    time === null ||
    ((game === "2048" || game === "block-puzzle") && score === null) ||
    (q.get("bt") !== null &&
      (bestTile === null ||
        bestTile < 2 ||
        (bestTile & (bestTile - 1)) !== 0)) ||
    (q.get("top") !== null && top === null) ||
    streak === null ||
    mistakes === null ||
    hints === null ||
    (q.get("mv") !== null && moves === null) ||
    (q.get("bw") !== null && bonusWords === null) ||
    !LABEL_RE.test(label) ||
    (map &&
      game !== "groups" &&
      game !== "word" &&
      game !== "word-hunt" &&
      game !== "word-search" &&
      game !== "crossword" &&
      !(
        game === "mini-crossword" ? /^(?:[0-5]{25}|[0-5]{49})$/ : /^[0-4]{81}$/
      ).test(map)) ||
    (game === "word" &&
      (!WORD_MAP_RE.test(map) || !/^([1-9]|X)\/[69]$/.test(gs))) ||
    (wl && !/^(1[0-5]|[3-9])(,(1[0-5]|[3-9])){0,15}$/.test(wl)) ||
    (cw &&
      (!/^[0-2]+$/.test(cw) ||
        ![11, 13, 15].includes(cwSize) ||
        cwSize * cwSize !== cw.length)) ||
    (game === "word-hunt" && !/^[str]{1,9}$/.test(map)) ||
    (game === "groups" &&
      (!/^[1-4]{4,32}$/.test(map) || map.length % 4 !== 0 || found === null)) ||
    (q.get("sc") !== null && score === null) ||
    (q.get("w") !== null && words === null) ||
    (path && !/^[0-9ab]{2,80}$/.test(path))
  ) {
    return new Response("bad request", { status: 400 });
  }

  const accent = GAME_BY_SLUG[game].color;
  const day = new Date(`${date}T00:00:00Z`);
  const dateLabel = `${day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} · ${day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  const lines = (
    chessResult
      ? [
          CHESS_RESULT[chessResult],
          `${moves ?? 0} moves · ${hints} hint${hints === 1 ? "" : "s"}`,
        ]
      : [
          game === "groups" && found !== null && found < 4
            ? `Found ${found} of 4 groups`
            : top !== null
              ? `Top ${Math.max(1, top)}% today`
              : "First to finish today",
          streak > 0 ? `${streak}-day streak` : null,
          game === "sudoku" ||
          game === "groups" ||
          game === "chess" ||
          GLYPH_BOARD.has(game)
            ? `${mistakes} mistake${mistakes === 1 ? "" : "s"} · ${hints} hint${hints === 1 ? "" : "s"}`
            : game === "2048"
              ? `${bestTile ? `Best tile ${bestTile} · ` : ""}${moves ?? 0} moves`
              : game === "block-puzzle" || game === "jigsaw"
                ? `${moves ?? 0} pieces · ${hints} hint${hints === 1 ? "" : "s"}`
                : game === "word-search"
                  ? `${wl ? wl.split(",").length : (moves ?? 0)} words · ${hints} hint${hints === 1 ? "" : "s"}`
                  : game === "crossword"
                    ? `${cw ? `${cwSize}×${cwSize} · ` : ""}${hints} hint${hints === 1 ? "" : "s"}`
                    : game === "word-hunt"
                      ? `${bonusWords ?? 0} bonus word${bonusWords === 1 ? "" : "s"} · ${hints} hint${hints === 1 ? "" : "s"}`
                      : game === "word"
                        ? `${formatTime(time)} · ${hints} hint${hints === 1 ? "" : "s"}`
                        : game === "mini-crossword"
                          ? hints
                            ? `${hints} check${hints === 1 ? "" : "s"} or hint${hints === 1 ? "" : "s"}`
                            : "No checks, no hints"
                          : game === "minesweeper"
                            ? `${mistakes ? `${mistakes} mine${mistakes === 1 ? "" : "s"} hit` : "No mines hit"} · ${hints} hint${hints === 1 ? "" : "s"}`
                            : game === "mahjong"
                              ? `${moves ?? 0} pairs · ${hints} hint${hints === 1 ? "" : "s"}`
                              : game === "spelling-hive" ||
                                  game === "letter-box"
                                ? `${words ?? 0} word${words === 1 ? "" : "s"} · ${hints} hint${hints === 1 ? "" : "s"}`
                                : `${moves ?? 0} moves · ${hints} hint${hints === 1 ? "" : "s"}`,
        ]
  ).filter(Boolean) as string[];
  const title = chessResult ? "Chess" : GAMES[game];
  // Score games show their score; the rest their time.
  const headline =
    game === "spelling-hive"
      ? `${score ?? 0} pts`
      : game === "2048" || game === "block-puzzle"
        ? formatScore(score ?? 0)
        : formatTime(time);

  // 2048: the best tile and the three below it, as tiles.
  const exp = bestTile ? Math.log2(bestTile) : 11;
  const tiles = [exp, exp - 1, exp - 2, exp - 3].map((e) => Math.max(1, e));
  const glyph = GAME_BY_SLUG[game]?.glyph ?? "";

  const rows = game === "groups" ? (map.match(/.{4}/g) ?? []) : [];
  const cell = Math.min(
    72,
    Math.floor((400 - (rows.length - 1) * 10) / Math.max(1, rows.length)),
  );
  // Mini Crossword map: black squares, then solve order (lighter = later); "5" = revealed.
  const miniSide = map.length === 49 ? 7 : 5;
  const miniCell = Math.floor((400 - (miniSide - 1) * 8) / miniSide);
  const wordBoards =
    game === "word" ? map.split("_").map((b) => b.split("-")) : [];
  const cols = wordBoards[0]?.[0]?.length ?? 5;
  const quad = wordBoards.length > 1;
  // Fit the grid in the 400px board area: Quad shows four small grids.
  const wordCell = quad
    ? 17
    : Math.min(60, Math.floor((400 - (cols - 1) * 10) / cols));
  const gap = quad ? 3 : 10;
  const grid = (rows: string[], b: number) => (
    <div key={b} style={{ display: "flex", flexDirection: "column", gap }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: "flex", gap }}>
          {row.split("").map((m, i) => (
            <div
              key={i}
              style={{
                width: wordCell,
                height: wordCell,
                borderRadius: quad ? 4 : 10,
                background: WORD_TILE[Number(m)],
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
  const wordBars = wl ? wl.split(",").map(Number) : [];
  const cwCell = cwSize ? Math.floor((400 - 2 * (cwSize - 1)) / cwSize) : 0;
  const board =
    game === "word-search" && wordBars.length ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: 432,
          height: 432,
          padding: 28,
          gap: 8,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {wordBars.map((len, i) => (
          <div
            key={i}
            style={{
              height: Math.min(22, Math.floor(360 / wordBars.length) - 8),
              width: `${Math.round((len / 15) * 100)}%`,
              borderRadius: 999,
              background: i === wordBars.length - 1 ? "#111111" : "#FFFFFF",
            }}
          />
        ))}
      </div>
    ) : game === "crossword" && cw ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
          width: 432,
          height: 432,
          padding: 16,
          gap: 2,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {cw.split("").map((c, i) => (
          <div
            key={i}
            style={{
              width: cwCell,
              height: cwCell,
              borderRadius: 4,
              background:
                c === "0"
                  ? "#111111"
                  : c === "1"
                    ? "#FFFFFF"
                    : "rgba(255,255,255,0.45)",
            }}
          />
        ))}
      </div>
    ) : game === "2048" ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: 432,
          height: 432,
          padding: 28,
          gap: 24,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {tiles.map((e, i) => (
          <div
            key={i}
            style={{
              width: 176,
              height: 176,
              borderRadius: 22,
              background: TILE_BG[Math.min(TILE_BG.length - 1, e)],
              color: e >= 11 ? "#FFFFFF" : "#111111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Bricolage",
              fontSize: 2 ** e >= 1000 ? 52 : 68,
            }}
          >
            {String(2 ** e)}
          </div>
        ))}
      </div>
    ) : game === "block-puzzle" || game === "jigsaw" ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 432,
          height: 432,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        <svg
          width="320"
          height="320"
          viewBox="0 0 48 48"
          fill="#FFFFFF"
          stroke="#111111"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d={glyph} />
        </svg>
      </div>
    ) : game === "word-hunt" && map ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
          width: 432,
          height: 432,
          padding: 36,
          gap: 24,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {map.split("").map((c, i) => (
          <div
            key={i}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              background: HUNT_DOT[c].bg,
              border: `8px solid ${HUNT_DOT[c].border}`,
            }}
          />
        ))}
      </div>
    ) : game === "word" ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: 432,
          height: 432,
          padding: 16,
          gap: 24,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {(quad
          ? [wordBoards.slice(0, 2), wordBoards.slice(2, 4)]
          : [wordBoards]
        ).map((pair, p) => (
          <div key={p} style={{ display: "flex", gap: 32 }}>
            {pair.map((rows, b) => grid(rows, p * 2 + b))}
          </div>
        ))}
      </div>
    ) : game === "chess" ? (
      // A plain board: nothing about the position or the solution.
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: 432,
          height: 432,
          padding: 16,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {Array.from({ length: 64 }, (_, i) => (
          <div
            key={i}
            style={{
              width: 50,
              height: 50,
              background:
                ((i >> 3) + i) % 2 ? "rgba(17,17,17,0.55)" : "#FFFFFF",
            }}
          />
        ))}
      </div>
    ) : game === "groups" ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: 432,
          height: 432,
          padding: 16,
          gap: 10,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {rows.map((row, r) => (
          <div
            key={r}
            style={{ display: "flex", justifyContent: "center", gap: 10 }}
          >
            {row.split("").map((c, i) => (
              <div
                key={i}
                style={{
                  width: cell * 1.2,
                  height: cell,
                  borderRadius: 12,
                  background: LEVEL_COLOR[Number(c) as Level],
                  border: "3px solid #111111",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    ) : game === "minesweeper" ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: 432,
          height: 432,
          padding: 16,
          gap: 8,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
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
                background:
                  c === "h" || c === "F" ? "rgba(255,255,255,0.45)" : "#FFFFFF",
                fontFamily: "Bricolage",
                fontSize: 38,
                color: MINE_NUMBER[Number(c)] ?? "#111111",
              }}
            >
              {c === "F" ? (
                <svg width="40" height="40" viewBox="0 0 24 24">
                  <path
                    d="M7 21V4M4 21h7"
                    stroke="#111111"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <path d="M7 4h11l-3 4.5 3 4.5H7z" fill="#C8102E" />
                </svg>
              ) : /\d/.test(c) ? (
                c
              ) : null}
            </div>
          ))}
      </div>
    ) : game === "mahjong" ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: 432,
          height: 432,
          padding: 28,
          gap: 24,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {MAHJONG_TILES.map((face, i) => (
          <div
            key={i}
            style={{
              width: 176,
              height: 176,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <svg width="140" height="176" viewBox="0 0 70 88">
              <rect x="6" y="6" width="62" height="80" rx="9" fill="#C9746E" />
              <rect
                x="0"
                y="0"
                width="62"
                height="80"
                rx="9"
                fill="#FFFDF7"
                stroke="#E9DCCB"
                strokeWidth="1.5"
              />
              {face}
            </svg>
          </div>
        ))}
      </div>
    ) : game === "spelling-hive" ? (
      <HiveBoard />
    ) : game === "letter-box" ? (
      <BoxBoard path={path} />
    ) : game === "mini-crossword" && map ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: 432,
          height: 432,
          padding: 16,
          gap: 8,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {map.split("").map((c, i) => (
          <div
            key={i}
            style={{
              width: miniCell,
              height: miniCell,
              borderRadius: 10,
              background: c === "5" ? "rgba(17,17,17,0.28)" : SHADES[Number(c)],
            }}
          />
        ))}
      </div>
    ) : game === "sudoku" && map ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: 432,
          height: 432,
          padding: 16,
          gap: 6,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {map.split("").map((c, i) => (
          <div
            key={i}
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: SHADES[Number(c)],
            }}
          />
        ))}
      </div>
    ) : GLYPH_BOARD.has(game) ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 432,
          height: 432,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        <svg width="340" height="340" viewBox="0 0 48 48">
          <path
            d={GAME_BY_SLUG[game].glyph}
            fill="none"
            stroke="#111111"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: 432,
          height: 432,
          padding: 28,
          gap: 24,
          borderRadius: 36,
          background: "rgba(17,17,17,0.08)",
        }}
      >
        {SUITS.map(({ s, red }) => (
          <div
            key={s}
            style={{
              width: 176,
              height: 176,
              borderRadius: 22,
              background: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              padding: 16,
              color: red ? "#C8102E" : "#111111",
            }}
          >
            <span
              style={{ fontFamily: "Bricolage", fontSize: 44, lineHeight: 1 }}
            >
              K
            </span>
            <svg
              style={{ marginTop: "auto", alignSelf: "center" }}
              width="84"
              height="84"
              viewBox="0 0 24 24"
            >
              <path d={SUIT_PATHS[s]} fill={red ? "#C8102E" : "#111111"} />
            </svg>
          </div>
        ))}
      </div>
    );

  return new ImageResponse(
    <div
      style={{
        width: 1080,
        height: 1080,
        display: "flex",
        flexDirection: "column",
        padding: 80,
        gap: 44,
        background: accent,
        color: "#111111",
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="60" height="60" viewBox="0 0 34 34">
            <rect x="1" y="1" width="15" height="15" rx="4" fill="#111111" />
            <rect x="18" y="1" width="15" height="15" rx="7.5" fill="#FFFFFF" />
            <rect x="1" y="18" width="15" height="15" rx="7.5" fill="#FFFFFF" />
            <rect x="18" y="18" width="15" height="15" rx="4" fill="#111111" />
          </svg>
          <span
            style={{
              fontFamily: "Bricolage",
              fontSize: 48,
              letterSpacing: "-0.03em",
            }}
          >
            funzzle
          </span>
        </div>
        <span style={{ fontFamily: "Geist Mono", fontSize: 28 }}>
          {dateLabel}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <span
          style={{
            fontFamily: "Bricolage",
            fontSize: title.length > 15 ? 68 : 92,
            lineHeight: 1,
            letterSpacing: "-0.035em",
          }}
        >
          {title}
        </span>
        {label && (
          <span
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: "#111111",
              color: "#FFFFFF",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {label}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 56, alignItems: "center" }}>
        {board}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span
            style={{
              fontFamily: "Geist Mono",
              fontSize: game === "spelling-hive" ? 96 : 152,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            {game === "word" ? gs : headline}
          </span>
          {lines.map((line, i) => (
            <span
              key={line}
              style={{
                fontSize: i === 0 ? 38 : 32,
                fontWeight: i === 0 ? 700 : 500,
              }}
            >
              {line}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 36,
          borderTop: "4px solid #111111",
        }}
      >
        <span
          style={{
            fontFamily: "Bricolage",
            fontSize: 44,
            letterSpacing: "-0.02em",
          }}
        >
          Can you beat it?
        </span>
        <span style={{ fontFamily: "Geist Mono", fontSize: 30 }}>
          funzzle.com/daily
        </span>
      </div>
    </div>,
    {
      width: 1080,
      height: 1080,
      fonts: [
        {
          name: "Bricolage",
          data: font(bricolage800),
          weight: 800,
          style: "normal",
        },
        { name: "Geist", data: font(geist500), weight: 500, style: "normal" },
        { name: "Geist", data: font(geist700), weight: 700, style: "normal" },
        {
          name: "Geist Mono",
          data: font(geistMono600),
          weight: 600,
          style: "normal",
        },
      ],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}

/** Seven blank hexagons, the center one dark: spoiler-free. */
function HiveBoard() {
  const r = 62;
  const hex = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  const dx = r * 1.5 + 6;
  const dy = r * Math.sqrt(3) + 6;
  const cells = [
    [0, 0],
    [0, -dy],
    [0, dy],
    [-dx, -dy / 2],
    [dx, -dy / 2],
    [-dx, dy / 2],
    [dx, dy / 2],
  ];
  return (
    <div
      style={{
        display: "flex",
        width: 432,
        height: 432,
        borderRadius: 36,
        background: "rgba(17,17,17,0.08)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="400" height="400" viewBox="-200 -200 400 400">
        {cells.map(([x, y], i) => (
          <polygon
            key={i}
            points={hex(x, y)}
            fill={i === 0 ? "#111111" : "#FFFFFF"}
          />
        ))}
      </svg>
    </div>
  );
}

/** The square with its twelve dots and the player's path, no letters. */
function BoxBoard({ path }: { path: string }) {
  const at = (i: number): [number, number] => {
    const side = Math.floor(i / 3);
    const t = 80 + (i % 3) * 120;
    return side === 0
      ? [t, 40]
      : side === 1
        ? [360, t]
        : side === 2
          ? [t, 360]
          : [40, t];
  };
  const pts = path.split("").map((c) => at(parseInt(c, 16)));
  return (
    <div
      style={{
        display: "flex",
        width: 432,
        height: 432,
        borderRadius: 36,
        background: "rgba(17,17,17,0.08)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="400" height="400" viewBox="0 0 400 400">
        <rect
          x="40"
          y="40"
          width="320"
          height="320"
          fill="#FFFFFF"
          stroke="#111111"
          strokeWidth="6"
        />
        {pts.length > 1 && (
          <polyline
            points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#111111"
            strokeWidth="8"
            strokeLinejoin="round"
          />
        )}
        {Array.from({ length: 12 }, (_, i) => {
          const [x, y] = at(i);
          return <circle key={i} cx={x} cy={y} r="18" fill="#111111" />;
        })}
      </svg>
    </div>
  );
}
