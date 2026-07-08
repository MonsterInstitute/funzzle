import Link from "next/link";
import { gameColor, type GameKey } from "@/lib/gameColors";

export default function GameCard({
  title,
  description,
  emoji,
  href,
  gameKey,
  badgeText,
  disabled = false,
}: {
  title: string;
  description: string;
  emoji: string;
  href: string;
  gameKey: GameKey;
  badgeText?: string;
  disabled?: boolean;
}) {
  const c = gameColor(gameKey);

  const inner = (
    <div
      className={`relative flex h-full flex-col rounded-xl border bg-white p-6 transition-shadow ${
        disabled ? "border-[#e5e7eb] opacity-60" : "hover:shadow-lg"
      }`}
      style={disabled ? undefined : { borderColor: c.tint, borderTopWidth: 3, borderTopColor: c.primary }}
    >
      {badgeText && (
        <span
          className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={
            disabled
              ? { backgroundColor: "#f3f4f6", color: "#6b7280" }
              : { backgroundColor: c.tint, color: c.text }
          }
        >
          {badgeText}
        </span>
      )}

      {/* Colored icon tile */}
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
        style={{ backgroundColor: disabled ? "#f3f4f6" : c.tint }}
        aria-hidden
      >
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
          <span
            className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition-opacity group-hover:opacity-90"
            style={{ backgroundColor: c.primary, color: c.onPrimary }}
          >
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
