# SEO variant / long-tail pages: ranked proposal

Researched 2026-10-30. Nothing has been built yet; this is a proposal only.

## How the evidence was gathered (and its limits)

I had no paid keyword tools and no Google Trends access (the API returned HTTP 429), and I did not scrape Google SERPs. Signals used:

- **Google autocomplete** (`suggestqueries.google.com`, en/US). A seed whose ten suggestions are all modifiers of the seed itself, especially when the first suggestion carries subtype `433/131`, means high volume. When suggestions turn into unrelated phrases or fall back to subtype `22/30`, the term is thinner. Every suggestion list cited below is quoted from these calls.
- **Who ranks**: web searches for each term. The search engine used is not Google, so treat the results as a rough picture of who competes, not as Google positions. Many results were spam on hijacked .gov/.edu subdomains (`*.lboro.ac.uk`, `*.icmbio.gov.br`, `shuduku.it.com`), which is itself a signal: printable and killer-sudoku SERPs are polluted, not owned by strong brands.
- **Funzzle Search Console** (`node scripts/gsc-report.mjs`, data through 2026-10-28, plus `reports/gsc/*.md`).
- **The codebase**: what each engine already supports (`lib/games/*`, `app/play/*`).

## The blocker to fix first: the /play pages are not indexed

From the 2026-10-31 GSC run:

- 90 days: **11 clicks and 1,369 impressions** across the whole site. **Zero** impressions came from any game query (sudoku, solitaire, mahjong, minesweeper and so on). Every impression came from `/clue`, `/word`, `/equation`, `/country` and brand queries.
- URL inspection shows `/play/sudoku`, `/play/solitaire`, `/play/mahjong`, `/play/minesweeper`, `/play/freecell`, `/play/chess`, `/play/2048`, `/play/word-search`, `/play/nonogram`, `/play/jigsaw` and `/play/crossword` as **"Discovered – currently not indexed"**. `/play/spider-solitaire`, `/play/kakuro`, `/play/word-hunt` and `/play/mini` are **"URL is unknown to Google"**. Only `/play/word`, `/play/word/math`, `/play/letter-box` and `/play/spelling-hive` are indexed.

A variant page is a child of a parent page that Google has not crawled yet. Adding 20 to 30 new URLs to a 4-month-old site that already submits thousands of thin-ish programmatic URLs (`/word/*`, `/clue/*`, `/equation/*`, `/country/*`) will not get them indexed by itself. Suggested order:

1. Make the parent `/play/*` pages crawl-worthy first: link them prominently from `/` and from every indexed page, and request indexing for each in GSC.
2. Consider trimming or `noindex`-ing the lowest-value programmatic pages. For example, `/word/level` sits at position 95. This frees crawl attention for the game pages.
3. Ship variants in small batches (3 to 5 pages). Link each from its parent with a visible level/variant selector made of real `<a href>` links, not JS-only buttons. Watch GSC for 2 to 3 weeks before the next batch.

Variant pages also help with this problem: they give the parent page real internal links and topical depth. But they will not rank before the parent page is indexed.

## What already exists (do not duplicate)

| Game | Variants the engine supports today | Existing variant URL? |
| --- | --- | --- |
| Sudoku | easy / medium / hard / expert (`lib/games/sudoku/generate.ts`), graded by the hardest technique used (11 techniques, up to xy-wing). Daily difficulty rotates by weekday. 9×9 only | none |
| Klondike | draw 1 and draw 3, both with daily deals the solver has verified winnable | none (one page holds both) |
| Spider | 1 / 2 / 4 suits, with daily deals (2 and 4 suits are pregenerated offline) | none (one page holds all three) |
| FreeCell | single variant. No Microsoft deal-number generator | — |
| Minesweeper | beginner 9×9/10, intermediate 16×16/40, expert 30×16/99 (plus a mobile layout). Boards are no-guess. Technique guide (1-1, 1-2, subset…) | none |
| Mahjong | 5 layouts: turtle, pyramid, fortress, bridge, quick | none |
| Chess | puzzle themes: mate-in-1/2/3, back-rank, fork, pin, skewer, discovered attack, win material (`lib/games/chess/themes.ts`). AI at 6 levels | none |
| Word search | 48 themes (`lib/games/wordsearch/themes.ts`), none of them holiday themes (no Halloween or Christmas) | none |
| Nonogram | 5×5, 10×10, 15×15 | none |
| Kakuro | easy 6×6 / medium 8×8 / hard 10×10 | none |
| 2048 | 4×4 only (`SIZE = 4` constant) | none |
| Jigsaw | 12/24/48/96 pieces. Pictures are procedural (day/sunset/night/autumn/blocks/sunburst/waves), not photos | none |
| Crossword | 11/13/15 templates | none |
| Word (Wordle-like) | classic, quad, geo, math. Length fixed at 5 (`WORD_LENGTH = 5`) | `/play/word/quad`, `/geo`, `/math` |

No game has print or PDF output.

## Ranked table

Effort: **S** = the engine already supports the variant; build a route, copy and links. **M** = small engine or data work. **L** = a new generator or new UI.

| # | Page (proposed URL) | Target keywords | Demand signal | Competition | Effort | Unique content that makes it non-thin | Priority |
|---|---|---|---|---|---|---|---|
| 1 | `/play/spider-solitaire/1-suit`, `/2-suits`, `/4-suits` | spider solitaire 1 suit / 2 suits / 4 suits, "… full screen online free", "spider solitaire strategy 2 suit" | Very strong. Each seed returns 10 own-modifier suggestions ("free no download", "full screen", "online", "tips", "rules"), and "spider solitaire strategy" autocompletes to each suit count | solitaire.com, arkadium, thesolitaire.com, 1001games, solitairenetwork, plus many pages.dev clones. **Every big competitor has a separate URL per suit count**, so our single combined page cannot match these queries | S (daily deals for all 3 suit counts already exist) | Today's solver-verified deal for that suit count; **solver win-rate stats per suit count** (run the solver offline over N random deals and publish the % winnable and average moves); strategy specific to that suit count; today's player percentile | **P1** |
| 2 | `/play/solitaire/turn-3`, `/play/solitaire/turn-1` | klondike solitaire turn 3 / draw 3, solitaire turn 1, "solitaire draw 1 vs draw 3" | Very strong. "klondike solitaire draw 3" expands to "turn 3 free / online free / green felt / no ads". "solitaire draw 1 or 3" plus "…reddit" shows the comparison question is common | solitaired.com, solitaires.com, solitaire.com, classicklondikesolitaire, idrlabs. All have a dedicated turn-3 URL | S | Daily winnable deal for that draw mode; **draw 1 vs draw 3 winnability from our solver** (answers the "draw 1 vs draw 3" question with data, not opinion); scoring differences | **P1** |
| 3 | `/play/sudoku/easy`, `/medium`, `/hard`, `/expert` | easy sudoku, hard sudoku online, expert sudoku, sudoku expert strategies, easy sudoku for beginners | Highest volume of all candidates. "sudoku easy/medium/hard/expert" each come back with subtype 433 and 10 own modifiers ("online free", "strategies", "tips", "level") | sudoku.com (very strong, a page per level), sudoku.academy, sudokuhit, websudoku, 247sudoku, plus spam. Hard to crack, but the payoff is large and long-tail modifiers ("expert strategies", "hard tips") are winnable | S/M: generator already grades these 4 levels; need one daily grid **per level** instead of the weekday rotation (cheap: 4 generations/day) | Daily grid for that level; **technique profile from our grader** ("expert grids this week needed x-wing 38%, xy-wing 21%…"); the specific techniques that level requires, with interactive coach examples; solve-time distribution from `game_results` | **P1** |
| 4 | `/play/sudoku/printable` (+ `?level=` stays one page; optional `/printable/easy` etc. later) | printable sudoku, printable sudoku pdf, … with answers, … 4 per page, large print sudoku, sudoku for kids printable | Very strong. "printable sudoku" returns 10 modifiers with subtype 433 ("puzzles free", "4 per page", "pdf", "with answers", "easy"). Every difficulty seed also autocompletes to "printable" or "printable pdf" | daily-sudoku.com (clean, a page per level), krazydad, plus a SERP full of hijacked .edu/.gov spam. **Weak quality at the top** | M: print stylesheet plus client-side PDF (generate in the browser, e.g. jsPDF or `window.print`, **no server function**) | Graded puzzles labelled with the techniques they need; 1/4/6 per page; large-print option; answer-key page; "today's daily, printable" | **P1** |
| 5 | `/play/chess/mate-in-1`, `/mate-in-2`, `/mate-in-3` | mate in 1 puzzles, chess puzzles mate in 2, mate in 3 puzzles, chess puzzles for beginners | Strong. Each seed returns 10 own-modifier suggestions ("for kids", "pdf", "with solution", "hard", "lichess"). "chess puzzles for beginners" → "… mate in 1" | lichess, chess.com, sparkchess (`/mate-in/two`), chessigma, apps. Strong but fragmented | S (themes already exist in `puzzle.ts`) | Daily puzzle of that theme; unlimited themed practice; coach explanation of the mating pattern; a mate-in-N technique guide; solve-rate stats | **P1** |
| 6 | `/play/minesweeper/expert` (then `/intermediate`, `/beginner`) | minesweeper expert, minesweeper expert size, expert tips, intermediate size/good time, no guess minesweeper expert | Moderate to strong, and **informational**: "world record", "size", "tips", "good time", "average time", "patterns". "minesweeper no guess" autocompletes strongly too | minesweeper.online, minesweeper.now/expert (has a leaderboard and FAQ), minesweeperblast. Medium | S | Board spec and mine density table; **no-guess** expert board; our player time distribution (answers "good time for intermediate"); pattern guide (1-1, 1-2, subset) already in `techniqueGuide.ts`; world-record context | **P2** |
| 7 | `/play/kakuro/combinations` (a tool page) | kakuro combinations, kakuro combinations chart (pdf/printable), kakuro cheat sheet, killer sudoku cheat sheet | Strong for the size of the niche. "kakuro combinations" → chart / calculator / list / pdf / printable. "kakuro and killer sudoku cheat sheet" also appears, and "killer sudoku cheat sheet / calculator" appears under killer sudoku | Old static sites, PDFs. **Low competition** | S (kakuro technique logic exists) | Interactive calculator (sum, cell count, excluded digits → combos); full printable chart; links into the daily kakuro; reused later by killer sudoku | **P2** |
| 8 | `/play/word-search/printable` + seasonal `/play/word-search/christmas` | word search printable (for adults / kids / large print / hard), christmas word search, word search for kids | Very strong, but intent is mostly **printable** ("word search printable" returns 10 modifiers: pdf, for adults, for kids, hard, large print). Holiday seeds are seasonal | Printable and teacher sites; the SERP is heavily polluted with spam | M: print layout; add Christmas, Thanksgiving and Halloween themes to `themes.ts` | Fresh generated grid per print, a choice of 48+ themes, sizes and difficulty (directions), answer key, large print. Holiday pages carry a daily holiday grid during the season | **P2** (build the Christmas theme by mid-November; Halloween is too late for 2026) |
| 9 | `/play/mahjong/turtle` (then `/pyramid`) | mahjong turtle, mahjong turtle layout/setup, mahjong pyramid solitaire, mahjong solitaire layouts | Moderate. "mahjong turtle" → setup / layout / online / free / rules. "mahjong pyramid" → setup / solitaire free / layout. "mahjong titans" is strong but a trademark (Microsoft) | themahjong.com (a page per layout, 200+ layouts), mahjong.now, mahjong.ooo. Medium | S | Layout diagram (layers, tile count); clear rate from our generator and solver; layout-specific tips (which stacks to open first); the daily Turtle deal is already the default | **P2**: only turtle and pyramid. Do not make a page for every layout |
| 10 | `/play/word/6-letters` | 6 letter word game, "wordle 6 letters", "… unlimited" | Strong. "wordle 6 letters" carries subtype 433 with solver / unlimited / today modifiers. "wordle unlimited" is huge | wordleunlimited clones, sites.google mirrors, pages.dev clones. Crowded, low quality | M: needs a curated 6-letter answer list and dictionary; the engine has `WORD_LENGTH = 5` | Daily 6-letter puzzle plus unlimited practice; coach that explains the best split; letter-frequency stats for 6-letter words | **P2**. Trademark caution: see Risks |
| 11 | `/play/sudoku/4x4`, `/6x6` (for kids) | sudoku 4x4, sudoku 6x6, sudoku for kids (printable, easy) | Strong. "sudoku 4x4" and "sudoku 6x6" each return 10 own modifiers; "sudoku for kids" → 4x4 / 6x6 / printable | Kids and teacher printable sites, plus spam. Low to medium | L: generator, grid and UI are 9×9-only | Kid-friendly UI, very large cells, printable sheets, a first-sudoku teaching path | **P3** |
| 12 | `/play/killer-sudoku` | killer sudoku, killer sudoku online (free), rules, tips, cheat sheet | Strong. "killer sudoku" carries subtype 433 with online / calculator / cheat sheet / solver | dailykillersudoku, sudoku.com/killer, krazydad, plus a SERP flooded with `shuduku.it.com` spam | L: new game (cage generation, uniqueness, UI) | A new game, not a variant: daily killer, cage-sum coach, combination tool (#7) | **P3** (high value, large build) |
| 13 | `/play/nonogram/15x15` (and 5×5) | nonogram 15x15, nonogram 5x5, picross online | Weak to moderate ("15x15 online / printable / tips"; "5x5 online / pdf"). "picross" is a Nintendo trademark | pixelogic, onlinenonograms, brainplay. Medium | S | Size-specific picture sets, technique stats per size | P3 |
| 14 | `/play/2048/5x5` | 2048 5x5 | Moderate niche ("game", "online", "world record") | play2048 clones | M (`SIZE` constant) | Coach on a 5×5 board, score distribution | P4 |
| 15 | `/play/sudoku/16x16` | sudoku 16x16 (numbers only / letters) | Moderate niche. Mostly printable intent | Printable spam, a few generators | L | Hexadoku generator plus print | P4 |
| 16 | FreeCell deal number (`/play/freecell?deal=11982` as one page, not one page per deal) | freecell 11982, freecell deal number | Small but persistent ("11982 solution / solved / play") | Forums, Wikipedia | M: Microsoft deal LCG (public algorithm) | Play any Windows deal number; explainer page for the unwinnable deal #11982 with solver proof. **Not 32,000 pages** | P4 |
| 17 | Crossword easy / for kids / printable | crossword for kids, crossword printable, easy crossword | Strong but printable- and kids-dominated | Teacher and printable sites, Boatload, Washington Post. High | M/L (needs a kids' clue bank; print layout) | Printable daily crossword | P4 |
| 18 | Jigsaw by theme or piece count | halloween jigsaw puzzle online, jigsaw puzzles free online 500 / 1000 | Strong head terms, but the intent wants **photos** and high piece counts | jigsawplanet, jigsawexplorer. Very strong | L (we have procedural pictures and a 96-piece max) | Weak fit with what we have | **Skip** |
| 19 | Sudoku "evil" | sudoku evil, evil 17 | Moderate. A websudoku-branded level name | websudoku, sudoku.com | M (needs a level beyond xy-wing, plus 17-clue grids) | Only worthwhile with harder techniques | Skip for now; fold into the expert page |
| 20 | Any "unblocked" page | sudoku/solitaire/2048 unblocked | Exists ("sudoku unblocked games / google sites"). "minesweeper unblocked" returned **no** suggestions | Google Sites mirrors and GitHub pages | — | — | **Do not build** (see Risks) |

### Technique and strategy pages (an addition to the candidate list)

The site's real differentiator is the coach and solver. Informational queries have far less brand competition than "play X" queries:

- `/play/sudoku/techniques/x-wing` (and swordfish, xy-wing, hidden pair…): "x wing sudoku" returns 10 own modifiers (explained / examples / practice / technique). "sudoku techniques" → advanced / x wing / skyscraper / xy wing / "when stuck". Our solver can produce a live example grid with each technique highlighted, and a practice button can load a grid whose hardest step is that technique. **Strong P2.** Ship the technique sections as part of the difficulty pages (#3) first, and split them into their own pages only if they draw impressions.
- `/play/minesweeper/patterns`: "minesweeper patterns" → guide / cheat sheet / practice / 1-2-1 / pdf. `techniqueGuide.ts` already has the content. P2/P3.

## Recommended first batch (build in this order)

Precondition: the parent `/play/*` pages get indexed (see the blocker above). Each page below uses `generateStaticParams` with `dynamicParams = false` (the variant list is fixed and small) and a self-referencing canonical. The parent page links to each variant with real anchors.

1. **Spider: `/play/spider-solitaire/1-suit`, `/2-suits`, `/4-suits`**. Engine and daily deals already exist. Every major competitor targets suit-count URLs, and our solver-backed win-rate data per suit count is content no clone has.
2. **Klondike: `/play/solitaire/turn-3`, `/turn-1`**. Zero engine work, huge "turn 3" demand, and we can answer "draw 1 vs draw 3" with solver winnability data.
3. **Sudoku: `/play/sudoku/easy`, `/medium`, `/hard`, `/expert`**. These are the biggest queries on the list. The grader already labels levels, so each page gets a daily grid for its level plus a technique profile and guide.
4. **Chess: `/play/chess/mate-in-1`, `/mate-in-2`, `/mate-in-3`**. The puzzle themes already exist, demand is strong, and mate-in-1 doubles as a beginner page.
5. **Printable sudoku: `/play/sudoku/printable`**. This is the highest-demand modifier across every sudoku query, with a weak, spam-polluted SERP. Generate the PDF client-side, at zero server cost.
6. **Kakuro combinations tool: `/play/kakuro/combinations`**. A cheap, evergreen, low-competition tool that killer sudoku can reuse later.
7. **Minesweeper expert: `/play/minesweeper/expert`** (intermediate and beginner after it). It targets the informational queries (size, tips, good time) with our data and no-guess boards.
8. **Printable word search plus Christmas theme: `/play/word-search/printable`, `/play/word-search/christmas`**. Matches the dominant printable intent. Ship by mid-November for the season.
9. **Mahjong turtle: `/play/mahjong/turtle`**. It is the canonical layout, and the daily deal is already Turtle. Add pyramid only if turtle gets impressions.
10. **6-letter word game: `/play/word/6-letters`**. Strong demand, but it needs a word list and must avoid "Wordle" in the title and H1.

This adds about 21 URLs in total. Ship batches 1+2, then 3+4, then the rest, a few weeks apart.

## Risks and flags

- **Doorway / thin pages.** A variant page that only changes a default parameter in the same widget is a doorway in Google's eyes. Each page must carry something that page alone has: its own daily puzzle, its own stats, its own guide text (at least ~300 words specific to the variant), and its own FAQ. Do **not** generate a page for every combination (layout × difficulty, theme × size, FreeCell deal 1–32000, jigsaw piece counts). Keep the set small and fixed.
- **Duplicate intent with the parent page.** The parent `/play/sudoku` targets "daily sudoku" and "sudoku". The children target "<level> sudoku". Do not repeat the parent's title pattern on the children. Each child should canonicalise to itself; do not canonicalise children to the parent.
- **Trademarks.** "Wordle" is an NYT trademark. Use "6-Letter Word Game" in the title and H1, and mention Wordle only descriptively in the body ("like Wordle, with six letters"). `/wordle-free` already takes this risk, so do not add to it. Do not use "Mahjong Titans" (Microsoft), "Picross" (Nintendo) or "Microsoft Solitaire" as page names. Explaining "Windows FreeCell deal #11982" factually is fine.
- **"Unblocked" pages: do not build.** The term's whole intent is getting around school and workplace web filters. Building for it means deliberately helping minors bypass their school's policy. The SERP is Google Sites mirrors and spam, the monetisation is poor (and ad networks may restrict it), and it could get Funzzle itself added to filter lists. The legitimate version is simply a fast, ad-light site that works on Chromebooks.
- **Printable / PDF.** Generate in the browser. A server-side PDF route would be a function invocation per download and an ISR/cache surface. If a server route is ever needed, cache it hard and validate the parameters.
- **Daily-per-variant cost.** Per-level sudoku and per-theme chess dailies add rows to the daily cron (D1). This is cheap, but extend the existing pregeneration rather than generating on request. Spider 2- and 4-suit deals already need offline pregen and must not fall back to generating on request.
- **Seasonal timing.** Halloween is tomorrow, so it is too late for 2026. Plan Christmas (peaks in December) and next year's Halloween (build by late September).
- **Expectations.** With 11 clicks in 90 days and the parent pages unindexed, none of this moves traffic until Google crawls `/play/*`. Measure each batch in GSC (impressions per variant URL after 3–4 weeks) before building the next.
