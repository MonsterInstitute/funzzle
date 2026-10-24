# Funzzle Design Reference

The `.dc.html` files in this folder are visual mockups (they use a mockup runtime, `support.js`, which is NOT part of the product). Use them as the visual and UX source of truth; rebuild them as real Next.js + Tailwind components.

## Screens
- `Main.dc.html` — Homepage: Today's Daily Set, Puzzle Studio band, 20-game grid, NYT hints & answers, puzzle profile
- `Sudoku.dc.html` — Game screen pattern (top bar, chips, board, AI Coach card, tools, input pad)
- `Solitaire.dc.html` — Card game screen pattern with coach "best move"
- `Recap.dc.html` — Completion recap: time, percentile histogram, stats, coach recap, Daily Set progress, share, ad slot (only ad placement allowed around play)
- `Creator.dc.html` — Puzzle Studio: one-sentence prompt → solver-checked puzzle → refine by chat → share link / print
- `ShareCard.dc.html` — 1080×1080 (shown at 540) social result card, no spoilers

## Typography
- Display: Bricolage Grotesque 700–800, tight tracking (-0.02 to -0.04em)
- UI/body: Geist 400–700
- Numbers/time/labels: Geist Mono 500–600

## Core colors
- Ink `#111111`, ground `#FFFFFF`, muted text `#4A4A55` / `#55555F`, lines `#E6E6EC`, soft surface `#F4F5FA`
- Brand violet `#5B3DF5` (primary actions), deep violet `#3A22C9`, violet tint `#F1EEFF`
- AI Coach (reserved for hints/coach only): orange `#F26B1D`, tint `#FFF4EC`, border `#FFD6B8`
- Success `#1F7A4D`, card red `#C8102E`

## Game signature colors
Solitaire `#7FD6A0` · Sudoku `#9DB4FF` · Mahjong `#F6A6A1` · Minesweeper `#8FE3CF` · Spider Solitaire `#A7E07A` · FreeCell `#6FD0E8` · Word Search `#FFE066` · Crossword `#D9DCE6` · Mini Crossword `#FFD6A5` · Funzzle Word `#B5E48C` · Groups `#C9B8E8` · Spelling Hive `#FFD23F` · Word Hunt `#9EE6E0` · Letter Box `#FF9E9E` · 2048 `#FFC857` · Block Puzzle `#FFA978` · Nonogram `#D8B4FE` · Kakuro `#FFB8DA` · Jigsaw `#A9CBFF` · Chess `#DCCDB2`
Text on these tiles is always ink `#111111`. Each game page uses a light tint of its color for the header area.

## Shape & components
- Radii: tiles/cards 22–28px, pills 999px, inputs 14–18px, board 14px
- Buttons: min height 44px (primary 52px), pill shape; primary = ink or violet
- Icons: simple stroke SVG (2–2.4px), never emoji
- Each game has a geometric stroke glyph (paths in `Main.dc.html` renderVals)

## UX rules
- Zero ads during gameplay; ads only on recap/between games and on content pages
- No login required; progress in local storage
- Hints are a 3-step ladder (direction → specific → answer); answer pages never show the answer until tapped
- Mobile-first, one-hand play, touch targets ≥ 44px, text contrast ≥ 4.5:1
- Funzzle is independent: never use NYT game names as Funzzle game names
