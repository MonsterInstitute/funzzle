import { GAMES } from "@/lib/games/kit/catalog";
import { SITE_URL } from "@/lib/site";

/**
 * /llms.txt (llmstxt.org): a plain summary of the site for AI assistants and
 * answer engines. Built from the game catalog, so a game that ships appears
 * here automatically; static until the next deploy.
 */

export const dynamic = "force-static";

export function GET() {
  const live = GAMES.filter((g) => g.href);
  const soon = GAMES.filter((g) => !g.href);
  const body = `# Funzzle

> Funzzle (${SITE_URL}) is a free daily puzzle playground: Sudoku, Solitaire, word games and more in the browser, with no account and no paywall. Every day there's a Daily Set that everyone plays, a coach that explains the next logical move, and a rank against the day's players. Funzzle also publishes spoiler-safe hints and answers for the day's New York Times puzzles. It is independent and not affiliated with The New York Times.

Key facts:
- New daily puzzles every day at 00:00 UTC; the same puzzle for every player.
- Everything is free; ads never show during play.
- Daily Sudoku difficulty follows the week: Monday Easy, Tuesday/Wednesday/Sunday Medium, Thursday/Friday Hard, Saturday Expert.
- Daily Solitaire deals (Klondike, draw 1 or 3) are verified winnable by a solver.
- Answer pages show graded hints first and the answer only on request.

## Daily puzzles

- [Today's Daily Set](${SITE_URL}/#today): Daily Sudoku, Daily Solitaire, Daily Word and the Mini Crossword
- [Daily Sudoku](${SITE_URL}/play/sudoku): one 9×9 grid for everyone, with a step-by-step coach and unlimited practice
- [Daily Solitaire](${SITE_URL}/play/solitaire): Klondike draw 1 or draw 3, a winnable deal every day, with a best-move coach

## Games

${live.map((g) => `- [${g.name}](${SITE_URL}${g.href}): ${g.description}`).join("\n")}

Coming soon: ${soon.map((g) => g.name).join(", ")}.

## Hints and answers for today's NYT puzzles

- [Wordle answer today](${SITE_URL}/wordle-answer/today): three hints, then the answer
- Connections answers, one page per date at ${SITE_URL}/connections-answers/YYYY-MM-DD: hints per group, then all four groups
- NYT Mini Crossword answers, one page per date at ${SITE_URL}/nyt-crossword-answers/YYYY-MM-DD: hints, then every answer with an explanation
- [Crossword clue answers](${SITE_URL}/clue): answers and explanations for common crossword clues

## Guides

- [How to play](${SITE_URL}/how-to-play): rules and strategy for every game
- [Blog](${SITE_URL}/blog)
- [About](${SITE_URL}/about)

## Optional

- [Sitemap](${SITE_URL}/sitemap.xml)
- Contact: hello@funzzle.com
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
