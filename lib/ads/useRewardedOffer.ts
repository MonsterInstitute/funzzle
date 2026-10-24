"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestReward, type RewardOutcome } from "./placements";

/**
 * A rewarded-ad offer for the Game Kit: while `wanted`, ask AdSense for a
 * rewarded ad; `ready` turns true only when one is available. `watch()` plays
 * it and resolves true if the player earned the reward. `settled` turns true
 * once `waitMs` has passed without an ad, so a caller whose reward should be
 * free without ads (practice unlocks) knows when to stop waiting.
 */
export function useRewardedOffer(name: string, game: string, wanted: boolean, waitMs = 3000) {
  const [ready, setReady] = useState(false);
  const [settled, setSettled] = useState(false);
  const watchRef = useRef<(() => Promise<RewardOutcome>) | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    requestReward(name, game, (watch) => {
      if (!live) return;
      watchRef.current = watch;
      setReady(true);
    });
    const t = setTimeout(() => live && setSettled(true), waitMs);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, game, wanted, waitMs, round]);

  const watch = useCallback(async () => {
    const fn = watchRef.current;
    if (!fn) return false;
    watchRef.current = null;
    setReady(false);
    const outcome = await fn();
    // Ask for the next ad, so the offer can come back later.
    setRound((r) => r + 1);
    return outcome === "rewarded";
  }, []);

  return { ready, settled: settled && !ready, watch };
}
