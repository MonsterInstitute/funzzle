/**
 * Interstitials between games and opt-in rewarded ads, on AdSense's H5 Games
 * Ad Placement API (adBreak). Both degrade cleanly when the site isn't
 * approved for H5 Games ads, an ad doesn't fill, or ads are blocked:
 *
 *   - an interstitial that doesn't show just continues to the next page;
 *   - a rewarded offer that never becomes available stays hidden, and the
 *     caller decides whether the reward is then free or unavailable
 *     (lib/ads/useRewardedOffer.ts).
 */
import { track } from "@/lib/games/kit/analytics";
import { adBreak } from "./adsense";

/** Show an interstitial (if one is ready), then load `href` as a new page view. */
export function nextWithBreak(href: string, name: string): void {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    location.assign(href);
  };
  const asked = adBreak({ type: "next", name, adBreakDone: go });
  // No API, or no answer from it: never hold the player up.
  setTimeout(go, asked ? 2500 : 0);
}

export type RewardOutcome = "rewarded" | "dismissed";

/**
 * Ask AdSense for a rewarded ad. `onReady` fires only if one is available —
 * that's when the caller shows its "Watch an ad for …" button; its argument
 * plays the ad and resolves "rewarded" only if it was watched to the end.
 * Without an ad (not approved, no fill, blocked) `onReady` never fires and
 * the offer simply never appears.
 */
export function requestReward(name: string, game: string, onReady: (watch: () => Promise<RewardOutcome>) => void): void {
  let viewed = false;
  let settle: ((o: RewardOutcome) => void) | null = null;
  const done = (o: RewardOutcome) => {
    if (!settle) return;
    track("rewarded_ad", game, { name, outcome: o });
    settle(o);
    settle = null;
  };
  adBreak({
    type: "reward",
    name,
    beforeReward: (showAdFn: () => void) =>
      onReady(
        () =>
          new Promise<RewardOutcome>((resolve) => {
            settle = resolve;
            showAdFn();
          })
      ),
    adViewed: () => {
      viewed = true;
      done("rewarded");
    },
    adDismissed: () => done("dismissed"),
    adBreakDone: () => done(viewed ? "rewarded" : "dismissed"),
  });
}
