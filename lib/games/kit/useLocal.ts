"use client";

import { useSyncExternalStore } from "react";
import { PROGRESS_EVENT } from "./daily";

/**
 * Read a value derived from local storage without a hydration mismatch: the
 * server render (and the first client render) uses `serverValue`, then the
 * real value; it re-reads when this tab records progress or another tab
 * changes storage. `read` must return a primitive or a cached object — a new
 * object every call would re-render forever — so derive a string/number, or
 * memoise by key.
 */
export function useLocal<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribe, read, () => serverValue);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(PROGRESS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Cache a JSON-derived snapshot so identical content keeps one identity. */
export function snapshot<T>(compute: () => T): () => T {
  let lastKey = "";
  let last: T;
  return () => {
    const value = compute();
    const key = JSON.stringify(value);
    if (key !== lastKey) {
      lastKey = key;
      last = value;
    }
    return last;
  };
}
