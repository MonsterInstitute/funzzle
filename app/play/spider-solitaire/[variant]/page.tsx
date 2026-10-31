import type { Metadata } from "next";
import GameRails from "@/components/ads/GameRails";
import VariantGuide from "@/components/seo/VariantGuide";
import SpiderGame from "@/components/spider/SpiderGame";
import { getDailySpider, getStoredDailySpider } from "@/lib/games/dailyPuzzles";
import { todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";
import { VARIANTS, variant, variantPath } from "@/lib/seo/variants";

const MODE = { "1-suit": "daily1", "2-suits": "daily2", "4-suits": "daily4" } as const;

export const dynamicParams = false;
export function generateStaticParams() {
  return VARIANTS["spider-solitaire"].map((v) => ({ variant: v.slug }));
}

export async function generateMetadata({ params }: PageProps<"/play/spider-solitaire/[variant]">): Promise<Metadata> {
  const v = variant("spider-solitaire", (await params).variant);
  return pageMetadata({ title: v.title, description: v.description, path: variantPath(v) });
}

// Today's deals: refreshed on demand at the UTC day change (lib/revalidation.ts);
// the 6h window is only a fallback.
export const revalidate = 21600;

export default async function SpiderVariantPage({ params }: PageProps<"/play/spider-solitaire/[variant]">) {
  const v = variant("spider-solitaire", (await params).variant);
  const today = todayISO();
  // Same deals as /play/spider-solitaire: 2 and 4 suits are only ever read
  // from storage (scripts/pregenerate-spider.ts), never generated here.
  const [daily1, daily2, daily4] = await Promise.all([
    getDailySpider(today),
    getStoredDailySpider(today, 2),
    getStoredDailySpider(today, 4),
  ]);
  return (
    <>
      <div className="relative">
        <GameRails />
        <SpiderGame date={today} daily1={daily1} daily2={daily2} daily4={daily4} initialMode={MODE[v.slug as keyof typeof MODE]} />
      </div>
      <VariantGuide v={v} />
    </>
  );
}
