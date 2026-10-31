"use client";

import { useEffect } from "react";
import { trackVisit } from "@/lib/games/kit/analytics";

/**
 * One "visit" event per browser per day, on every page (mounted in the root
 * layout). It used to live in Header, which /play/* game screens don't render,
 * so visitors who landed straight on a game had no visit or source recorded.
 */
export default function VisitTracker() {
  useEffect(() => {
    trackVisit();
  }, []);
  return null;
}
