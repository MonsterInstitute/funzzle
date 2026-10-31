import Link from "next/link";
import { PARENT_NAME, VARIANTS, variantPath, type VariantParent } from "@/lib/seo/variants";

/** "Play by …" links between a game page and its variant pages (one crawl path in both directions). */
export default function VariantLinks({ parent, current }: { parent: VariantParent; current?: string }) {
  const links = [
    { href: `/play/${parent}`, label: `Daily ${PARENT_NAME[parent]}`, here: current === undefined },
    ...VARIANTS[parent].map((v) => ({ href: variantPath(v), label: v.name, here: v.slug === current })),
  ];
  return (
    <nav aria-label={`${PARENT_NAME[parent]} variants`} className="mt-8">
      <h2 className="m-0 text-xl font-bold">More ways to play {PARENT_NAME[parent]}</h2>
      <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
        {links.map((l) => (
          <li key={l.href}>
            {l.here ? (
              <span aria-current="page" className="inline-flex min-h-11 items-center rounded-full border border-ink bg-ink px-4 text-sm font-semibold text-ground">
                {l.label}
              </span>
            ) : (
              <Link href={l.href} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm font-semibold text-ink no-underline">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
