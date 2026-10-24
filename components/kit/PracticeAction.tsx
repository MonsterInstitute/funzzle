"use client";

import { useState } from "react";
import { nextWithBreak } from "@/lib/ads/placements";
import { useRewardedOffer } from "@/lib/ads/useRewardedOffer";
import { FREE_PRACTICE, practiceLocked, UNLOCK, unlockPractice } from "@/lib/games/kit/practiceQuota";

/**
 * The recap's "play a practice puzzle" button. It loads `href` as a new page
 * view, with an interstitial between games when one is ready. After
 * FREE_PRACTICE practice puzzles in a day, it offers an opt-in rewarded ad
 * that unlocks UNLOCK more — and when no rewarded ad is available, practice
 * just stays free.
 */
export default function PracticeAction({ game, href, label }: { game: string; href: string; label: string }) {
  const [locked] = useState(() => practiceLocked(game));
  const offer = useRewardedOffer(`${game}-practice-unlock`, game, locked);
  const cls = "min-h-[52px] rounded-full border border-line-strong px-4 text-[15px] font-semibold text-ink";

  if (locked && offer.ready) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className={cls}
          onClick={async () => {
            if (await offer.watch()) {
              unlockPractice(game);
              location.assign(href);
            }
          }}
        >
          Watch a short ad to unlock {UNLOCK} more practice puzzles
        </button>
        <span className="text-center text-xs text-muted-2">
          You’ve played today’s {FREE_PRACTICE} free practice puzzles. The daily puzzle is always free.
        </span>
      </div>
    );
  }
  return (
    <button type="button" className={cls} onClick={() => nextWithBreak(href, `${game}-practice`)}>
      {label}
    </button>
  );
}
