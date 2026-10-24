/**
 * The name a player shows in challenges and leagues. No accounts: it lives on
 * this device next to the anonymous client id (storage.ts).
 */
import { readString, writeString } from "./storage";

const KEY = "fz:name";
export const NAME_MAX = 24;

export function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

export function getDisplayName(): string {
  return readString(KEY) ?? "";
}

export function setDisplayName(name: string): string {
  const clean = cleanName(name);
  writeString(KEY, clean || null);
  return clean;
}
