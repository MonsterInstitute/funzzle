import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import VisitTracker from "@/components/VisitTracker";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site";

// design/DESIGN.md: Bricolage Grotesque for display, Geist for UI, Geist Mono
// for numbers, times and labels.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
// Mono is only used for small labels: not worth a preload competing with the main fonts.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap", preload: false });
// One variable file covers both display weights (700 and 800).
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap" });

// Runs before first paint so a saved theme / color-blind setting never flashes
// the wrong colors. Values are written by lib/games/kit/settings.ts.
const SETTINGS_SCRIPT = `try{var t=localStorage.getItem("fz:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(localStorage.getItem("fz:cb")==="1")document.documentElement.dataset.cb="1"}catch(e){}`;


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_SCRIPT }} />
        <meta
          name="google-adsense-account"
          content="ca-pub-1219788687006562"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-[#111827]">
        {children}
        <VisitTracker />
      </body>
    </html>
  );
}
