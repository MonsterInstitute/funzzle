import Footer from "@/components/Footer";

// Game pages have no site header (the board comes first), but they do get the
// footer: its games list links every game page from every other one.
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
