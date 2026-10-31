# r/crossword

**Verdict: don't post Funzzle here right now. Rule 3 bans AI content, and Funzzle's crossword clues are written by an LLM.**

## Rules that apply (researched 2026-10-30)

Source: Wayback snapshots of the sub from 2026-04-07 and 2026-04-28. Reddit
blocked direct reads. The sub has about 38K weekly visitors. It's centred on
American (NYT-style) crosswords, with daily NYT discussion threads posted by a
bot. Cryptics go to r/crosswords.

The sub has only three rules:

- **Rule 1, "Related to crosswords":** "Wordle clones and similar games will be removed. If it doesn't have a grid, it doesn't belong here." Funzzle Word, Groups, Spelling Hive and so on are out.
- **Rule 2:** no homework.
- **Rule 3, "No AI":** "No AI-generated content."

There's no self-promotion rule, no flair requirement and no promo thread.

**Community mood:** a meta post on 2026-04-01, "Meta: can we ban 'look at this
word game I created' posts?", reached about 192 points. The indie posts that
do well are grids made by a person, posted as text, for example
"Patchwork - a new crossword variant".

## Why Funzzle doesn't qualify

From the code (`lib/cron/content/crossword.ts`, `lib/cron/content/mini.ts`):

- The grids are filled in code from a word list.
- The **clues are written by DeepSeek** and then checked in code: the answer can't appear in its clue, lengths have to be sane, and so on.
- When the model's output fails those checks, the site falls back to banks of puzzles in the repo (`lib/games/crossword/bank.ts`, `lib/games/mini/bank`). Unless you wrote those clues yourself, don't describe them as human-constructed.

Posting the Daily Crossword or the Mini here would break Rule 3. Being honest
about the LLM would just get it removed faster, and leaving it out would be
misleading. Either way it would burn goodwill in the community you'd most
want for a crossword.

## What you can do instead

1. **Nothing for now.** Post in r/WebGames and r/sudoku first.
2. **Later, if you clue a puzzle yourself:** a text post sharing one specific
   puzzle you clued by hand is in scope. Be upfront that it's a small indie
   site, that this puzzle was clued by you, and that the site's regular daily
   crosswords use machine-written clues. Draft for that case only:

   - **Type:** text post
   - **Title:**

     > I hand-clued a 15x15 themeless for my small puzzle site, and I'd love feedback on the cluing

   - **Body:**

     > I run a small indie puzzle site (not affiliated with any paper). I wrote every clue in this one myself. Fair warning: the site's regular daily crosswords use machine-written clues with automated checks, and they're nowhere near a constructed puzzle. This one is my attempt at doing it properly.
     >
     > [link to that specific puzzle]
     >
     > I'm looking for honest notes on clue fairness and fill quality. No sign-up needed to play.

   This needs a way to link a single hand-clued puzzle, which the site doesn't
   have yet. Don't use this draft until it does.

3. **Keep an eye on the rules.** If the sub's mods ever add an indie or self-promo thread, ask them in modmail before posting.
