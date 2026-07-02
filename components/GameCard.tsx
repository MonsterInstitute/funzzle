import Link from "next/link";

export default function GameCard({
  title,
  description,
  emoji,
  href,
  badgeText,
  disabled = false,
}: {
  title: string;
  description: string;
  emoji: string;
  href: string;
  badgeText?: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className={`relative flex h-full flex-col rounded-xl border border-[#e5e7eb] bg-white p-6 transition-shadow ${
        disabled ? "opacity-60" : "hover:shadow-lg"
      }`}
    >
      {badgeText && (
        <span
          className={`absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            disabled
              ? "bg-gray-100 text-gray-500"
              : "bg-green-50 text-[#16a34a]"
          }`}
        >
          {badgeText}
        </span>
      )}

      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="mt-3 text-lg font-bold text-[#111827]">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-gray-600">{description}</p>

      <div className="mt-4">
        {disabled ? (
          <span className="inline-flex items-center rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400">
            Coming Soon
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-[#15803d]">
            Play Free →
          </span>
        )}
      </div>
    </div>
  );

  if (disabled) {
    return <div className="h-full cursor-not-allowed">{inner}</div>;
  }

  return (
    <Link href={href} className="group block h-full">
      {inner}
    </Link>
  );
}
