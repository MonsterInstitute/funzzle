import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://funzzle.com"),
  title: {
    default: "Funzzle — Free NYT Games, No Paywall",
    template: "%s | Funzzle",
  },
  description:
    "Play free crossword puzzles, Wordle, and more. No subscription, no account. The free alternative to NYT Games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-[#111827]">
        {children}
      </body>
    </html>
  );
}
