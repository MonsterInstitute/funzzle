/**
 * Answer-first copy: the 1–2 sentence summary each page opens with and the
 * questions people actually search for, answered directly (components/seo/QandA).
 * Answers that would spoil a puzzle are fine here: QandA keeps each answer
 * closed until tapped.
 */
import type { QA } from "@/components/seo/QandA";
import type { ConnectionsAnswerData, CrosswordAnswerData, WordleAnswerData } from "@/lib/getAnswers";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const vowelsIn = (w: string) => (w.match(/[aeiou]/gi) ?? []).length;

// ---------------------------------------------------------------------------
// Homepage and game pages
// ---------------------------------------------------------------------------

export const HOME_QA: QA[] = [
  {
    q: "What is Funzzle?",
    a: "Funzzle is a free daily puzzle playground: Sudoku, Solitaire, word games and more, with a new Daily Set every day that everyone plays, a coach that explains the next logical move, and a rank against today's players.",
  },
  {
    q: "Is Funzzle free?",
    a: "Yes. Every game, the daily puzzles, unlimited practice and the coach are free, with no account. Funzzle is paid for by ads, which never appear while you're playing.",
  },
  {
    q: "What is the Daily Set?",
    a: "Four puzzles that are the same for everyone today: Daily Sudoku, Daily Solitaire, Daily Word and the Mini Crossword. Finish any of them to keep your streak; your time is ranked against everyone who played the same puzzle.",
  },
  {
    q: "When do new daily puzzles come out?",
    a: "Every day at midnight UTC (8 p.m. Eastern in summer, 7 p.m. in winter). The hints and answers for the day's NYT puzzles go up at the same time.",
  },
  {
    q: "Do I need an app or an account?",
    a: "No. Funzzle runs in any phone, tablet or computer browser, and your streak, rating and progress are saved on your device.",
  },
  {
    q: "Is Funzzle affiliated with The New York Times?",
    a: "No. Funzzle is independent. Its hint and answer pages for the NYT's daily puzzles are unofficial guides; its own games are original.",
  },
];

export const GAME_GUIDES = {
  sudoku: {
    name: "Daily Sudoku",
    genre: "Puzzle",
    summary:
      "Daily Sudoku is a free 9×9 Sudoku that's the same grid for everyone today, from Easy on Monday to Expert on Saturday. Stuck? The coach points to the next logical step and explains the technique, and when you finish you see how your time ranks against today's players.",
    description: "Free daily Sudoku with a step-by-step coach, from easy to expert, plus unlimited practice.",
    qa: [
      {
        q: "How do you play Sudoku?",
        a: "Fill the 9×9 grid so every row, every column and every 3×3 box contains the digits 1 to 9 exactly once. The starting digits are fixed; every puzzle has exactly one solution, which you can reach by logic alone.",
      },
      {
        q: "How do you solve a hard Sudoku?",
        a: "Start with singles: a cell with only one possible digit (naked single) or a digit with only one possible cell in a row, column or box (hidden single). When those run out, use pencil marks and look for pairs, pointing and claiming, then X-Wings and XY-Wings. The coach shows you which technique the next step needs.",
      },
      {
        q: "How hard is today's Daily Sudoku?",
        a: "It follows the week: Monday is Easy, Tuesday and Wednesday are Medium, Sunday is Medium, Thursday and Friday are Hard, and Saturday is Expert. The difficulty is graded by the hardest technique the grid needs.",
      },
      {
        q: "Does Daily Sudoku have a hint button?",
        a: "Yes. The coach gives up to three hints per puzzle, each in steps: first where to look, then the technique, then the digit. Hints are counted in your result but never block your rank.",
      },
      {
        q: "Can I play more than one Sudoku a day?",
        a: "Yes. After the daily grid, Practice gives unlimited new puzzles at the level you choose, from Easy to Expert.",
      },
    ],
  },
  solitaire: {
    name: "Daily Solitaire",
    genre: "Card game",
    summary:
      "Daily Solitaire is free Klondike with one deal for everyone today, checked by a solver to be winnable, in draw-1 or draw-3. The coach suggests the best move and explains why, and your time and moves are ranked against today's players.",
    description: "Free daily Klondike Solitaire, verified winnable, with a best-move coach and unlimited practice deals.",
    qa: [
      {
        q: "How do you play Klondike Solitaire?",
        a: "Build four foundation piles from Ace to King, one per suit. In the seven tableau columns you can stack cards in descending order with alternating colors, move runs between columns and put only a King in an empty column. Turn cards from the stock when you're out of moves.",
      },
      {
        q: "Is every Solitaire game winnable?",
        a: "No: roughly 1 in 5 random Klondike deals can't be won. Funzzle's daily deals are checked by a solver before they go live, so today's deal always has a winning line.",
      },
      {
        q: "What is the difference between draw 1 and draw 3?",
        a: "In draw 1 you turn one card from the stock at a time, so every card is reachable; it's the easier game. In draw 3 you turn three and can only play the top one, which makes planning matter much more.",
      },
      {
        q: "What's the best Solitaire strategy?",
        a: "Turn over face-down tableau cards whenever you can, empty a column only when you have a King to put there, and don't rush cards to the foundations if they're still needed to hold lower cards. The coach's best move follows these rules.",
      },
    ],
  },
  freecell: {
    name: "Daily FreeCell",
    genre: "Card game",
    summary:
      "Daily FreeCell is free FreeCell with one deal for everyone today, checked by a solver to be winnable. All 52 cards are dealt face up into eight columns, with four free cells and four foundations. Runs move as supermoves, safe cards go home on their own, and the coach shows the best move and why. Your time and moves are ranked against today's players, and practice deals are unlimited.",
    description: "Free daily FreeCell, solver-verified winnable, with supermoves, a best-move coach and unlimited practice deals.",
    qa: [
      {
        q: "How do you play FreeCell?",
        a: "Move all 52 cards to the four foundations, Ace to King in each suit. In the eight columns you can put a card on one rank higher of the opposite color, park any single card in one of the four free cells, and put any card or run in an empty column. Every card is face up from the start, so it's all planning and no luck.",
      },
      {
        q: "Is every FreeCell game winnable?",
        a: "Almost: all but one of the classic 32,000 numbered Microsoft deals (#11982) can be won, and estimates put unwinnable random deals at roughly 1 in 80,000. Funzzle doesn't rely on the odds: every daily deal is checked by a solver that finds a full winning line before the deal goes live.",
      },
      {
        q: "What is a supermove in FreeCell?",
        a: "A supermove carries a whole run of cards at once, as a shortcut for moving them one by one through free cells and empty columns. You can move (free cells + 1) × 2^(empty columns) cards, halved when the destination is itself an empty column. With two free cells and no empty column, that's three cards.",
      },
      {
        q: "What's the best FreeCell strategy?",
        a: "Free the Aces and twos early, keep free cells empty as long as you can, and treat an empty column as your most valuable space, worth more than a free cell. Before filling a cell, check whether the move frees a card that can go home. The coach's best move follows a solver's winning line when it has one.",
      },
      {
        q: "Can I undo moves in Daily FreeCell?",
        a: "Yes. Practice deals have unlimited undo. Today's daily deal is ranked, so it gives three free undos; you can watch an optional short ad for one more when one is available. Hints and undos are both shown in your result.",
      },
    ],
  },
  minesweeper: {
    name: "Daily Minesweeper",
    genre: "Puzzle",
    summary:
      "Daily Minesweeper is a free no-guess Minesweeper: one 16×16 board with 40 mines for everyone today, opening at the center, where every cell can be worked out by logic. Stuck? The coach points to the next safe cell or mine and explains why, and your time ranks against today's players.",
    description: "Free daily no-guess Minesweeper with a step-by-step coach, plus unlimited Beginner, Intermediate and Expert practice.",
    qa: [
      {
        q: "How do you play Minesweeper?",
        a: "Open every cell that isn't a mine. Each opened cell shows how many of its neighbors hide mines; use those numbers to work out which hidden cells are safe and which to flag. Opening a mine ends the game. Tap or left-click to open a cell; long-press, right-click or turn on Flag mode to place a flag.",
      },
      {
        q: "Is every Minesweeper board solvable without guessing?",
        a: "On Funzzle, yes. Every board is checked by a logical solver before you get it: from the opening at the center, each cell can be proved safe or a mine from the numbers (and, near the end, the count of mines left). A layout that would need a guess is thrown away and a new one is generated.",
      },
      {
        q: "What do the numbers in Minesweeper mean?",
        a: "A number counts the mines in the up to eight cells touching it, diagonals included. A blank opened cell touches no mines, so its neighbors open automatically. The counter above the board shows the mines left: total mines minus the flags you've placed.",
      },
      {
        q: "What is chording in Minesweeper?",
        a: "When a number already has that many flags around it, tap or click the number to open all its other hidden neighbors at once. If one of those flags is wrong, chording opens a mine and ends the game, as in the classic version.",
      },
      {
        q: "How big are Beginner, Intermediate and Expert boards?",
        a: "Beginner is 9×9 with 10 mines, Intermediate is 16×16 with 40 mines, and Expert is 30×16 with 99 mines, stood upright to 16×30 on phones. The daily board is Intermediate; Practice gives unlimited boards at any level.",
      },
    ],
  },
  mahjong: {
    name: "Mahjong Solitaire",
    genre: "Puzzle",
    summary:
      "Mahjong Solitaire is a free tile-matching game: clear the board by removing pairs of matching tiles that are free. Today's deal is a 144-tile Turtle that's the same for everyone, generated so it can be cleared, and practice offers four more layouts, including a 72-tile board for phones. The coach shows a match and says why it's a good one.",
    description: "Free daily Mahjong Solitaire: a 144-tile Turtle that can always be cleared, with a coach, reshuffles and practice layouts.",
    qa: [
      {
        q: "How do you play Mahjong Solitaire?",
        a: "Tap two matching tiles that are both free to remove them. Keep matching pairs until the board is empty. Tiles are stacked in layers, so each match can free the tiles under it or beside it; the skill is choosing which pair to take when more than one is open.",
      },
      {
        q: "Which tiles are free in Mahjong Solitaire?",
        a: "A tile is free when no tile lies on top of it, even partly, and its left or right side is open: no tile touching it on that side in the same layer. Tiles that are blocked on both sides, or covered, can't be picked yet.",
      },
      {
        q: "Do flowers and seasons match each other?",
        a: "Any flower matches any other flower, and any season matches any other season, even though their pictures differ. A flower never matches a season. Every other tile only matches a tile with exactly the same face, such as two 5 Bamboo or two Red Dragons.",
      },
      {
        q: "Is every Mahjong Solitaire deal solvable?",
        a: "Not if tiles are placed at random: some random deals can't be cleared. Funzzle builds each deal by placing matching pairs backwards from an empty board, then replays the winning line to check it, so every daily and practice deal can be cleared. If you get stuck, undo or use a shuffle, which rearranges the remaining tiles into another clearable position.",
      },
      {
        q: "What's the best strategy for Mahjong Solitaire?",
        a: "Free the tall stacks and the long rows first; tiles on the edges can wait. When all four of a kind are free, any pairing is safe. When three are free, take the pair that frees the most and keep the third for the last one. The coach's suggested match follows these rules.",
      },
    ],
  },
  "spider-solitaire": {
    name: "Spider Solitaire",
    genre: "Card game",
    summary:
      "Spider Solitaire is a two-deck patience game: build King-to-Ace runs of one suit in ten columns until all eight are cleared. Funzzle has a free daily deal in 1, 2 or 4 suits, each checked by a solver to be winnable, with unlimited undo and a coach that suggests the best move.",
    description: "Free daily Spider Solitaire in 1, 2 or 4 suits, verified winnable, with unlimited undo and a best-move coach.",
    qa: [
      {
        q: "How do you play Spider Solitaire?",
        a: "104 cards are dealt into ten columns, with only the top card of each face up. Put any card on a card one rank higher, whatever the suit; a run of one suit in order moves together. A complete run from King down to Ace of one suit is cleared from the table, and you win when all eight runs are gone. When you're stuck, deal a new row of ten cards from the stock.",
      },
      {
        q: "What is the difference between 1, 2 and 4 suits?",
        a: "The cards are the same 104, but with one suit every card is a spade, so any run you build can move and be cleared. With two suits (spades and hearts) and especially four, cards of different suits get mixed in your columns and can't move together, which makes the game much harder. One suit is a good start; four suits is a real challenge.",
      },
      {
        q: "Is every Spider Solitaire game winnable?",
        a: "No. Most one-suit deals can be won, but many four-suit deals can't be. Every Funzzle daily deal is played through by a solver before it goes live, so today's deal always has a winning line. Random practice deals with one or two suits are checked the same way; four-suit practice deals are random and marked not verified.",
      },
      {
        q: "When can you deal new cards in Spider Solitaire?",
        a: "You can deal from the stock whenever you like, as long as no column is empty: every column gets one new face-up card. Fill any empty column with a card or run first. There are five deals in a game.",
      },
      {
        q: "What's the best Spider Solitaire strategy?",
        a: "Turn over face-down cards first, especially in the shortest columns. Build on the same suit whenever you can, because only same-suit runs move together and get cleared. Empty a column and keep it free until it lets you rearrange a run or free a hidden card, and before you deal, tidy up as many runs as possible. The coach follows these priorities when it has no winning line to follow.",
      },
    ],
  },
  "spelling-hive": {
    name: "Spelling Hive",
    genre: "Word game",
    summary:
      "Spelling Hive is a free daily word game: make as many words as you can from seven letters in a honeycomb, always using the center letter. Ranks climb from Beginner to Genius and Hive Master, a hints grid shows how many words are left, and your score is ranked against today's players.",
    description: "Free daily seven-letter word puzzle with ranks, a hints grid, a coach and unlimited practice hives.",
    qa: [
      {
        q: "How do you play Spelling Hive?",
        a: "Make words of four or more letters using only the seven letters in the hive. Every word must include the center letter, and letters can be used more than once. Four-letter words score 1 point, longer words score 1 point per letter.",
      },
      {
        q: "What is a pangram?",
        a: "A pangram is a word that uses all seven letters at least once. Every hive has at least one, and it scores 7 bonus points on top of its length.",
      },
      {
        q: "What are the ranks in Spelling Hive?",
        a: "Ranks are a share of the hive's maximum score: Beginner, Good Start, Moving Up, Good, Solid, Nice, Great (40%), Amazing (50%), Genius (70%) and Hive Master, which takes every word in the list.",
      },
      {
        q: "Why doesn't a real word count?",
        a: "The scoring list sticks to everyday words. Rarer dictionary words are still accepted and shown as bonus words, but they score no points, so every rank can be reached with common vocabulary.",
      },
      {
        q: "How do hints work in Spelling Hive?",
        a: "The hints grid (words left by first letter and length) and the two-letter starts list are free. The coach gives up to three hints: first a two-letter start, then the word's pattern like T _ _ _ N, then the word itself. Coach hints are counted in your result.",
      },
    ],
  },
  "letter-box": {
    name: "Letter Box",
    genre: "Word game",
    summary:
      "Letter Box is a free daily word puzzle: twelve letters sit three to a side of a square, and you chain words that use every letter, each word starting with the last letter of the one before. Today's box always has a two-word solution, and your word count and time are ranked against today's players.",
    description: "Free daily word-chain puzzle around a square of twelve letters, with a coach and unlimited practice boxes.",
    qa: [
      {
        q: "How do you play Letter Box?",
        a: "Spell words of three or more letters by tapping letters around the square. Consecutive letters must come from different sides, and each new word starts with the last letter of the previous word. You win when every one of the twelve letters has been used.",
      },
      {
        q: "Can letters be used more than once?",
        a: "Yes. Letters can be reused as often as you like; the goal is to use every letter at least once in as few words as possible.",
      },
      {
        q: "What does par mean in Letter Box?",
        a: "Par is the fewest words the puzzle can be solved in. Every daily box is generated around a two-word solution, so par is two words, and there are three-word solutions as well.",
      },
      {
        q: "How do you find a two-word solution?",
        a: "Look for a long word that uses many letters and ends on a letter that starts words easily, then a second word that picks up every letter still unused. Rare letters such as J, Q, X or Z are best placed in the middle of a long word.",
      },
      {
        q: "Is there a hint in Letter Box?",
        a: "Yes. The coach gives up to three hints, each in steps: a good letter to start from, then the next word's length and how many new letters it uses, then the word from a shortest solution. Hints are counted in your result.",
      },
    ],
  },
  groups: {
    name: "Groups",
    genre: "Word game",
    summary:
      "Groups is a free daily word puzzle: sort 16 words into four groups of four that share a hidden link, from a straightforward level 1 group to a tricky level 4. You can make four mistakes, the game tells you when you're one word away, and your result is ranked against today's players by mistakes, then time.",
    description: "Free daily word-grouping puzzle: find four groups of four, with a coach and unlimited practice.",
    qa: [
      {
        q: "How do you play Groups?",
        a: "Select four words you think share a link and press Submit. If all four belong together, the group is revealed with its title. Find all four groups before you make four mistakes. Shuffle rearranges the board and Deselect clears your picks.",
      },
      {
        q: "What does \"one away\" mean?",
        a: "Three of the four words you submitted belong to the same group; one of them is wrong. It still counts as a mistake, so swap one word before you try again.",
      },
      {
        q: "What are the difficulty levels in Groups?",
        a: "Every board has one group at each level: level 1 is the most direct category, levels 2 and 3 need a second thought, and level 4 is usually wordplay, such as hidden words, sound-alikes or a missing word that completes a phrase.",
      },
      {
        q: "Is there a hint in Groups?",
        a: "Yes. The coach gives up to three hints per puzzle, each in steps: first it points to a word in the easiest group left, then it gives a clue to that group's theme, then it can reveal the group. Hints are counted in your result.",
      },
      {
        q: "Can I play more than one Groups puzzle a day?",
        a: "Yes. After the daily puzzle, Practice gives you more boards from Funzzle's own puzzle collection.",
      },
    ],
  },
  chess: {
    name: "Chess",
    genre: "Board game",
    summary:
      "Funzzle Chess is free chess in the browser: play the computer at six levels from Beginner to Strong, or solve the Daily Chess Puzzle, one position for everyone today with a single winning tactic. The coach shows the engine's best move and explains why in plain English.",
    description: "Free chess against the computer at six levels, a daily chess puzzle with one winning tactic, and unlimited practice puzzles.",
    qa: [
      {
        q: "Can I play chess against the computer for free?",
        a: "Yes. Pick a level from 1 (Beginner, which looks one move ahead and makes mistakes) to 6 (Strong, which thinks for about 1.5 seconds and searches five moves deep or more), choose white or black, and play. Undo and hints are unlimited, and the engine runs in your browser, so there's no account or download.",
      },
      {
        q: "What is the Daily Chess Puzzle?",
        a: "One position a day, the same for everyone, where you have a winning tactic: a mate in one to three moves, or a combination that wins at least three points of material. Each puzzle is checked by the engine so that only one first move works; the opponent's replies are its best defence. Your time and wrong moves are compared with today's other solvers.",
      },
      {
        q: "How do you get better at chess tactics?",
        a: "Look at forcing moves first: checks, captures and threats. Most puzzles are one of a few patterns, such as forks, pins, skewers, discovered attacks and back-rank mates. Funzzle tags every puzzle with its theme and tracks which ones you've solved in your skill tree.",
      },
      {
        q: "What are the rules for a draw in chess?",
        a: "A game is drawn by stalemate (the side to move has no legal move but isn't in check), threefold repetition of the same position, 50 moves by each side without a capture or pawn move, or when neither side has enough material left to checkmate, such as king against king and knight.",
      },
      {
        q: "How do castling and en passant work?",
        a: "Castling moves the king two squares toward a rook and puts the rook on the other side of it; it's only allowed if neither piece has moved, the squares between are empty, and the king isn't in check or passing through an attacked square. En passant lets a pawn capture an enemy pawn that has just moved two squares past it, as if it had moved one, but only on the very next move.",
      },
    ],
  },
  "mini-crossword": {
    name: "Mini Crossword",
    genre: "Puzzle",
    summary:
      "Mini Crossword is a free 5×5 crossword that's the same grid for everyone today and takes about a minute or two. Every answer is an everyday word, the coach can point you to the easiest clue or fill a letter, and your time is ranked against today's players.",
    description: "Free daily 5×5 mini crossword with a hint coach, check and reveal, and unlimited practice grids.",
    qa: [
      {
        q: "How do you play a mini crossword?",
        a: "Tap a square to pick it, tap it again to switch between Across and Down, and type the answer to the clue shown above the keyboard. The cursor jumps ahead as you type; fill every square with the right letter to finish.",
      },
      {
        q: "How long does a mini crossword take?",
        a: "Most players finish a 5×5 mini in one to three minutes; fast solvers get under 30 seconds. Saturday's grid can be a bigger 7×7, which takes a little longer.",
      },
      {
        q: "When does a new Mini Crossword come out?",
        a: "Every day at midnight UTC, together with the rest of the Daily Set. Missed one? Past days are in the archive, and practice gives you more grids any time.",
      },
      {
        q: "Can I get a hint on the Mini Crossword?",
        a: "Yes. Check marks wrong letters, Reveal fills in the current word, and the coach gives up to three hints per puzzle: first the easiest clue to try, then one of its letters, then the word. Help counts in your result, so a clean solve ranks higher.",
      },
      {
        q: "How do I solve crosswords faster?",
        a: "Start with fill-in-the-blank clues and the shortest answers, then use the letters they give you on the crossing words. Watch the clue's tense and number: a plural clue usually means a plural answer.",
      },
    ],
  },
  word: {
    name: "Funzzle Word",
    genre: "Word game",
    summary:
      "Funzzle Word is a free daily five-letter word game: everyone gets the same hidden word today and six guesses to find it. Each tile turns green (right letter, right spot), yellow (in the word, wrong spot) or gray (not in the word); the coach explains what your guesses rule out and which guess narrows things down most.",
    description: "Free daily five-letter word game with hard mode, a deduction coach, Quad, Geo and Math modes, and unlimited practice.",
    qa: [
      {
        q: "How do you play Funzzle Word?",
        a: "Type any real five-letter word and press Enter. Green means the letter is in that exact spot, yellow means it's in the word but somewhere else, and gray means it isn't in the word. Use the clues to find the word in six guesses or fewer.",
      },
      {
        q: "What is the best first guess?",
        a: "Five different common letters, ideally two vowels and three of S, T, L, R and N. Funzzle's solver rates SLATE as the strongest opener for its answer list: whatever colors come back, at most 179 of about 2,000 possible answers are left.",
      },
      {
        q: "What does hard mode change?",
        a: "In hard mode every green letter has to stay in its spot and every yellow letter has to be used again in your next guesses. Turn it on before your first guess; a hard-mode result is marked with an asterisk when you share it.",
      },
      {
        q: "Can a letter appear twice?",
        a: "Yes. If you guess a letter twice and the word has it once, only one of your copies lights up (green first, then yellow) and the other turns gray, which tells you there is exactly one.",
      },
      {
        q: "Is there a new word every day, and can I play more?",
        a: "A new word goes live at midnight UTC, the same for everyone, and no answer repeats within a year. After the daily word you can play unlimited practice words, past days from the archive, or the Quad, Geo and Math modes.",
      },
    ],
  },
  "word-quad": {
    name: "Word Quad",
    genre: "Word game",
    summary:
      "Word Quad is Funzzle Word on four boards at once: every guess is played on all four hidden five-letter words, and you have nine guesses to solve them all. Today's four words are the same for everyone.",
    description: "Free daily four-board word game: four five-letter words, nine guesses, with a coach.",
    qa: [
      {
        q: "How does Word Quad work?",
        a: "Each guess is scored on all four boards at once. A board stops taking guesses once you solve it; solve all four within nine guesses to win. The keyboard shows each letter's color on every board.",
      },
      {
        q: "What's the best Quad strategy?",
        a: "Spend the first two or three guesses on wide openers with different letters, then finish the board with the fewest possible words left. The coach picks the guess that splits all open boards best.",
      },
    ],
  },
  "word-geo": {
    name: "Word Geo",
    genre: "Geography game",
    summary:
      "Word Geo is a free daily geography puzzle: name the country from its silhouette in six guesses. Each wrong guess shows how far away it is, an arrow pointing toward the answer and a proximity score.",
    description: "Free daily country-guessing game from a silhouette, with distance, direction and a geography coach.",
    qa: [
      {
        q: "How do the arrows and percentages work?",
        a: "The distance is measured between the two countries' center points over the globe, and the arrow points along the shortest route from your guess to the answer. The percentage is how close you are: 100% is the answer and 0% is the far side of the Earth.",
      },
      {
        q: "Which countries can come up?",
        a: "Any of the 195 countries can be guessed. The answer is always a country with a recognizable outline, so tiny states and atolls never come up; today's country is the same for everyone.",
      },
    ],
  },
  "word-math": {
    name: "Word Math",
    genre: "Math puzzle",
    summary:
      "Word Math is a free daily equation puzzle: find the hidden 8-character equation, like 12+46=58, in six guesses. Every guess has to be a true equation, and the tiles turn green, yellow or gray like letters do.",
    description: "Free daily equation-guessing game: eight characters, six guesses, with a coach.",
    qa: [
      {
        q: "What are the rules for a Word Math guess?",
        a: "Use digits and + − × ÷ with exactly one = sign, eight characters in all, and the calculation has to be correct. Normal order of operations applies (× and ÷ before + and −), divisions must come out exact, and numbers can't have a leading zero (05).",
      },
      {
        q: "What does the answer look like?",
        a: "The answer is one or two operations on the left, such as 7*6-7=35 or 46-27=19, and a single positive number on the right. It never multiplies or divides by 1 or uses zero as a number on the left.",
      },
    ],
  },
  "word-hunt": {
    name: "Word Hunt",
    genre: "Word game",
    summary:
      "Word Hunt is a free daily themed word search on a 6×8 board of letters: find the theme words by dragging through touching letters, including one span word that stretches across the board from one side to the opposite side. Every letter belongs to exactly one theme word, and every three other words you find earn a hint.",
    description: "Free daily themed word hunt: trace words through a 6×8 letter grid, find the span word, earn hints with bonus words.",
    qa: [
      {
        q: "How do you play Word Hunt?",
        a: "Read the theme, then drag across touching letters (up, down, sideways or diagonally) to spell a word, or tap the letters one by one and tap the last one again to submit. Theme words light up when you find them. The puzzle is solved when every one of the 48 letters is part of a found theme word.",
      },
      {
        q: "What is the span word?",
        a: "The span word sums up the theme and touches two opposite sides of the board, left and right or top and bottom. Because no words cross, finding it splits the board into smaller areas, which makes the remaining theme words easier to spot.",
      },
      {
        q: "How do you get hints in Word Hunt?",
        a: "Every three non-theme words you find (four letters or more, real English words) fill the hint meter and earn a hint. The coach also gives three hints per puzzle: first it highlights the letters of one theme word, then it circles the first letter, then it shows the word.",
      },
      {
        q: "Can a letter be used in two words?",
        a: "Not in theme words: each letter belongs to exactly one theme word, so the theme words fill the board without overlapping. Bonus words can use any letters that aren't already part of a found theme word.",
      },
      {
        q: "When is there a new Word Hunt?",
        a: "Every day at midnight UTC, with a new theme that's the same for everyone. You can replay past days from the archive and play practice themes any time.",
      },
    ],
  },
  "2048": {
    name: "Daily 2048",
    genre: "Puzzle",
    summary:
      "Daily 2048 is the free 4×4 sliding-tile game where equal numbers merge, with the same sequence of new tiles for everyone today, so your score is compared fairly with today's players. The coach looks a few moves ahead and suggests the best slide, with a plain-English reason.",
    description: "Free daily 2048 with the same tiles for everyone, a look-ahead coach and unlimited practice games.",
    qa: [
      {
        q: "How do you play 2048?",
        a: "Swipe (or press an arrow key) to slide every tile on the 4×4 board in one direction. Two tiles with the same number that touch merge into one with their sum, and a new 2 or 4 appears in an empty square after each move. The game ends when the board is full and no slide merges anything.",
      },
      {
        q: "What is the best strategy for 2048?",
        a: "Pick a corner and keep your biggest tile in it, keep the row along that corner full and ordered from big to small, and mostly slide in just two or three directions. Merge small tiles early so the board keeps empty squares. The coach scores moves on exactly these things: empty squares, ordered rows, merges and the corner.",
      },
      {
        q: "How is the 2048 score calculated?",
        a: "Every merge adds the new tile's value to your score: merging two 8s into a 16 is worth 16 points. Making a 2048 tile usually takes a score of about 20,000.",
      },
      {
        q: "Is the daily 2048 the same for everyone?",
        a: "Yes. Where each new tile appears, and whether it's a 2 or a 4, comes from today's seed and your move number, so players who make the same moves see the same tiles. That makes today's scores comparable.",
      },
      {
        q: "Can you undo a move in 2048?",
        a: "You get one free undo per game. After that you can watch an optional short ad for another one, and if no ad is available there are no extra undos.",
      },
    ],
  },
  "block-puzzle": {
    name: "Daily Block Puzzle",
    genre: "Puzzle",
    summary:
      "Daily Block Puzzle is a free 8×8 block-fitting game: place three pieces at a time, fill a row or column to clear it, and chain clears for combo points. Everyone gets the same pieces in the same order today, and the coach finds the placement that clears the most lines while keeping the board open.",
    description: "Free daily block puzzle on an 8×8 board with the same pieces for everyone, a placement coach and practice games.",
    qa: [
      {
        q: "How do you play Block Puzzle?",
        a: "Drag each of the three pieces onto the 8×8 board. Pieces can't be rotated. A completely filled row or column clears and scores points; when all three pieces are placed you get three new ones. The game ends when none of your pieces fits anywhere.",
      },
      {
        q: "How does scoring work in Block Puzzle?",
        a: "Each placed piece scores one point per square. Clearing lines scores 10 points per line, more when you clear several lines with one piece, and a combo bonus grows each time consecutive pieces clear lines.",
      },
      {
        q: "What's the best strategy for block puzzles?",
        a: "Keep the middle open and fill along the edges, leave room for the 3×3 square and the long 1×5 bars, and avoid single empty holes that only a one-square piece can fill. Clearing several lines at once is worth more than clearing them one by one.",
      },
      {
        q: "Is the daily Block Puzzle the same for everyone?",
        a: "Yes. Today's sequence of pieces comes from the date, so every player gets the same pieces in the same order, and scores are ranked against today's players.",
      },
    ],
  },
  jigsaw: {
    name: "Daily Jigsaw",
    genre: "Puzzle",
    summary:
      "Daily Jigsaw is a free online jigsaw puzzle with a new original picture every day, cut into 24 classic tab-and-blank pieces for everyone, plus practice puzzles from 12 to 96 pieces. Drag pieces from the tray, they snap into place when close, and your time is ranked against today's players.",
    description: "Free daily jigsaw puzzle: a new picture every day, 12 to 96 pieces, edge filter, preview and a hint that shows where a piece goes.",
    qa: [
      {
        q: "How do you play an online jigsaw puzzle?",
        a: "Drag a piece from the tray onto the board. When it's close to its correct spot it snaps in and locks. Pieces aren't rotated, so every piece already faces the right way. The puzzle is done when every piece is in place.",
      },
      {
        q: "What's the best way to solve a jigsaw puzzle?",
        a: "Do the edges first: use the edge filter to show only border pieces and build the frame. Then fill in by color and by area, using the preview picture to see where skies, hills and shapes go.",
      },
      {
        q: "How many pieces is the daily jigsaw?",
        a: "The daily puzzle is 24 pieces, the same picture and cut for everyone. Practice puzzles come in 12, 24, 48 or 96 pieces.",
      },
      {
        q: "Is there a hint if I'm stuck?",
        a: "Yes. “Show a piece” highlights a piece from the tray that fits next to the pieces you've already placed, and the spot where it goes. Hints are counted in your result.",
      },
    ],
  },
  "word-search": {
    name: "Daily Word Search",
    genre: "Word game",
    summary:
      "Daily Word Search is a free themed 12×12 word search, the same grid for everyone today, with 10 to 16 words hidden across, down, diagonally and backward. Drag across the letters to circle a word; stuck, the coach shows where a word starts, then which way it runs.",
    description: "Free daily themed word search with words in all 8 directions, a step-by-step coach and unlimited practice grids.",
    qa: [
      {
        q: "How do you play Word Search?",
        a: "Find every word in the list hidden in the grid of letters. Words run in straight lines in any of 8 directions: left to right, right to left, up, down or on a diagonal either way. Drag from the first letter to the last to circle a word; found words are crossed off the list.",
      },
      {
        q: "What's the fastest way to solve a word search?",
        a: "Scan for an unusual letter in the word, such as a Q, Z, X, J or K, or a double letter, then check the eight directions around each match. Look for the long words first, and for words that run backward or diagonally once the easy ones are gone.",
      },
      {
        q: "Can words in a word search go backwards or overlap?",
        a: "Yes. Funzzle's grids hide words backward and on both diagonals, and two words can share a letter where they cross. Each word appears exactly once, and the filler letters never spell anything offensive.",
      },
      {
        q: "Is there a new word search every day?",
        a: "Yes. A new themed 12×12 grid goes live at midnight UTC, the same for every player, and your time is ranked against today's players. Practice grids at 10×10, 12×12 and 15×15 are unlimited.",
      },
      {
        q: "Does Daily Word Search have hints?",
        a: "Yes. The coach gives up to three hints per grid, each in steps: first it lights up the letter a word starts on, then it says which way the word runs, then it circles the word. Hints count in your result.",
      },
    ],
  },
  crossword: {
    name: "Daily Crossword",
    genre: "Word game",
    summary:
      "Daily Crossword is a free American-style crossword with a new grid every day: 11×11 early in the week, 13×13 on Thursday and Friday and 15×15 on weekends. Every square is checked by an across and a down answer, and you can check or reveal a square, word or the whole puzzle, or ask the coach for the easiest clue to try next.",
    description: "Free daily crossword, 11×11 to 15×15, with check and reveal, pencil mode and a coach that points you to the easiest clue.",
    qa: [
      {
        q: "How do you solve a crossword puzzle?",
        a: "Read the clues, fill the answers you're sure of first, then use the letters they give you in the crossing answers. Short answers and fill-in-the-blank clues are usually the easiest place to start; a question mark at the end of a clue means wordplay.",
      },
      {
        q: "How big is today's Daily Crossword?",
        a: "It follows the week: Monday to Wednesday are 11×11, Thursday and Friday are 13×13, and Saturday and Sunday are 15×15. Every answer is at least three letters long and the black squares are symmetric.",
      },
      {
        q: "Can I check my answers in the crossword?",
        a: "Yes. Check marks wrong letters in the current square, word or whole puzzle, and Reveal fills them in. Both count as hints in your result, so the cleanest solves use neither.",
      },
      {
        q: "What is pencil mode in a crossword?",
        a: "Pencil mode writes letters in gray so you can try a guess without committing to it. Switch it off to write in ink. Pencilled letters still count once the whole grid is right.",
      },
      {
        q: "How do I move around the crossword grid?",
        a: "Tap a square to select it and tap it again to switch between across and down. On a keyboard, type to fill, use the arrow keys to move, Space to switch direction, Tab for the next clue and Backspace to delete.",
      },
    ],
  },
} as const;

export type GameGuideSlug = keyof typeof GAME_GUIDES;

export const HOW_TO_QA: QA[] = [
  GAME_GUIDES.sudoku.qa[0],
  GAME_GUIDES.sudoku.qa[1],
  GAME_GUIDES.solitaire.qa[0],
  GAME_GUIDES.solitaire.qa[3],
  {
    q: "How do word-guessing games like Wordle work?",
    a: "You have six tries to guess a hidden five-letter word. After each guess every letter turns green (right letter, right spot), yellow (in the word, wrong spot) or gray (not in the word).",
  },
  {
    q: "How do you get better at daily puzzles?",
    a: "Play every day, and when you're stuck use a hint that teaches rather than one that just tells you the answer. Funzzle's coach names the technique behind each step so you can spot it yourself next time.",
  },
];

// ---------------------------------------------------------------------------
// NYT answer pages
// ---------------------------------------------------------------------------

export function wordleAnswerCopy(long: string, data: WordleAnswerData | undefined) {
  if (!data) {
    return {
      summary: `The Wordle answer for ${long} goes up just after midnight UTC, with three hints before the reveal.`,
      qa: WORDLE_GENERAL,
    };
  }
  const word = data.answer.toUpperCase();
  const v = vowelsIn(word);
  return {
    summary: `Today's Wordle answer (${long}) is a five-letter word with ${plural(v, "vowel")}. Work through the hints below, from gentle to strong, or reveal the answer when you're ready.`,
    qa: [
      { q: `What is the Wordle answer today, ${long}?`, a: `The Wordle answer for ${long} is ${word}.` },
      { q: "What letter does today's Wordle start with?", a: `Today's Wordle starts with the letter ${data.hint_first_letter.toUpperCase()}.` },
      { q: "How many vowels are in today's Wordle?", a: `Today's Wordle has ${plural(v, "vowel")}${new Set(word).size < 5 ? " and at least one repeated letter" : " and no repeated letters"}.` },
      ...WORDLE_GENERAL,
    ],
  };
}

const WORDLE_GENERAL: QA[] = [
  {
    q: "What time does the new Wordle come out?",
    a: "A new Wordle unlocks at midnight in your local time zone. Funzzle posts each day's hints and answer at midnight UTC.",
  },
  {
    q: "What's a good Wordle starting word?",
    a: "Use five different common letters with two or three vowels, such as CRANE, SLATE or RAISE. They rule out the most words on the first guess.",
  },
];

export function connectionsAnswerCopy(long: string, data: ConnectionsAnswerData | undefined) {
  const groups = data?.groups ?? [];
  if (groups.length < 4) {
    return {
      summary: `The Connections answers for ${long} go up just after midnight UTC: hints for each group first, then the four groups.`,
      qa: CONNECTIONS_GENERAL,
    };
  }
  const sorted = [...groups].sort((a, b) => a.level - b.level);
  return {
    summary: `Today's Connections (${long}) has four groups of four, from yellow (easiest) to purple (trickiest). Start with the hints below; each group's answer stays hidden until you tap it.`,
    qa: [
      {
        q: `What are today's Connections answers, ${long}?`,
        a: sorted.map((g) => `${g.title}: ${g.words.join(", ")}`).join(". ") + ".",
      },
      { q: "What is the purple group in today's Connections?", a: `The purple group is ${sorted[3].title}: ${sorted[3].words.join(", ")}.` },
      { q: "What is the yellow group in today's Connections?", a: `The yellow group is ${sorted[0].title}: ${sorted[0].words.join(", ")}.` },
      ...CONNECTIONS_GENERAL,
    ],
  };
}

const CONNECTIONS_GENERAL: QA[] = [
  {
    q: "How does Connections work?",
    a: "You get 16 words and sort them into four groups of four that share a hidden link. You can make four mistakes. Yellow is the easiest group, then green, blue and purple, which usually involves wordplay.",
  },
  {
    q: "What time does the new Connections come out?",
    a: "A new Connections puzzle unlocks at midnight in your local time zone. Funzzle posts the hints and answers at midnight UTC.",
  },
];

export function miniAnswerCopy(long: string, data: CrosswordAnswerData | undefined) {
  const across = data?.across ?? [];
  const down = data?.down ?? [];
  if (!across.length) {
    return {
      summary: `The Mini Crossword answers for ${long} go up as soon as the puzzle is released, with hints before every answer.`,
      qa: MINI_GENERAL,
    };
  }
  const first = across[0];
  return {
    summary: `Today's Mini Crossword (${long}) has ${plural(across.length, "across clue")} and ${plural(down.length, "down clue")}. Get a nudge from the hints below, or open the full answer list with an explanation for every clue.`,
    qa: [
      {
        q: `What are the Mini Crossword answers for ${long}?`,
        a: `Across: ${across.map((c) => `${c.number} ${c.answer.toUpperCase()}`).join(", ")}. Down: ${down.map((c) => `${c.number} ${c.answer.toUpperCase()}`).join(", ")}.`,
      },
      { q: `What is 1-Across in today's Mini, "${first.clue}"?`, a: `1-Across, "${first.clue}", is ${first.answer.toUpperCase()}.` },
      ...MINI_GENERAL,
    ],
  };
}

const MINI_GENERAL: QA[] = [
  {
    q: "What time does the NYT Mini come out?",
    a: "The Mini for the next day is released at 10 p.m. Eastern on weekdays and 6 p.m. Eastern on weekends. Funzzle posts hints and answers as soon as it's out.",
  },
  {
    q: "How long does the Mini Crossword take?",
    a: "Most people finish the 5×5 Mini in one to three minutes. Saturday's Mini is often a larger grid and takes a little longer.",
  },
];

export function clueAnswerCopy(clue: string, answer: string) {
  const n = answer.length;
  return {
    summary: `The answer to the crossword clue "${clue}" is ${n} letters long and starts with ${answer[0].toUpperCase()}. Reveal the full answer below, with an explanation.`,
    qa: [
      { q: `What is the answer to "${clue}"?`, a: `The answer to the crossword clue "${clue}" is ${answer.toUpperCase()} (${n} letters).` },
      { q: `How many letters is the answer to "${clue}"?`, a: `${n} letters, starting with ${answer[0].toUpperCase()}.` },
    ],
  };
}
