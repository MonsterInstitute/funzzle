import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import VariantGuide from "@/components/seo/VariantGuide";
import SolitaireGame from "@/components/solitaire/SolitaireGame";
import { getDailySolitaire } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";
import { VARIANTS, variant, variantPath } from "@/lib/seo/variants";

export const dynamicParams = false;
export function generateStaticParams() {
  return VARIANTS.solitaire.map((v) => ({ variant: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ variant: string }> }): Promise<Metadata> {
  const v = variant("solitaire", (await params).variant);
  return pageMetadata({ title: v.title, description: v.description, path: variantPath(v) });
}

// Today's deals: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function SolitaireVariantPage({ params }: { params: Promise<{ variant: string }> }) {
  const v = variant("solitaire", (await params).variant);
  const today = todayISO();
  const [daily1, daily3] = await Promise.all([getDailySolitaire(today, 1), getDailySolitaire(today, 3)]);
  return (
    <>
      <div className="relative">
        <GameRails />
        <SolitaireGame date={today} daily1={daily1} daily3={daily3} initialMode={v.slug === "turn-3" ? "daily3" : "daily1"} />
      </div>
      <VariantGuide v={v} />
    </>
  );
}
