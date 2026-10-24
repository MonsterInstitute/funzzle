/**
 * Display settings: theme (system / light / dark) and color-blind mode. Read
 * before first paint by the inline script in app/layout.tsx, which sets
 * <html data-theme> and <html data-cb>.
 */
import { readString, writeString } from "./storage";

export type Theme = "system" | "light" | "dark";

export function getTheme(): Theme {
  const t = readString("fz:theme");
  return t === "light" || t === "dark" ? t : "system";
}

export function setTheme(theme: Theme): void {
  writeString("fz:theme", theme === "system" ? null : theme);
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function getColorBlind(): boolean {
  return readString("fz:cb") === "1";
}

export function setColorBlind(on: boolean): void {
  writeString("fz:cb", on ? "1" : null);
  if (on) document.documentElement.dataset.cb = "1";
  else delete document.documentElement.dataset.cb;
}
