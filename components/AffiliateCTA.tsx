import AffiliateLink from "./AffiliateLink";
import { AFFILIATE, NYT_GAMES_PRICE } from "@/lib/site";

/**
 * Bottom-of-article affiliate box pointing to the original NYT Games.
 */
export default function AffiliateCTA() {
  return (
    <div className="mt-10 rounded-xl border border-[#e5e7eb] bg-gray-50 p-5 text-center">
      <p className="text-sm text-gray-600">
        Want the original? NYT Games starts at {NYT_GAMES_PRICE}/month.
      </p>
      <p className="mt-2">
        <AffiliateLink href={AFFILIATE.nytGames}>
          Try NYT Games →
        </AffiliateLink>
      </p>
      <p className="mt-3 text-xs text-gray-400">
        Prefer free? Everything on Funzzle stays free, forever.
      </p>
    </div>
  );
}
