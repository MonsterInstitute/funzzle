/**
 * A subtle, clearly-labeled sponsored/affiliate link. Adds rel="sponsored
 * nofollow" per search-engine guidance and opens in a new tab.
 */
export default function AffiliateLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className={`inline-flex items-center gap-1 font-medium text-[#16a34a] underline decoration-dotted underline-offset-2 hover:text-[#15803d] ${className}`}
    >
      {children}
      <span className="text-[10px] uppercase tracking-wide text-gray-400">
        (Sponsored)
      </span>
    </a>
  );
}
