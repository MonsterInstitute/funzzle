"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CoachCard from "@/components/kit/CoachCard";
import GameShell, { Chip } from "@/components/kit/GameShell";
import PauseSheet, { SheetButton } from "@/components/kit/PauseSheet";
import PracticeAction from "@/components/kit/PracticeAction";
import Recap from "@/components/kit/Recap";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { WORD_PUZZLE_RATING } from "@/lib/games/dailySchedule";
import { recordFinish } from "@/lib/games/kit/achievements";
import { track } from "@/lib/games/kit/analytics";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getStreak } from "@/lib/games/kit/daily";
import { getRating, recordMatch } from "@/lib/games/kit/rating";
import { formatClock, formatTime, submitResult, type DayStats } from "@/lib/games/kit/results";
import { writeJson } from "@/lib/games/kit/storage";
import { useTimer } from "@/lib/games/kit/useTimer";
import {
  compassEmoji,
  compassWord,
  findCountry,
  GEO_ROWS,
  geoHint,
  practiceCountry,
  scoreGeo,
  suggestCountries,
  type GeoCountry,
  type GeoGuess,
  type GeoHint,
} from "@/lib/games/word/geo";
import { MAX_HINTS, MODE_INFO, type WordPuzzle } from "@/lib/games/word/modes";
import { storageKey, useWordSession, type Finish, type Session } from "./session";
import { Ladder, ModeNav } from "./ui";

const GAME = GAME_BY_SLUG.word;
const INFO = MODE_INFO.geo;

interface GeoState {
  slug: string;
  shape: string;
  guesses: GeoGuess[];
  hints: number;
}

type GeoP = Extract<WordPuzzle, { mode: "geo" }>;

const initGeo = (p: WordPuzzle): GeoState => {
  const g = p as GeoP;
  return { slug: g.slug, shape: g.shape, guesses: [], hints: 0 };
};

/** Funzzle Word Geo (/play/word/geo): find the country from its silhouette in six. */
export default function GeoGame({ date, daily, countries }: { date: string; daily: GeoP; countries: GeoCountry[] }) {
  const { session, loaded, startPractice, resumePractice, backToDaily } = useWordSession<GeoState>({
    mode: "geo",
    date,
    daily,
    init: initGeo,
    // Practice loads the silhouettes on demand (~33 KB), not with the page.
    practicePuzzle: async (seed) => {
      const { GEO_SHAPES } = await import("@/lib/games/word/data/geoShapes");
      const c = practiceCountry(seed, countries);
      return { mode: "geo", slug: c.slug, shape: GEO_SHAPES[c.slug] };
    },
  });
  if (!loaded) return <Play session={session} date={date} countries={countries} key={`pre-${session.key}`} inert />;
  return (
    <Play
      key={session.key}
      session={session}
      date={session.date ?? date}
      countries={countries}
      onPractice={() => void startPractice()}
      onResumePractice={resumePractice}
      onDaily={backToDaily}
    />
  );
}

/** Arrow pointing along a compass bearing (0 = north). */
function Arrow({ deg, label }: { deg: number; label: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" role="img" aria-label={label} style={{ transform: `rotate(${deg}deg)` }}>
      <path d="M12 3v18M5 10l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Play({
  session,
  date,
  countries,
  inert = false,
  onPractice,
  onResumePractice,
  onDaily,
}: {
  session: Session<GeoState>;
  date: string;
  countries: GeoCountry[];
  inert?: boolean;
  onPractice?: () => void;
  onResumePractice?: () => void;
  onDaily?: () => void;
}) {
  const key = storageKey("geo", session.kind, date);
  const [state, setState] = useState<GeoState>(session.state);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [finish, setFinish] = useState<Finish | null>(session.done ?? null);
  const [coach, setCoach] = useState<{ hint: GeoHint; rung: 1 | 2 | 3 } | null>(null);
  const [paused, setPaused] = useState(false);
  const [showRecap, setShowRecap] = useState(!!session.done);
  const [bonusHints, setBonusHints] = useState(0);
  const outOfHints = state.hints >= MAX_HINTS + bonusHints;
  const bonusOffer = useRewardedOffer("word-extra-hint", "word", outOfHints && !finish && !inert);
  const answer = useMemo(() => countries.find((c) => c.slug === state.slug)!, [countries, state.slug]);
  const won = state.guesses.some((g) => g.correct);
  const over = won || state.guesses.length >= GEO_ROWS;
  const timer = useTimer(!inert && !paused && !over && !finish, session.elapsed);
  const started = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rating = getRating("word").rating;
  const day = new Date(`${date}T00:00:00Z`);
  const short = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const subtitle =
    session.kind === "practice"
      ? `Practice · ${INFO.blurb}`
      : `${session.kind === "archive" ? "Archive · " : ""}${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${INFO.blurb}`;
  const guessed = new Set(state.guesses.map((g) => g.slug));
  const options = suggestCountries(query, countries, 6).filter((c) => !guessed.has(c.slug)).slice(0, 5);

  useEffect(() => {
    if (inert) return;
    writeJson(key, { ...session, state, elapsed: timer.now(), done: finish ?? undefined } satisfies Session<GeoState>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finish, inert]);

  useEffect(() => {
    if (inert || started.current || finish) return;
    started.current = true;
    track("game_start", "word", { mode: session.kind, variant: "geo" });
  }, [inert, finish, session.kind]);

  useEffect(() => {
    if (!over || finish || inert) return;
    const timeMs = Math.max(1000, Math.round(timer.now()));
    const guesses = state.guesses.length;
    track("game_complete", "word", { mode: session.kind, variant: "geo", won, guesses, timeMs, hints: state.hints });
    const finalize = (percentile?: number | null, stats?: DayStats | null) => {
      const { rating: r, delta } =
        session.kind === "archive"
          ? { rating: getRating("word").rating, delta: 0 }
          : recordMatch("word", session.kind === "daily" ? `geo:${date}` : `geo:practice:${session.seed}`, {
              puzzleRating: WORD_PUZZLE_RATING.geo,
              won,
              percentile: percentile ?? undefined,
              hints: state.hints,
              mistakes: 0,
            });
      recordFinish("word", { won, timeMs, hints: state.hints, level: "geo", skills: ["geo", guesses <= 3 ? "geo-three" : "", !state.hints ? "unaided" : ""].filter(Boolean) });
      setFinish({ won, guesses, timeMs, percentile, stats, ratingDelta: delta, rating: r, streak: getStreak().current });
    };
    const t = window.setTimeout(() => setShowRecap(true), 1100);
    if (session.kind === "daily") {
      submitResult({ game: "word", variant: "geo", date, timeMs, mistakes: 0, hints: state.hints, moves: won ? guesses : GEO_ROWS + 1 }).then((res) =>
        finalize(res ? res.percentile : undefined, res)
      );
    } else finalize();
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  function guess(c: GeoCountry | null) {
    if (inert || over) return;
    if (!c) return setMessage(query.trim() ? "Pick a country from the list" : "Type a country");
    if (guessed.has(c.slug)) return setMessage(`Already guessed ${c.name}`);
    setState((s) => ({ ...s, guesses: [...s.guesses, scoreGeo(c, answer)] }));
    setQuery("");
    setActive(0);
    setMessage(null);
    if (coach && coach.rung < 3) setCoach(null);
    inputRef.current?.focus();
  }

  const submit = () => guess(options[active] ?? findCountry(query, countries));

  const openHint = () => {
    if (over || coach || outOfHints) return;
    const hint = geoHint(answer, state.guesses, countries);
    setState((s) => ({ ...s, hints: s.hints + 1 }));
    track("hint_used", "word", { technique: "geography", variant: "geo", mode: session.kind });
    setCoach({ hint, rung: 1 });
  };

  if (showRecap && finish) {
    return <GeoRecap session={session} date={date} short={short} state={state} answer={answer} finish={finish} onClose={() => setShowRecap(false)} onPractice={onPractice} />;
  }
  if (showRecap && !finish) {
    return (
      <div data-kit className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-semibold">Comparing with today’s players…</p>
      </div>
    );
  }

  const hintsLeft = Math.max(0, MAX_HINTS + bonusHints - state.hints);
  const listId = "geo-options";

  return (
    <GameShell
      tint={GAME.tint}
      title={INFO.title}
      subtitle={subtitle}
      timer={formatClock(timer.elapsed)}
      onTimerClick={() => setPaused(true)}
      chips={
        <>
          <Chip>Rating {rating.toLocaleString("en-US")}</Chip>
          <Chip>
            Guess {Math.min(GEO_ROWS, state.guesses.length + (over ? 0 : 1))} / {GEO_ROWS}
          </Chip>
        </>
      }
    >
      <ModeNav mode="geo" />

      <div className="px-4" style={{ visibility: paused ? "hidden" : undefined }}>
        <div className="flex items-center justify-center rounded-[22px] bg-soft p-4">
          <svg viewBox="0 0 100 100" className="h-[min(56vw,220px)] w-[min(56vw,220px)]" role="img" aria-label={over ? `Silhouette of ${answer.name}` : "Silhouette of today’s country"}>
            <path d={state.shape} fill="var(--ink)" fillRule="evenodd" />
          </svg>
        </div>
        {over && (
          <p className="m-0 mt-2 text-center font-display text-xl font-extrabold">
            {won ? "Found it: " : "It was "}
            {answer.name}
          </p>
        )}
      </div>

      <ol aria-label="Guesses" className="m-0 flex list-none flex-col gap-1.5 px-4">
        {Array.from({ length: GEO_ROWS }, (_, i) => {
          const g = state.guesses[i];
          if (!g) return <li key={i} aria-label={`Guess ${i + 1}: empty`} className="h-11 rounded-[12px] border-2 border-dashed border-line" />;
          const dir = compassWord(g.dir);
          return (
            <li
              key={i}
              aria-label={`Guess ${i + 1}: ${g.name}, ${g.correct ? "correct" : `${g.km.toLocaleString("en-US")} km, head ${dir}, ${g.pct}% close`}`}
              className="grid min-h-11 grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-[12px] px-3 py-1.5"
              style={{ background: g.correct ? "var(--word-hit)" : "var(--soft)", color: g.correct ? "var(--word-hit-ink)" : undefined }}
            >
              <span className="truncate text-[15px] font-semibold">{g.name}</span>
              <span className="font-mono text-sm">{g.correct ? "0 km" : `${g.km.toLocaleString("en-US")} km`}</span>
              <span className="flex h-7 w-7 items-center justify-center">{g.correct ? "✓" : <Arrow deg={g.deg} label={`Head ${dir}`} />}</span>
              <span className="w-11 text-right font-mono text-sm font-semibold">{g.pct}%</span>
            </li>
          );
        })}
      </ol>

      {!over && (
        <div className="relative px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={options.length ? `geo-opt-${active}` : undefined}
              aria-label="Country"
              placeholder="Type a country"
              autoComplete="off"
              disabled={inert}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(options.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Escape") setQuery("");
              }}
              className="min-h-[52px] min-w-0 flex-1 rounded-[16px] border-2 border-line-strong bg-ground px-4 text-base text-ink outline-none focus:border-ink"
            />
            <button type="submit" disabled={inert} className="min-h-[52px] rounded-full bg-ink px-5 text-base font-semibold text-ground disabled:opacity-40">
              Guess
            </button>
          </form>
          <p role="status" aria-live="polite" className={`m-0 mt-1.5 text-sm font-semibold text-card-red ${message ? "" : "sr-only"}`}>
            {message ?? ""}
          </p>
          {options.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Matching countries" className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
              {options.map((c, i) => (
                <li key={c.slug} id={`geo-opt-${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onClick={() => guess(c)}
                    className={`flex min-h-11 w-full items-center rounded-[12px] px-4 text-left text-[15px] font-semibold ${i === active ? "bg-ink text-ground" : "bg-soft-2 text-ink"}`}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="px-4">
        {coach ? (
          <Ladder
            rung={coach.rung}
            tag={coach.hint.title}
            direction={coach.hint.direction}
            specific={coach.hint.specific}
            answer={coach.hint.answer}
            hintsLeft={hintsLeft}
            onMore={() => setCoach({ ...coach, rung: 2 })}
            onAnswer={() => setCoach({ ...coach, rung: 3 })}
            onClose={() => setCoach(null)}
          />
        ) : (
          <CoachCard
            heading="Coach"
            tag={hintsLeft ? `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left` : "No hints left"}
            primary={
              over
                ? finish
                  ? { label: "See recap", onClick: () => setShowRecap(true) }
                  : undefined
                : hintsLeft
                  ? { label: "Get a hint", onClick: openHint }
                  : bonusOffer.ready
                    ? {
                        label: "Watch an ad for one more hint",
                        onClick: async () => {
                          if (await bonusOffer.watch()) setBonusHints((n) => n + 1);
                        },
                      }
                    : undefined
            }
          >
            {over
              ? won
                ? "Found it. Open the recap to see how you did."
                : "Out of guesses. The recap shows where it was."
              : hintsLeft
                ? "Stuck? I’ll name the continent, then a neighbor, then the first letter."
                : "Follow the arrows: each one points from your guess toward the answer."}
          </CoachCard>
        )}
      </div>

      {paused && (
        <PauseSheet onResume={() => setPaused(false)}>
          {session.kind === "daily" ? (
            <SheetButton
              onClick={() => {
                setPaused(false);
                onResumePractice?.();
              }}
            >
              Practice puzzles
            </SheetButton>
          ) : (
            <>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onPractice?.();
                }}
              >
                New practice puzzle
              </SheetButton>
              <SheetButton
                onClick={() => {
                  setPaused(false);
                  onDaily?.();
                }}
              >
                Back to today’s {INFO.title}
              </SheetButton>
            </>
          )}
        </PauseSheet>
      )}
    </GameShell>
  );
}

function GeoRecap({
  session,
  date,
  short,
  state,
  answer,
  finish,
  onClose,
  onPractice,
}: {
  session: Session<GeoState>;
  date: string;
  short: string;
  state: GeoState;
  answer: GeoCountry;
  finish: Finish;
  onClose: () => void;
  onPractice?: () => void;
}) {
  const practice = session.kind === "practice";
  const name = "Funzzle Word Geo";
  const scoreText = `${finish.won ? finish.guesses : "X"}/${GEO_ROWS}`;
  const misses = state.guesses.filter((g) => !g.correct);
  const best = misses.reduce<GeoGuess | null>((a, g) => (!a || g.km < a.km ? g : a), null);
  const first = state.guesses[0];
  const keyMove = finish.won
    ? finish.guesses === 1
      ? `you named ${answer.name} from the outline alone.`
      : best
        ? `${best.name} got you within ${best.km.toLocaleString("en-US")} km, and the arrow pointed ${compassWord(best.dir)} to ${answer.name}.`
        : `you found ${answer.name}.`
    : `It was ${answer.name}. ${first ? `Your first guess, ${first.name}, was ${first.km.toLocaleString("en-US")} km away${best && best !== first ? `; ${best.name} came closest at ${best.km.toLocaleString("en-US")} km` : ""}.` : ""}`;
  const rows = state.guesses.map((g) => {
    const filled = Math.round(g.pct / 20);
    return `${"🟩".repeat(filled)}${"⬜".repeat(5 - filled)} ${g.correct ? "🎯" : `${compassEmoji(g.dir)} ${g.km.toLocaleString("en-US")} km`}`;
  });
  const top = finish.percentile === null || finish.percentile === undefined ? null : 100 - finish.percentile;
  const text = [
    `${name}${practice ? " practice" : ` · ${short}`} · ${scoreText}`,
    ...rows,
    `${formatTime(finish.timeMs)}${top !== null && session.kind === "daily" ? ` · Top ${Math.max(1, top)}% today` : ""}`,
    `funzzle.com${INFO.path}`,
  ].join("\n");
  const imageParams = new URLSearchParams({
    g: "word",
    d: date,
    t: String(finish.timeMs),
    s: String(finish.streak),
    h: String(state.hints),
    lv: practice ? "Geo practice" : "Geo",
    sc: scoreText,
    // Proximity as five tiles per guess (no country names: spoiler-free).
    map: state.guesses.map((g) => "22222".slice(0, Math.round(g.pct / 20)).padEnd(5, "0")).join("-"),
  });
  if (top !== null && session.kind === "daily") imageParams.set("top", String(top));

  return (
    <Recap
      game="word"
      heading={`${name}${practice ? " practice" : ` · ${short}${session.kind === "archive" ? " · archive" : ""}`}`}
      title={finish.won ? "Found it." : "So close."}
      timeMs={finish.timeMs}
      percentile={session.kind === "daily" ? finish.percentile : undefined}
      stats={finish.stats}
      rankWord="Better"
      tiles={[
        { label: "Guesses", value: scoreText, note: finish.won ? answer.name : "Out of guesses", good: finish.won && finish.guesses <= 3 },
        { label: "Hints", value: String(state.hints), note: `of ${MAX_HINTS} used`, good: !state.hints },
        {
          label: "Rating",
          value: finish.rating.toLocaleString("en-US"),
          note: session.kind === "archive" ? "Archive puzzles are unrated" : `${finish.ratingDelta >= 0 ? "+" : ""}${finish.ratingDelta} ${session.kind === "daily" ? "today" : "this game"}`,
          good: finish.ratingDelta >= 0,
        },
      ]}
      challenge={{
        puzzle: practice ? { kind: "practice", seed: session.seed, level: "geo" } : { kind: "daily", date, variant: "geo" },
        label: practice ? `${name} practice` : `${name} · ${short}`,
        result: { timeMs: finish.timeMs, mistakes: 0, hints: state.hints, moves: finish.won ? finish.guesses : GEO_ROWS + 1 },
        activeId: session.challengeId,
      }}
      coach={{
        keyMove,
        nextSkill: "Triangulate: after two guesses, aim between the arrows, not just along one of them. The point where they cross is close to the answer.",
        learn: {
          title: "Learn to read the arrows in 2 minutes",
          body: "Each arrow points from your guess toward the answer along the shortest path over the globe, and the percentage says how close you are (100% is the answer, 0% the far side of the Earth). Two guesses from different directions narrow it down fast: draw both arrows in your head and look where they meet. Then use the silhouette to pick between the countries there.",
        },
      }}
      share={{ imageUrl: `/api/share-card?${imageParams}`, text }}
      onClose={onClose}
      extraActions={onPractice && <PracticeAction game="word" href={`${INFO.path}?practice=1`} label="Play a practice country" />}
    />
  );
}
