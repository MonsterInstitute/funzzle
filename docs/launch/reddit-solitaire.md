# r/solitaire

**Verdict: allowed, with conditions. The rules are vague and the sub is small, so make one solitaire-only post with flair.**

## Rules that apply (researched 2026-10-30)

Source: Wayback snapshots of the sub from 2026-03-03 and 2026-03-30. Reddit
blocked direct reads. The sub has about 5.2K weekly visitors.

- **Rule 1:** posts must be about the card game solitaire.
- **Rule 2:** "No spam". No details are given. Post once, and don't keep promoting afterwards.
- **Rule 4:** posts must have flair. **The flair names couldn't be recovered**, so pick the closest one on the submit page (something like "Discussion" or "App/Website", if offered).
- **Rule 5:** no low-effort posts.
- **Rule 7:** descriptive titles, not "Look at this".
- Link and text posts are both allowed. Use a text post so you can explain.
- None stated: frequency limits, disclosure rules, a promo thread, karma or age minimums.
- Developer posts do appear and seem to be tolerated when they stick to solitaire, for example "Solacy - Solitaire Legacy".
- **Audience:** players who care about whether deals can be won, draw 3, and scoring. Be precise about what "winnable" means.

## Post (text post, one image)

- **Flair:** the closest match on the submit page
- **Image:** `screenshots/03-solitaire-midgame-desktop.png`
- **Title:**

  > I made a free daily Klondike where every deal is proven winnable before it goes live (draw 1 and draw 3)

**Body:**

> I made a free solitaire site and wanted to share how the daily deal works, since unwinnable deals are the usual complaint.
>
> **Winnable, for real.** Every day there's one Klondike deal for everyone, in draw 1 and in draw 3. Before a deal is published, a solver has to play it all the way to four complete foundations. If it can't find a win, that deal is thrown out and the next one is tried. So "winnable" means a winning line was actually found, not that the deal was estimated likely winnable. The game shows a "Winnable deal" chip only when that's true.
>
> One caveat: **practice deals** are checked in your browser with a time budget. Usually that finds a win, but occasionally it hands you a deal it couldn't prove, and then the chip doesn't show.
>
> **Other things:**
> - The hint button suggests the best move and gives the reason (for example "turns over a hidden card in column 6"). On a proven deal, it follows the winning line.
> - Undo and auto-finish. You can go through the stock as many times as you like, with standard-style scoring: recycling costs 100 points in draw 1 and 20 in draw 3.
> - Your time and moves are ranked against everyone else who played today's deal.
> - Spider (1, 2 or 4 suits) and FreeCell have daily deals that are proven winnable the same way.
> - No account. On phones there are no ads on the game screen.
>
> Link: https://www.funzzle.com/play/solitaire
>
> I'd especially like to hear from draw-3 players whether the stock rules and scoring match what you expect.

The stock and scoring facts come from `lib/games/solitaire/engine.ts`
(`SCORE`, `recycle`). Recheck them if the engine changes.
