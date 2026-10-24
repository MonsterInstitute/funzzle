"use client";

import { useState } from "react";
import { Icon } from "@/components/kit/Icons";

const IDEAS = ["Birthday word search", "Team trivia crossword", "Grade 3 spelling list", "Wedding couple quiz"];

/**
 * Puzzle Studio teaser (design/Main.dc.html). The Studio itself ships in
 * Phase 3; until then the prompt works but "Create puzzle" says so.
 */
export default function StudioBand() {
  const [prompt, setPrompt] = useState("A word search for Mia’s 7th birthday — dinosaurs and strawberries");
  const [notice, setNotice] = useState(false);

  return (
    <section id="studio" className="mx-auto max-w-[1280px] scroll-mt-4 px-4 pb-[72px] sm:px-8">
      <div className="flex flex-wrap items-center gap-9 rounded-[34px] bg-[#111111] p-7 text-white sm:p-11">
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
          <p className="m-0 font-mono text-[13px] uppercase tracking-[0.08em] text-[#C9C2FF]">Coming soon · Puzzle Studio</p>
          <h2 className="m-0 font-display text-[40px] font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-[50px]">
            Turn anything
            <br />
            into a puzzle.
          </h2>
          <p className="m-0 max-w-[440px] text-[17px] leading-[1.55] text-[#D2D2DA]">
            Describe it in one sentence. Funzzle builds it, checks every answer with a solver, and gives you a link to share or a page to print.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3.5">
          <label htmlFor="studio-prompt" className="text-sm font-medium text-[#D2D2DA]">
            Describe your puzzle
          </label>
          <form
            className="flex flex-wrap gap-2.5 rounded-[22px] border border-[#383842] bg-[#1D1D24] p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(true);
            }}
          >
            <input
              id="studio-prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-12 min-w-0 flex-[1_1_260px] border-0 bg-transparent px-3 text-base text-white outline-none"
            />
            <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#5B3DF5] px-[22px] text-[15px] font-semibold text-white">
              <Icon name="sparkle" />
              Create puzzle
            </button>
          </form>
          {notice && (
            <p role="status" className="m-0 text-sm text-[#C9C2FF]">
              Puzzle Studio is almost ready. It opens here soon, solver-checked and free.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setPrompt(idea)}
                className="min-h-10 rounded-full border border-[#44444F] bg-transparent px-4 text-sm text-[#E6E6EC]"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
