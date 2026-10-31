# Funzzle launch kit

Drafts for launching https://www.funzzle.com. Nothing here has been posted.
Every product claim below was checked against the code on 2026-10-30/31; the
"Source" column says where, so you can recheck before posting if the code
changes.

| File | For |
|---|---|
| [reddit-webgames.md](reddit-webgames.md) | r/WebGames |
| [reddit-sudoku.md](reddit-sudoku.md) | r/sudoku |
| [reddit-solitaire.md](reddit-solitaire.md) | r/solitaire |
| [reddit-crossword.md](reddit-crossword.md) | r/crossword |
| [reddit-puzzles.md](reddit-puzzles.md) | r/puzzles |
| [reddit-internetisbeautiful.md](reddit-internetisbeautiful.md) | r/InternetIsBeautiful |
| [producthunt.md](producthunt.md) | Product Hunt |
| [show-hn.md](show-hn.md) | Hacker News (Show HN) |
| [alternativeto.md](alternativeto.md) | AlternativeTo listing |
| [screenshots/](screenshots/) | PNGs used by the posts |

## Fact sheet (what you can claim, and the fine print)

| Claim | True as stated? | Fine print | Source |
|---|---|---|---|
| 20 games | Yes | Sudoku, Solitaire (Klondike draw 1/3), Spider (1/2/4 suits), FreeCell, Minesweeper, Mahjong, Word (+ Quad, Geo, Math modes), Mini crossword, Crossword, Groups, Spelling Hive, Letter Box, Word Hunt, Word Search, 2048, Block puzzle, Jigsaw, Nonogram, Kakuro, Chess (vs computer + daily puzzle) | `app/play/*`, `lib/games/kit/catalog.ts`, `lib/aeo.ts` |
| No login / no account | Yes | An anonymous client id and an optional display name live in the browser. Streaks, ratings and badges are **on the device**: clearing site data or switching devices loses them. Say so if asked. | `lib/games/kit/identity.ts`, `storage.ts` |
| Free | Yes | Every daily puzzle and the coach are free. Practice is 5 puzzles per game per day; after that an optional rewarded ad unlocks 5 more. If no rewarded ad is available (not approved, no fill, blocker), practice stays unlimited. | `lib/games/kit/practiceQuota.ts`, `components/kit/PracticeAction.tsx` |
| No ads during play | **On phones/tablets yes; on desktop only "nothing over the board"** | Phones and tablets: no ads on game screens, the AdSense script isn't even loaded. Desktop ≥1024 px: ads in the side margins beside the board (90+ px away). Result screen and homepage: one 300×250. An interstitial may show when you leave the recap for the next game/practice (at most one per 90 s). Opt-in rewarded ads for an extra hint/undo/second chance. Safe wording: "no ads interrupt a game; on phones there are none on the game screen at all". | `components/ads/*`, `lib/ads/*`, `components/kit/Recap.tsx` |
| Coach explains the logic step by step | Yes | Hint ladder from a logical solver (nudge → why → answer) in Sudoku, Minesweeper, Nonogram, Kakuro; best move + reason in Solitaire, FreeCell, Spider, Mahjong, 2048, Block, Chess; word games have their own ladders. For daily Sudoku, an LLM (DeepSeek) rewords each solver step ahead of time; replies that change the digit are dropped, and the hand-written guide is the fallback. No LLM call happens when you press a button. | `lib/games/sudoku/coach.ts`, `lib/cron/coachText.ts`, `app/api/coach/route.ts` |
| Daily deals/grids verified by a solver | Yes, per game | Klondike daily (draw 1 and 3): solver finds a full winning line or the deal is rejected. FreeCell daily: same. Spider: every daily deal proven winnable; 2- and 4-suit deals are proven offline (too heavy for a Worker). Sudoku: dug with a logic-only solver (logical finish ⇒ unique solution), graded by hardest technique. Minesweeper: no-guess, checked by a logical solver from the opening. Nonogram: line-solvable ⇒ unique. Kakuro: exact solver finds exactly one solution and the human-style solver finishes it. Mahjong: built backwards from an empty board and replayed. **Practice** Klondike deals try up to 6 random deals with a node budget and can occasionally be unverified (the UI shows the "Winnable deal" badge only when verified). | `lib/games/*/solver.ts`, `generate.ts`, `scripts/pregenerate-spider.ts` |
| Daily puzzles + archive | Yes | Archive from 2026-10-01. New puzzles at 00:00 UTC. | `app/archive`, `app/api/daily-puzzle/route.ts` |
| Streaks with freezes | Yes | One freeze banked per 7 streak days, max 2, spent automatically. | `lib/games/kit/daily.ts` |
| Friend challenges | Yes | Link to the same puzzle with your result; no sign-up on either side. | `lib/games/kit/challenge.ts` |
| Leagues with invite codes | Yes | Private, weekly boards. | `lib/games/kit/leagues.ts`, `app/leagues` |
| Passport / badges / skill trees | Yes | Per device. | `lib/games/kit/passport.ts`, `achievements.ts` |
| Works on mobile | Yes | Built phone-first; installable to the home screen (web manifest). | `app/manifest.ts` |
| Crossword/Mini/Groups/Word Hunt content | Disclose | Grids are filled in code from a word list; **clues/themes are written by an LLM (DeepSeek)** and validated in code (no answer in clue, length, real words, blocklist); failures fall back to a hand-written bank. Don't present the crosswords as hand-constructed. | `lib/cron/content/*` |
| Running cost | Approximately | Latest weekly report (2026-10-26): about **$1.79/month** at list price for funzzle's usage (Cloudflare $1.56 + DeepSeek $0.23), inside one $5/month Workers Paid plan shared with other sites. Traffic is still tiny, so don't extrapolate. | `reports/gsc/2026-10-26.md`, `docs/cloudflare-stack.md` |
| Not affiliated with NYT | Must say | The site also has unofficial NYT hint/answer pages and an "NYT games alternative" page with affiliate links. Expect people to notice the "Hints & answers" tab; mention it plainly where relevant. | `app/*-answers`, `components/AffiliateLink.tsx` |

Don't claim: user numbers, "AI-generated puzzles" as a selling point, "unlimited
practice" without the footnote, "no ads" without qualifier, "open source" (the
repo has no license and isn't public).

## Screenshots

Taken 2026-10-31 (UTC) with Playwright against production. Desktop at
1270×760 CSS px, 2× (2540×1520 files, same 5:3 ratio Product Hunt wants);
mobile at 390×844, 3×. On some desktop shots the page is zoomed to 72–80% so
the board and the coach fit in one frame. Ad and analytics requests were
blocked during capture (no ad impressions from automation), so ad slots are
empty.

| File | Shows |
|---|---|
| `01-home-daily-set-desktop.png` | Homepage, today's Daily Set |
| `02-sudoku-coach-desktop.png` / `-mobile.png` | Expert Daily Sudoku, coach hint 2 of 3 (naked single) with the cell outlined |
| `02b-sudoku-coach-teach-desktop.png` / `-mobile.png` | Same step, "Teach me this" open |
| `03-solitaire-midgame-desktop.png` | Daily Klondike after 30 coach moves, "Winnable deal" badge, coach "Best move · Winning line" |
| `04-word-game-desktop.png` / `-mobile.png` | Funzzle Word after two guesses, mode tabs (Classic/Quad/Geo/Math) |
| `04b-groups-desktop.png` | Daily Groups board |
| `05-recap-share-desktop.png` / `-mobile.png` / `-mobile-full.png` | Mini Crossword result screen: time, rating, coach recap, Daily Set progress, share/challenge |
| `05b-share-card.png` | The share card image the recap generates (1080×1080) |
| `06-home-mobile.png` | Homepage on a phone |

Nothing was submitted to production while scripting: every non-GET API call
(results, events, challenges) was intercepted in the browser and never sent.
The recap's "First to finish today" line is real: the stub answered with the
live day stats (a read-only GET), and nobody had finished that day's mini yet
at 03:55 UTC. The word screenshot shows two guesses against the 2026-10-31
word; harmless after that date.

The capture script is not in the repo (it lived in a scratch folder); the
approach: block `googlesyndication|doubleclick`, route `**/api/**` and fulfil
every non-GET locally.

## Before you post: checklist

- [ ] Reddit: read each sub's notes below; check your account age/karma (most
      subs filter new or low-karma accounts silently with AutoModerator and
      don't publish the thresholds). Comment normally in a sub for a while
      before posting there.
- [ ] r/WebGames: the sidebar says accounts need to be at least 7 days old with at least 10 comment karma. funzzle.com isn't on their domain whitelist, so a mod has to approve the post (expect a delay).
- [ ] r/sudoku: you get one App Announcement thread, ever. Make it count.
- [ ] r/crossword and r/InternetIsBeautiful: don't post (AI-content and no-webgames rules). r/puzzles: Promo Weekly comment only.
- [ ] Reddit rules were read from Wayback snapshots (Reddit blocked direct reads), some months old. Recheck each live sidebar.
- [ ] Don't post the same day in several subs; space them out (a few days
      apart) and stay in the comments for the first hours.
- [ ] Product Hunt: pick a launch day (see producthunt.md); use the account
      that will be the maker; get the gallery images in.
- [ ] Show HN: post when you can answer comments for 3–4 hours.
- [ ] Recheck the ad wording if ad placements change.
- [ ] Replace screenshots if the UI changes before launch.
