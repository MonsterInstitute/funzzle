/**
 * Daily grid generation. GENERATOR-SIDE ONLY (the fill imports the lexicon):
 * the cron fills a date's grid here, then asks DeepSeek for clues.
 */
import { createRng } from "../kit/rng";
import { fillGrid, type FillResult } from "./fill";
import { TEMPLATES } from "./templates";

/** 15×15 on weekends, 13×13 Thursday/Friday, 11×11 Monday–Wednesday. */
export function crosswordSizeFor(date: string): 11 | 13 | 15 {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) return TEMPLATES[15].length ? 15 : 13;
  return day === 4 || day === 5 ? 13 : 11;
}

export interface DailyGrid extends FillResult {
  size: number;
  template: number;
}

/**
 * The filled grid for a date, a pure function of the date. Tries the
 * seeded template first, then the others in a seeded order, so one stubborn
 * template can't leave a day without a grid. `avoid` keeps recent answers out.
 */
export function fillDailyGrid(date: string, avoid?: ReadonlySet<string>, size = crosswordSizeFor(date)): DailyGrid {
  const templates = TEMPLATES[size as 11 | 13 | 15];
  if (!templates?.length) throw new Error(`no ${size}×${size} templates`);
  const order = createRng(`crossword-template:${date}`).shuffle(templates.map((_, i) => i));
  for (const template of order) {
    const res = fillGrid(templates[template], { seed: `crossword:${date}:${template}`, avoid });
    if (res) return { ...res, size, template };
  }
  throw new Error(`no fill for ${date} (${size}×${size})`);
}
