/** Funzzle wordmark: four rounded tiles (violet, gold, green, coral) + the name. */
export default function Logo({ size = 34, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 34 34" role="img" aria-label="Funzzle">
        <rect x="1" y="1" width="15" height="15" rx="4" fill="#5B3DF5" />
        <rect x="18" y="1" width="15" height="15" rx="7.5" fill="#FFC857" />
        <rect x="1" y="18" width="15" height="15" rx="7.5" fill="#7FD6A0" />
        <rect x="18" y="18" width="15" height="15" rx="4" fill="#FF8C8C" />
      </svg>
      {wordmark && (
        <span className="font-display text-[27px] font-extrabold leading-none tracking-[-0.03em] text-ink">funzzle</span>
      )}
    </span>
  );
}
