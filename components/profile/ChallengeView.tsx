"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeadToHead, resultText } from "@/components/kit/ChallengePanel";
import { challengePlayHref, fetchChallenge, myEntry, type Challenge } from "@/lib/games/kit/challenge";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { isScoreGame } from "@/lib/games/kit/resultConfig";

/** /challenge?id=…: who set it, the board so far, and a button to play. */
export default function ChallengeView() {
  const [id, setId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(location.search).get("id");
    if (!value || !/^[a-z0-9]{8}$/.test(value)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL once after hydration
      setError(true);
      return;
    }
    setId(value);
    fetchChallenge(value)
      .then(setChallenge)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-[40px] font-extrabold tracking-[-0.03em]">Challenge not found</h1>
        <p className="m-0 text-muted">The link may be incomplete. Ask your friend to send it again, or play today’s puzzles.</p>
        <Link href="/#today" className="inline-flex min-h-[52px] items-center self-start rounded-full bg-ink px-6 font-semibold text-ground no-underline hover:text-ground">
          Play today’s puzzles
        </Link>
      </div>
    );
  }
  if (!challenge || !id) return <p className="text-muted">Loading the challenge…</p>;

  const game = GAME_BY_SLUG[challenge.game];
  const creator = challenge.entries.find((e) => e.creator) ?? challenge.entries[0];
  const played = !!myEntry(id);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-[28px] p-6 text-[#111111]" style={{ background: game?.color }}>
        <span className="font-mono text-xs uppercase tracking-[0.08em]">{challenge.label}</span>
        <h1 className="m-0 font-display text-[36px] font-extrabold leading-tight tracking-[-0.03em]">
          {played ? "Your challenge" : `${creator.name} challenges you`}
        </h1>
        <p className="m-0 text-[17px]">
          {creator.name} {isScoreGame(challenge.game) ? "scored" : "finished in"} <strong className="font-mono">{resultText(challenge.game, creator)}</strong>
          {creator.hints ? ` with ${creator.hints} hint${creator.hints === 1 ? "" : "s"}` : " without a hint"}. Same puzzle, your turn.
        </p>
        {!played && (
          <Link
            href={challengePlayHref(challenge.game, id)}
            className="inline-flex min-h-[52px] items-center self-start rounded-full bg-[#111111] px-6 font-semibold text-white no-underline hover:text-white"
          >
            Play the challenge
          </Link>
        )}
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-xl font-bold">Head to head</h2>
        <HeadToHead challenge={challenge} />
        <p className="m-0 text-sm text-muted">No sign-up needed. Results update within a minute.</p>
      </section>
    </div>
  );
}
