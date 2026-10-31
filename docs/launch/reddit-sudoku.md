# r/sudoku

**Verdict: allowed, with conditions. You get one announcement thread.**

## Rules that apply (researched 2026-10-30)

Source: a Wayback snapshot of the sub from **2025-10-14**, about a year old.
Recheck the live sidebar before posting.

- **Rule 2, "Don't spam your video channel/app":** "Post one thread with it, and if it's good people will notice. Do not mention it in every post." That means one launch post, and no plugging the site in comments afterwards.
- **Rule 4:** a post that discusses a time or a performance has to include the puzzle.
- **Rule 7:** nothing unrelated to Sudoku. Post about Sudoku only, not all 20 games.
- **Flair: "App Announcement".**
- Account-age and karma minimums, and any disclosure rule: none published.
- **Audience:** strong solvers who know the techniques. They'll check two things: whether puzzles are unique, and whether the grading is honest. Hype or a misused technique name gets picked apart.

## Post (text post, with one image)

- **Flair:** App Announcement
- **Image:** `screenshots/02-sudoku-coach-desktop.png` (or the `-mobile` one)
- **Title:**

  > I made a free daily Sudoku whose grids are dug by a logic-only solver, graded by the hardest technique needed, with a hint coach that names the step

**Body:**

> Hi r/sudoku. I made a free daily Sudoku at https://www.funzzle.com/play/sudoku and wanted to explain how the grids are made, since that's what people here care about.
>
> **Uniqueness.** The generator starts from a full solution grid and removes givens only while a logic-only solver can still finish the puzzle. It never guesses or backtracks. A grid that logic alone can finish has exactly one solution, so every published grid is unique without a separate brute-force uniqueness check.
>
> **Grading.** The grade is the hardest technique the solver needed:
> - Easy: singles only.
> - Medium: one kind of intermediate technique (pointing, claiming, a naked or hidden pair).
> - Hard: naked/hidden triples, or two different intermediate techniques in the same solve.
> - Expert: up to X-Wing, Swordfish and XY-Wing.
>
> No chains, coloring or uniqueness-based techniques yet, so "Expert" here means XY-Wing level, not extreme. The daily follows the week: Easy Monday, Expert Saturday.
>
> **The coach.** The coach is the same solver, not a lookup of the stored solution. A hint comes in three steps. First it outlines the cell or unit to look at. Then it says why, for example "naked single: its row, column and box leave only 1". Then it gives the digit. "Teach me this" explains the technique in plain words. If you've entered a wrong digit, the coach points that out first, since a logical step built on a wrong digit would be nonsense.
>
> **Other details:**
> - No account, and pencil marks.
> - Three mistakes allowed on the daily.
> - Practice grids at any level.
> - On phones there are no ads on the game screen.
>
> It's the same grid for everyone each day, and your time is compared with everyone else's. If you find a grid that seems mis-graded, or a hint explanation that's wrong, I'd like to hear about it. The technique explanations are the part I most want checked by people who know them well.

## After posting

- Answer technique questions in detail.
- Don't link the site again in other threads (Rule 2).
- If someone asks for harder puzzles: chains and coloring aren't implemented. Say so plainly.
