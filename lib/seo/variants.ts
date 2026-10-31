/**
 * Variant pages (docs/growth/seo-variant-pages.md, batch 1): one URL per way
 * people search for a game ("spider solitaire 2 suits", "solitaire turn 3",
 * "hard sudoku"), each opening today's daily in that variant. The copy and
 * facts are this page's own; the numbers come from Funzzle's solvers and
 * generator (scripts/_variant-stats.ts runs, 2026-10-31), so they describe
 * our deals and grids, not every game ever dealt.
 */
import type { QA } from "@/components/seo/QandA";
import type { Difficulty } from "@/lib/games/sudoku";

export type VariantParent = "spider-solitaire" | "solitaire" | "sudoku";

export interface Variant {
  parent: VariantParent;
  /** URL segment under /play/<parent>/. */
  slug: string;
  /** Short label for links between variants ("2 suits"). */
  label: string;
  /** Section heading and JSON-LD name. */
  name: string;
  genre: string;
  title: string;
  description: string;
  summary: string;
  facts: { label: string; value: string }[];
  qa: QA[];
}

export const PARENT_NAME: Record<VariantParent, string> = {
  "spider-solitaire": "Spider Solitaire",
  solitaire: "Solitaire",
  sudoku: "Sudoku",
};

const SPIDER: Variant[] = [
  {
    parent: "spider-solitaire",
    slug: "1-suit",
    label: "1 suit",
    name: "Spider Solitaire 1 Suit",
    genre: "Card game",
    title: "Spider Solitaire 1 Suit — Free Daily Deal, Verified Winnable",
    description:
      "Play free 1-suit Spider Solitaire: a new daily deal that our solver has played through to a win, unlimited undo and a coach that shows the best move. The easiest way to learn Spider.",
    summary:
      "One-suit Spider uses 104 spades in ten columns, so every descending run you build can move and be cleared. It is the gentlest Spider: most deals can be won with careful play, and Funzzle's daily deal is always one our solver has already won.",
    facts: [
      { label: "Cards", value: "104, all spades (8 sets of Ace to King)" },
      { label: "Random deals our solver won", value: "153 of 200 (77%); none proved unwinnable" },
      { label: "Typical winning line", value: "about 130 moves" },
      { label: "Today's deal", value: "Solver-verified winnable" },
    ],
    qa: [
      {
        q: "Is 1-suit Spider Solitaire always winnable?",
        a: "Not always, but nearly. Our solver won 153 of 200 random one-suit deals within a short search and proved none of the rest unwinnable; the others just needed a longer search. Funzzle's daily one-suit deal is always one the solver has already won, so a winning line exists.",
      },
      {
        q: "How do you win 1-suit Spider Solitaire?",
        a: "Turn over face-down cards as early as you can, starting with the shortest columns, and try to empty a column: an empty column lets you move any card or run to rearrange the others. Before you deal ten new cards from the stock, finish every move that tidies up a run, because the new row covers every column.",
      },
      {
        q: "Is 1-suit Spider good for beginners?",
        a: "Yes. With a single suit every run you build is same-suit, so it can always move and be cleared, and you learn the rhythm of the game (uncover, empty a column, deal) without the tangles of mixed suits. When you win it regularly, move up to two suits.",
      },
      {
        q: "How long does a game of 1-suit Spider take?",
        a: "Usually 5 to 15 minutes. The winning lines our solver finds are about 130 moves long; people tend to use more, and undo is unlimited.",
      },
    ],
  },
  {
    parent: "spider-solitaire",
    slug: "2-suits",
    label: "2 suits",
    name: "Spider Solitaire 2 Suits",
    genre: "Card game",
    title: "Spider Solitaire 2 Suits — Free Daily Deal, Verified Winnable",
    description:
      "Play free 2-suit Spider Solitaire (spades and hearts): a daily deal our solver has won, unlimited undo and a best-move coach. The step between easy one-suit and hard four-suit Spider.",
    summary:
      "Two-suit Spider mixes spades and hearts. You can still stack any card on one a rank higher, but only runs of one suit move together and get cleared, so every off-suit card you place is a knot to untie later. Funzzle's daily two-suit deal is one our solver has already won.",
    facts: [
      { label: "Cards", value: "104: 52 spades and 52 hearts" },
      { label: "Random deals our solver won", value: "62 of 120 (52%) within its search limit" },
      { label: "Typical winning line", value: "about 210 moves" },
      { label: "Today's deal", value: "Solver-verified winnable" },
    ],
    qa: [
      {
        q: "Is 2-suit Spider Solitaire hard?",
        a: "It's a real step up from one suit. Our solver won just over half of random two-suit deals within the same kind of search that wins three in four one-suit deals, and its winning lines are about 60% longer. Funzzle's daily deal is always a winnable one, so with patience (and undo) you can win it.",
      },
      {
        q: "What is the strategy for 2-suit Spider?",
        a: "Build on the same suit whenever you have the choice, because only same-suit runs move together. Use an off-suit placement only to uncover a face-down card or empty a column. Keep an empty column free until it lets you sort a mixed run back into suit.",
      },
      {
        q: "Which suits are used in 2-suit Spider?",
        a: "Usually spades and hearts, one black and one red, four of each set of Ace to King, 104 cards in all. Funzzle uses spades and hearts.",
      },
      {
        q: "Should I play 2 suits or 4 suits?",
        a: "Play two suits until you win it regularly. Four suits is much harder: our solver won fewer than half of random four-suit deals, and its winning lines were more than twice as long.",
      },
    ],
  },
  {
    parent: "spider-solitaire",
    slug: "4-suits",
    label: "4 suits",
    name: "Spider Solitaire 4 Suits",
    genre: "Card game",
    title: "Spider Solitaire 4 Suits — Free Daily Deal, Verified Winnable",
    description:
      "Play free 4-suit Spider Solitaire, the hardest Spider: a daily deal our solver has played through to a win, unlimited undo and a coach. Most random four-suit deals are far harder.",
    summary:
      "Four-suit Spider is the classic expert game: spades, hearts, diamonds and clubs, two of each set, in ten columns. Same-suit runs are rare and every column gets tangled: our solver won fewer than half of random deals even with a big search. Funzzle's daily four-suit deal is pre-checked: our solver found a win before it went live.",
    facts: [
      { label: "Cards", value: "104: two full decks" },
      { label: "Random deals our solver won", value: "17 of 40 (43%), with a 5× bigger search than two suits" },
      { label: "Typical winning line", value: "about 470 moves, more than twice two suits'" },
      { label: "Today's deal", value: "Solver-verified winnable (checked offline, before the day)" },
      { label: "Practice deals", value: "Random and not verified: some can't be won" },
    ],
    qa: [
      {
        q: "Is 4-suit Spider Solitaire winnable?",
        a: "Many are, but you can't tell which by looking. Our solver won 17 of 40 random four-suit deals and couldn't settle the other 23 even with a big search. That's why Funzzle's daily four-suit deal is solved ahead of time: today's deal has a known winning line.",
      },
      {
        q: "How do you beat 4-suit Spider Solitaire?",
        a: "Uncover face-down cards first and empty a column as soon as you can. Treat an empty column as your most valuable resource: use it to sort mixed runs back into suits, then free it again. Only deal from the stock after you've made every useful move, and use undo to test a line before you commit to it.",
      },
      {
        q: "What's the win rate for 4-suit Spider?",
        a: "Experienced players with unlimited undo win a good share of four-suit deals; without undo the rate drops sharply. On Funzzle the daily deal is always winnable, so your result depends on your play, not on the deal.",
      },
      {
        q: "How long does a 4-suit Spider game take?",
        a: "Often 20 minutes to an hour. Your progress is saved in the browser, so you can leave and come back to today's deal.",
      },
    ],
  },
];

const KLONDIKE: Variant[] = [
  {
    parent: "solitaire",
    slug: "turn-1",
    label: "Turn 1",
    name: "Solitaire Turn 1 (Draw 1)",
    genre: "Card game",
    title: "Solitaire Turn 1 — Free Klondike Draw 1, Daily Deal",
    description:
      "Play free Klondike Solitaire turn 1 (draw one card at a time): a daily deal our solver has won, a best-move coach, unlimited undo and practice deals.",
    summary:
      "Turn-1 Solitaire is Klondike where you turn one card at a time from the stock, so every card in the stock can be reached on every pass. It is the friendlier way to play: our solver won about four in five random turn-1 deals, and Funzzle's daily deal is always one it has won.",
    facts: [
      { label: "Stock", value: "One card turned at a time; unlimited passes" },
      { label: "Random deals our solver won", value: "330 of 400 (83%)" },
      { label: "Proved unwinnable", value: "12 of 400 (3%); the rest too long to settle" },
      { label: "Typical winning line", value: "about 210 moves (solver count, auto-moves included)" },
    ],
    qa: [
      {
        q: "What does turn 1 mean in Solitaire?",
        a: "You turn one card from the stock onto the waste at a time, and you can play it straight away. Every card in the stock comes up on every pass, which makes turn 1 (also called draw 1) the easier version of Klondike.",
      },
      {
        q: "What percentage of turn-1 Solitaire games are winnable?",
        a: "Most. Our solver won 330 of 400 random turn-1 deals and proved only 12 of them unwinnable, so roughly 80–90% can be won with perfect play. People win fewer, because perfect play means knowing what's under the face-down cards.",
      },
      {
        q: "Is turn 1 or turn 3 harder?",
        a: "Turn 3 is harder. With three cards turned at a time you can only play the top one, so some cards stay out of reach until the stock order shifts. Our solver proved three times as many turn-3 deals unwinnable.",
      },
      {
        q: "What's the best strategy for turn-1 Solitaire?",
        a: "Turn over face-down tableau cards whenever you can, starting with the longest columns, and only empty a column when you have a King to move into it. Don't rush every card to the foundations: a low card may still be needed to hold the next one down.",
      },
    ],
  },
  {
    parent: "solitaire",
    slug: "turn-3",
    label: "Turn 3",
    name: "Solitaire Turn 3 (Draw 3)",
    genre: "Card game",
    title: "Solitaire Turn 3 — Free Klondike Draw 3, Daily Deal",
    description:
      "Play free Klondike Solitaire turn 3 (draw three): a daily deal our solver has won, a coach that shows the best move, unlimited undo and practice deals.",
    summary:
      "Turn-3 Solitaire is classic Klondike with three cards turned from the stock at a time and only the top one playable. Cards hide in the stock until a play changes the order, so planning matters far more than in turn 1. Funzzle's daily turn-3 deal is always one our solver has won.",
    facts: [
      { label: "Stock", value: "Three cards turned at a time; only the top one plays" },
      { label: "Random deals our solver won", value: "288 of 400 (72%)" },
      { label: "Proved unwinnable", value: "39 of 400 (10%), three times turn 1's rate" },
      { label: "Typical winning line", value: "about 150 moves (solver count)" },
    ],
    qa: [
      {
        q: "What does turn 3 mean in Solitaire?",
        a: "Each time you click the stock, three cards are turned onto the waste and only the top one can be played. When you play it, the one under it becomes playable. It's the traditional way to play Klondike, also called draw 3.",
      },
      {
        q: "What percentage of turn-3 Solitaire games can be won?",
        a: "Fewer than turn 1. Our solver won 288 of 400 random turn-3 deals and proved 39 unwinnable, so somewhere around 70–85% are winnable with perfect play. Funzzle's daily turn-3 deal is always a winnable one.",
      },
      {
        q: "How do you get better at turn-3 Solitaire?",
        a: "Go through the stock once before committing to big moves, so you know which cards are in reach. Playing a card from the waste changes which cards come up on the next pass, so sometimes it's worth playing one just to shift the order. Uncover tableau cards first and keep an empty column for a King.",
      },
      {
        q: "Is turn 3 Solitaire the same as Klondike?",
        a: "Yes, it's Klondike with the draw-3 rule. Windows Solitaire and most card tables let you pick draw 1 or draw 3; on Funzzle each has its own daily deal.",
      },
    ],
  },
];

const SUDOKU_LEVELS: [Difficulty, string, Omit<Variant, "parent" | "slug" | "label" | "genre">][] = [
  [
    "easy",
    "Easy",
    {
      name: "Easy Sudoku",
      title: "Easy Sudoku — Free Daily Puzzle with a Coach",
      description:
        "Play today's free easy Sudoku: a new grid every day with 36–37 givens, solvable with singles alone, and a coach that explains each step. Unlimited easy practice puzzles.",
      summary:
        "Funzzle's easy Sudoku gives you 36 or 37 numbers and never needs more than the two basic techniques: a cell with only one possible digit (a naked single), or a digit with only one possible cell in a row, column or box (a hidden single). A new easy grid comes out every day, the same for everyone.",
      facts: [
        { label: "Givens", value: "36–37 of 81 cells" },
        { label: "Techniques needed", value: "Naked and hidden singles only" },
        { label: "Typical time", value: "5–10 minutes" },
        { label: "Guessing", value: "Never needed: every grid has one solution reached by logic" },
      ],
      qa: [
        {
          q: "How do you solve an easy Sudoku?",
          a: "Pick a digit and look at each 3×3 box: if the digit can only go in one cell of that box (because the same digit already sits in the cell's row or column), write it in. Then look for cells where only one digit fits. Repeating those two steps solves every Funzzle easy grid.",
        },
        {
          q: "How many numbers does an easy Sudoku start with?",
          a: "Funzzle's easy grids start with 36 or 37 of the 81 numbers filled in. More givens don't always mean easier, so each grid is graded by the techniques it needs, not just its count.",
        },
        {
          q: "Is there a new easy Sudoku every day?",
          a: "Yes. This page has a new easy grid every day at midnight UTC. The main Daily Sudoku moves from easy on Monday to expert on Saturday; on Mondays it is this grid.",
        },
        {
          q: "What comes after easy Sudoku?",
          a: "Medium, which adds pointing pairs: when a digit's only places in a box all lie in one row or column, it can be ruled out from the rest of that row or column.",
        },
      ],
    },
  ],
  [
    "medium",
    "Medium",
    {
      name: "Medium Sudoku",
      title: "Medium Sudoku — Free Daily Puzzle with a Coach",
      description:
        "Play today's free medium Sudoku: a new grid every day with 30–32 givens that needs pointing pairs, and a coach that shows the next logical step. Unlimited practice.",
      summary:
        "Funzzle's medium Sudoku starts with 30 to 32 numbers. Singles get you far, but almost every grid needs at least one pointing pair: a digit whose only places in a box line up in one row or column, which rules it out of the rest of that line. A new medium grid comes out every day.",
      facts: [
        { label: "Givens", value: "30–32 of 81 cells" },
        { label: "Techniques needed", value: "Singles plus pointing pairs (57 of 60 sampled grids)" },
        { label: "Typical time", value: "10–20 minutes" },
        { label: "Guessing", value: "Never needed" },
      ],
      qa: [
        {
          q: "What makes a medium Sudoku harder than easy?",
          a: "Fewer givens (30–32 instead of 36–37) and at least one step where no single is available: you have to rule a digit out first, usually with a pointing pair, before the next single appears.",
        },
        {
          q: "What is a pointing pair in Sudoku?",
          a: "If a digit's only possible cells in a 3×3 box are in the same row (or column), the digit must go in that row inside the box, so you can remove it from the rest of that row outside the box. The coach highlights these when you ask for a hint.",
        },
        {
          q: "Do I need to write notes for medium Sudoku?",
          a: "It helps. Pencil marks (notes) make pointing pairs easy to spot. Turn on notes mode and the board keeps them tidy as you place digits.",
        },
        {
          q: "When is the Daily Sudoku medium?",
          a: "On Sunday, Tuesday and Wednesday. This page has a medium grid every day.",
        },
      ],
    },
  ],
  [
    "hard",
    "Hard",
    {
      name: "Hard Sudoku",
      title: "Hard Sudoku — Free Daily Puzzle with a Coach",
      description:
        "Play today's free hard Sudoku: a new grid every day with 26–30 givens that needs pairs and triples, and a coach that explains the technique when you're stuck.",
      summary:
        "Funzzle's hard Sudoku starts with 26 to 30 numbers and needs subset techniques: naked pairs, hidden pairs, claiming and sometimes triples. These let you clear candidates from whole rows, columns and boxes when no single is in sight. A new hard grid comes out every day, solvable by logic alone.",
      facts: [
        { label: "Givens", value: "26–30 of 81 cells" },
        { label: "Hardest step (60 sampled grids)", value: "Naked pair 28 · claiming 17 · hidden pair 13 · naked triple 2" },
        { label: "Typical time", value: "20–40 minutes" },
        { label: "Guessing", value: "Never needed" },
      ],
      qa: [
        {
          q: "What techniques do you need for hard Sudoku?",
          a: "Naked pairs (two cells in a unit that can only hold the same two digits), hidden pairs (two digits that can only go in the same two cells), claiming (a row's only places for a digit lie in one box) and occasionally triples. Funzzle's hard grids never need X-Wings or guessing.",
        },
        {
          q: "What is a naked pair?",
          a: "Two cells in the same row, column or box whose only candidates are the same two digits. Those two digits must go in those two cells, so you can remove them from every other cell of that unit.",
        },
        {
          q: "How do I get unstuck on a hard Sudoku?",
          a: "Fill in all candidates, then look in each unit for two cells with the same pair of candidates. If there's none, look for a digit that appears only twice in a unit. The coach's first hint names the technique and the area; the next one shows the cells.",
        },
        {
          q: "When is the Daily Sudoku hard?",
          a: "On Thursday and Friday. This page has a hard grid every day.",
        },
      ],
    },
  ],
  [
    "expert",
    "Expert",
    {
      name: "Expert Sudoku",
      title: "Expert Sudoku — Free Daily Puzzle, Logic Only",
      description:
        "Play today's free expert Sudoku: a new grid every day with 24–28 givens that needs X-Wings and XY-Wings, never guessing, and a coach that explains each step.",
      summary:
        "Funzzle's expert Sudoku starts with 24 to 28 numbers and needs the advanced patterns: almost every grid has at least one XY-Wing, some an X-Wing or Swordfish. Each grid still has exactly one solution reachable by logic, and the coach can walk you through any step. A new expert grid comes out every day.",
      facts: [
        { label: "Givens", value: "24–28 of 81 cells" },
        { label: "Hardest step (60 sampled grids)", value: "XY-Wing 56 · X-Wing 3 · Swordfish 1" },
        { label: "Typical time", value: "30–60 minutes" },
        { label: "Guessing", value: "Never needed" },
      ],
      qa: [
        {
          q: "What is an XY-Wing in Sudoku?",
          a: "Three cells with two candidates each: a pivot XY that sees one cell XZ and another YZ. Whichever digit the pivot takes, one of the two wings becomes Z, so any cell that sees both wings can't be Z. Funzzle's expert grids almost always need one.",
        },
        {
          q: "What is an X-Wing?",
          a: "If a digit can only go in the same two columns in two different rows, it must take one of those columns in each row, so you can remove it from every other cell of those two columns. Swordfish is the same idea with three rows and three columns.",
        },
        {
          q: "Do expert Sudokus need guessing?",
          a: "Not on Funzzle. Every grid has a single solution and our solver reaches it with the techniques listed here, without trial and error.",
        },
        {
          q: "When is the Daily Sudoku expert?",
          a: "On Saturday. This page has an expert grid every day.",
        },
      ],
    },
  ],
];

const SUDOKU: Variant[] = SUDOKU_LEVELS.map(([slug, label, v]) => ({ ...v, parent: "sudoku", slug, label, genre: "Puzzle" }));

export const VARIANTS: Record<VariantParent, Variant[]> = {
  "spider-solitaire": SPIDER,
  solitaire: KLONDIKE,
  sudoku: SUDOKU,
};

export const ALL_VARIANTS: Variant[] = Object.values(VARIANTS).flat();

export function variant(parent: VariantParent, slug: string): Variant {
  const v = VARIANTS[parent].find((x) => x.slug === slug);
  if (!v) throw new Error(`no variant ${parent}/${slug}`);
  return v;
}

export const variantPath = (v: Pick<Variant, "parent" | "slug">) => `/play/${v.parent}/${v.slug}`;
