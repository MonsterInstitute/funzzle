import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#e5e7eb] bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-gray-500 sm:flex-row sm:justify-between">
        <p>© 2026 Funzzle · Always free</p>
        <nav className="flex flex-wrap justify-center gap-4">
          <Link href="/play/wordle" className="hover:text-[#16a34a]">
            Play
          </Link>
          <Link href="/wordle-answer/today" className="hover:text-[#16a34a]">
            Answers
          </Link>
          <Link href="/about" className="hover:text-[#16a34a]">
            About
          </Link>
          <Link href="/privacy" className="hover:text-[#16a34a]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#16a34a]">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
