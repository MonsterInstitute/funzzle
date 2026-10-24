import JsonLd from "@/components/JsonLd";
import QandA from "@/components/seo/QandA";
import { GAME_GUIDES, type GameGuideSlug } from "@/lib/aeo";
import { gameJsonLd } from "@/lib/seo";

/**
 * The text half of a game page, below the board: the direct summary, the
 * questions people ask, and VideoGame/WebApplication + FAQPage markup. The
 * board stays the first thing on screen (mobile-first), so the summary is the
 * first text block after it.
 */
export default function GameGuide({ slug, path }: { slug: GameGuideSlug; path: string }) {
  const g = GAME_GUIDES[slug];
  return (
    <section data-kit aria-labelledby="guide-title" className="bg-ground text-ink">
      <JsonLd data={gameJsonLd({ name: g.name, description: g.description, path, genre: g.genre })} />
      <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-10">
        <h2 id="guide-title" className="m-0 font-display text-[28px] font-extrabold tracking-[-0.02em]">
          About {g.name}
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{g.summary}</p>
        <QandA items={[...g.qa]} />
      </div>
    </section>
  );
}
