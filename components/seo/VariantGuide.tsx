import JsonLd from "@/components/JsonLd";
import QandA from "@/components/seo/QandA";
import VariantLinks from "@/components/seo/VariantLinks";
import { PARENT_NAME, variantPath, type Variant } from "@/lib/seo/variants";
import { breadcrumbJsonLd, gameJsonLd } from "@/lib/seo";

/** GameGuide for a variant page: summary, the variant's facts, its questions and links to the other variants. */
export default function VariantGuide({ v }: { v: Variant }) {
  const path = variantPath(v);
  return (
    <section data-kit aria-labelledby="guide-title" className="bg-ground text-ink">
      <JsonLd data={gameJsonLd({ name: v.name, description: v.description, path, genre: v.genre })} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Funzzle", path: "/" },
          { name: PARENT_NAME[v.parent], path: `/play/${v.parent}` },
          { name: v.name, path },
        ])}
      />
      <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-10">
        <h2 id="guide-title" className="m-0 font-display text-[28px] font-extrabold tracking-[-0.02em]">
          {v.name}
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{v.summary}</p>
        <dl className="m-0 mt-6 grid gap-x-6 gap-y-3 rounded-2xl border border-line p-4 sm:grid-cols-[max-content_1fr]">
          {v.facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="font-semibold">{f.label}</dt>
              <dd className="m-0 text-muted">{f.value}</dd>
            </div>
          ))}
        </dl>
        <QandA items={v.qa} />
        <VariantLinks parent={v.parent} current={v.slug} />
      </div>
    </section>
  );
}
