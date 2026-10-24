import JsonLd from "@/components/JsonLd";
import { faqJsonLd } from "@/lib/seo";

export interface QA {
  q: string;
  a: string;
}

/**
 * "Questions people ask": real questions with short, direct answers, plus the
 * matching FAQPage JSON-LD. Each answer sits in a <details> so answers that
 * spoil a puzzle stay closed until tapped (the text is still in the page, as
 * FAQ markup requires).
 */
export default function QandA({ items, title = "Questions people ask", className = "" }: { items: QA[]; title?: string; className?: string }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="qa-title" className={`mt-10 ${className}`}>
      <JsonLd data={faqJsonLd(items)} />
      <h2 id="qa-title" className="text-xl font-bold">
        {title}
      </h2>
      <div className="mt-3 divide-y divide-[var(--line,#e5e7eb)] rounded-2xl border border-[var(--line,#e5e7eb)]">
        {items.map(({ q, a }) => (
          <details key={q} className="group px-4">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold">
              {q}
              <span aria-hidden="true" className="text-lg transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="m-0 pb-4 leading-relaxed opacity-90">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** The 1–2 sentence direct answer a page opens with (answer-first). */
export function Summary({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-3 text-[17px] leading-relaxed opacity-90 ${className}`}>{children}</p>;
}
