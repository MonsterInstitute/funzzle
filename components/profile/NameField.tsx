"use client";

import { useState } from "react";
import { getDisplayName, NAME_MAX, setDisplayName } from "@/lib/games/kit/identity";
import { snapshot, useLocal } from "@/lib/games/kit/useLocal";

const readName = snapshot(() => getDisplayName());

/** The display name used in challenges and leagues (this device only). */
export default function NameField() {
  const stored = useLocal(readName, "");
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const value = draft ?? stored;
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setDraft(setDisplayName(value));
        setSaved(true);
      }}
    >
      <label htmlFor="display-name" className="text-sm font-semibold">
        Your name in challenges and leagues
      </label>
      <input
        id="display-name"
        value={value}
        maxLength={NAME_MAX}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. Sam"
        className="min-h-11 min-w-0 flex-[1_1_180px] rounded-xl border border-line-strong bg-ground px-3 text-base text-ink"
      />
      <button type="submit" className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-ground">
        {saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
