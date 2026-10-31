# Show HN

**Title** (≤80 characters):

> Show HN: Funzzle – daily puzzle games where every grid is checked by a solver

(77 characters.) Alternative: `Show HN: 20 browser puzzle games on Workers and D1, about $2/month to run` (73).

**URL:** https://www.funzzle.com

**Text** (goes in the text box; HN shows it under the link):

---

I made a free puzzle site with 20 games (Sudoku, Klondike, Spider, FreeCell, Minesweeper, Mahjong, a Wordle-style game, crosswords, Nonogram, Kakuro, chess puzzles and so on). No account; progress is kept in the browser. The parts that might interest HN:

**Every daily puzzle is proven before it goes live.** Each generator is paired with a solver and a puzzle is only published with a proof:

- Klondike (draw 1 and 3) and FreeCell: a search finds a full winning line, or the next seed is tried.
- Spider 1/2/4 suits: same idea, but proving 2- and 4-suit deals takes 250 MB–1 GB, more than a Worker's 128 MB, so a script pre-generates a year of them on my laptop and stores them in D1. The cron alerts me when fewer than 30 days are left.
- Sudoku: cells are removed only while a logic-only solver (singles, pairs/triples, pointing, X-Wing, Swordfish, XY-Wing) can still finish the grid. A logical finish implies a unique solution, so there's no separate uniqueness search, and the difficulty is the hardest technique the solve needed.
- Minesweeper: no-guess boards; a logical solver must clear the board from the opening cell.
- Nonogram: must be finished by line logic alone, which also proves uniqueness. Kakuro: an exact solver must find exactly one solution and a human-style solver must finish it.
- Mahjong solitaire: built backwards by placing pairs onto an empty board, then replayed forward.

The same solvers drive the hint system. A hint is the solver's next step shown in three rungs (where to look, why, the answer) rather than a peek at the stored solution.

**LLM text is checked by code, never trusted.** The crossword, mini, Groups and Word Hunt dailies use DeepSeek, but only for the language: grids are filled in code from a word list, and the model writes clues or proposes themes. Each reply is validated (no answer or answer stem in the clue, length limits, real words, a blocklist, letter counts done in code since models can't count), bad parts are re-requested with the problems spelled out, and a day that still fails falls back to a hand-written bank. Sudoku coach explanations are the solver's steps reworded by the model ahead of time; any reply that changes the digit is dropped. There are no LLM calls at request time.

**It all runs on one Cloudflare account.** Next.js on Workers via OpenNext, D1 for data and the ISR tag cache, R2 for the page cache, Cron Triggers for every scheduled job (generating puzzles a day or two ahead, LLM content, reminder emails), Analytics Engine for events (events never go to D1, where writes are the expensive unit), and Email Routing for failure alerts. Every DB call has a deadline and every data-load error throws, so an outage can't get cached as a 404. The weekly report puts funzzle's usage at about $1.80/month at list price (Cloudflare ~$1.56, DeepSeek ~$0.23), and that sits inside a $5/month Workers Paid plan I share with other sites. Traffic is small so far, so that number says little about scale.

How it pays for itself: ads, but none on the game screen on phones, and on desktop only in the side margins and on the result screen. The site also has unofficial hint/answer pages for the NYT daily puzzles, which bring in search traffic; it isn't affiliated with the NYT.

Happy to go into any of the solvers, the D1/OpenNext setup, or the LLM validation.

---

## Notes

- HN guidelines: Show HN must be something people can try without signing up (true). Don't ask for upvotes; don't have friends upvote or comment (the ring detector buries posts).
- Post on a weekday morning US time (roughly 8–10 a.m. Eastern) when you can stay for 3–4 hours.
- Likely questions, with answers ready:
  - *Why not one big solver library?* Each game's search is different (Klondike stock cycling vs FreeCell supermoves vs Spider's two decks); what they share is the pattern: a seeded RNG (`lib/games/kit/rng.ts`) and "if the proof fails, try the next derived seed".
  - *Is the source available?* No (no license, private repo). Say so plainly.
  - *Progress across devices?* Not yet; it's on-device by design (no accounts).
  - *Why DeepSeek?* Cost; the validation means the model can be swapped.
- Screenshot to have handy if asked (HN doesn't show images): `screenshots/03-solitaire-midgame-desktop.png` (the "Winnable deal" badge and the coach's winning line).
