"use client";

import { useEffect, useState } from "react";
import { setFlag } from "@/lib/games/kit/achievements";
import {
  challengeLink,
  createChallenge,
  myEntry,
  submitChallengeEntry,
  type Challenge,
  type ChallengePuzzle,
  type ChallengeResult,
} from "@/lib/games/kit/challenge";
import { getDisplayName, NAME_MAX, setDisplayName } from "@/lib/games/kit/identity";
import { formatTime } from "@/lib/games/kit/results";
import { Icon } from "./Icons";

export interface ChallengeInfo {
  puzzle: ChallengePuzzle;
  label: string;
  result: ChallengeResult;
  /** Set when this game was opened from a friend's challenge link. */
  activeId?: string | null;
}

/** The ranked entries of a challenge, "you" highlighted. */
export function HeadToHead({ challenge }: { challenge: Challenge }) {
  const mine = myEntry(challenge.id);
  return (
    <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
      {challenge.entries.map((e, i) => {
        const isMe = !!mine && mine.name === e.name && mine.timeMs === e.timeMs;
        return (
          <li key={`${e.name}-${e.timeMs}-${i}`} className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 ${isMe ? "bg-violet-tint" : "bg-soft"}`}>
            <span className="flex items-center gap-2.5">
              <span className="w-5 font-mono text-sm text-muted-2">{i + 1}</span>
              <span className="font-semibold">
                {e.name}
                {isMe && " (you)"}
                {e.creator && !isMe && <span className="ml-1.5 text-xs font-normal text-muted-2">challenger</span>}
              </span>
            </span>
            <span className="font-mono text-sm">
              {formatTime(e.timeMs)}
              <span className="ml-2 text-muted-2">
                {challenge.game === "groups" ? `${e.mistakes} mistake${e.mistakes === 1 ? "" : "s"} · ` : ""}
                {e.hints} hint{e.hints === 1 ? "" : "s"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Recap block: "Challenge a friend" creates a link to this exact puzzle with
 * your result; opened from a friend's link, it adds your result and shows the
 * head-to-head.
 */
export default function ChallengePanel({ game, info }: { game: string; info: ChallengeInfo }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [name, setName] = useState(() => getDisplayName());
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  // Opened from a challenge link: record this result, then show the board.
  useEffect(() => {
    if (!info.activeId) return;
    let live = true;
    submitChallengeEntry(info.activeId, game, info.result)
      .then((c) => live && setChallenge(c))
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [game, info.activeId, info.result]);

  async function share(url: string) {
    const text = `Can you beat my ${formatTime(info.result.timeMs)} on ${info.label}?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Funzzle challenge", text, url });
        return;
      }
    } catch {
      // Cancelled or unsupported: fall back to copying.
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      window.prompt("Copy your challenge link", url);
    }
  }

  async function create() {
    setDisplayName(name);
    setState("working");
    try {
      const id = await createChallenge(game, info.puzzle, info.label, info.result);
      setFlag("challenge-sent");
      const url = challengeLink(id);
      setLink(url);
      setState("idle");
      await share(url);
    } catch {
      setState("error");
    }
  }

  if (info.activeId) {
    return (
      <section className="mx-4 flex flex-col gap-3 rounded-[22px] border border-line p-4">
        <h2 className="m-0 text-base font-semibold">Head to head</h2>
        {challenge ? (
          <>
            <HeadToHead challenge={challenge} />
            <a href={`/challenge?id=${challenge.id}`} className="text-sm font-semibold text-violet-deep">
              See the challenge page
            </a>
          </>
        ) : state === "error" ? (
          <p className="m-0 text-sm text-muted">Couldn’t reach the challenge right now. Your result is saved on this device.</p>
        ) : (
          <p className="m-0 text-sm text-muted">Adding your result…</p>
        )}
      </section>
    );
  }

  return (
    <section className="mx-4 flex flex-col gap-3 rounded-[22px] border border-line p-4">
      <h2 className="m-0 text-base font-semibold">Challenge a friend</h2>
      {link ? (
        <>
          <p className="m-0 text-sm text-muted">Sent. When they finish, you’ll both see the head-to-head here:</p>
          <div className="flex gap-2">
            <a href={link} className="min-w-0 flex-1 truncate rounded-xl bg-soft px-3 py-2.5 font-mono text-sm text-ink">
              {link.replace(/^https?:\/\//, "")}
            </a>
            <button type="button" onClick={() => share(link)} className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-ground">
              Share again
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-sm text-muted">Send this exact puzzle with your time. No sign-up for either of you.</p>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="challenge-name">
              Your name
            </label>
            <input
              id="challenge-name"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-ground px-3 text-base text-ink"
            />
            <button
              type="button"
              disabled={state === "working"}
              onClick={create}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Icon name="share" />
              Challenge
            </button>
          </div>
          {state === "error" && <p className="m-0 text-sm text-card-red">Couldn’t create the link. Try again in a moment.</p>}
        </>
      )}
    </section>
  );
}
