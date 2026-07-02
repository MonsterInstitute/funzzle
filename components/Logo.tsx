/** Funzzle wordmark: a green crossword tile with an "F" plus the name. */
export default function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7"
        role="img"
        aria-label="Funzzle logo"
      >
        <rect width="32" height="32" rx="7" fill="#16a34a" />
        <g stroke="#ffffff" strokeWidth="1" opacity="0.35">
          <line x1="10.67" y1="4" x2="10.67" y2="28" />
          <line x1="21.33" y1="4" x2="21.33" y2="28" />
          <line x1="4" y1="10.67" x2="28" y2="10.67" />
          <line x1="4" y1="21.33" x2="28" y2="21.33" />
        </g>
        <text
          x="16"
          y="17"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="20"
          fontWeight="700"
          fill="#ffffff"
        >
          F
        </text>
      </svg>
      <span className="text-xl font-bold tracking-tight text-black">funzzle</span>
    </span>
  );
}
