"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Game clock that only runs while the game is active and the tab is visible
 * (switching apps shouldn't cost time). `startMs` restores saved progress.
 */
export function useTimer(running: boolean, startMs: number) {
  const [elapsed, setElapsed] = useState(startMs);
  const base = useRef(startMs);
  const startedAt = useRef<number | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const active = running && visible;
  useEffect(() => {
    if (!active) return;
    startedAt.current = performance.now();
    const id = window.setInterval(() => {
      setElapsed(base.current + (performance.now() - (startedAt.current ?? performance.now())));
    }, 250);
    return () => {
      window.clearInterval(id);
      if (startedAt.current !== null) base.current += performance.now() - startedAt.current;
      startedAt.current = null;
      setElapsed(base.current);
    };
  }, [active]);

  /** Exact elapsed time right now (between ticks). */
  const now = () => base.current + (startedAt.current !== null ? performance.now() - startedAt.current : 0);
  const reset = (ms: number) => {
    base.current = ms;
    if (startedAt.current !== null) startedAt.current = performance.now();
    setElapsed(ms);
  };
  return { elapsed, now, reset };
}
