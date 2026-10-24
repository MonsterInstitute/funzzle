"use client";

import { badges, MASTERY, SKILL_TREES, skillProgress } from "@/lib/games/kit/achievements";
import { snapshot, useLocal } from "@/lib/games/kit/useLocal";
import { Icon } from "@/components/kit/Icons";

const readBadges = snapshot(() => badges());

export function BadgeGrid() {
  const list = useLocal(readBadges, []);
  const earned = list.filter((b) => b.earned).length;
  return (
    <section aria-labelledby="badges-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="badges-title" className="m-0 font-display text-[28px] font-extrabold tracking-[-0.02em]">
          Badges
        </h2>
        <span className="font-mono text-sm text-muted-2">
          {earned} of {list.length}
        </span>
      </div>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5 p-0">
        {list.map((b) => (
          <li key={b.id} className={`flex flex-col gap-1 rounded-2xl p-3.5 ${b.earned ? "bg-violet-tint" : "border border-dashed border-line-strong"}`}>
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${b.earned ? "text-violet-deep" : "text-muted"}`}>
              <Icon name={b.earned ? "trophy" : "sparkle"} size={16} />
              {b.name}
            </span>
            <span className="text-xs text-muted">{b.how}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A game's technique tree: tiers left to right, mastered after MASTERY solves. */
export function SkillTree({ game }: { game: string }) {
  const read = snapshot(() => skillProgress(game));
  const items = useLocal(read, []);
  const tree = SKILL_TREES[game];
  if (!tree) return null;
  const tiers = [...new Set(tree.skills.map((s) => s.tier))].sort((a, b) => a - b);
  const mastered = items.filter((i) => i.mastered).length;
  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-line p-[22px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold">{tree.title}</span>
        <span className="font-mono text-xs text-muted-2">
          {mastered}/{tree.skills.length} mastered
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {tiers.map((t) => (
          <li key={t} className="flex flex-wrap gap-2">
            {items
              .filter((i) => i.skill.tier === t)
              .map(({ skill, count, mastered: done }) => (
                <span
                  key={skill.id}
                  title={skill.what}
                  className={`flex min-w-[140px] flex-1 flex-col rounded-xl px-3 py-2 text-sm ${done ? "bg-ink text-ground" : count ? "bg-soft-2" : "border border-dashed border-line-strong text-muted"}`}
                >
                  <span className="font-semibold">{skill.name}</span>
                  <span className={`text-xs ${done ? "opacity-80" : "text-muted-2"}`}>{done ? "Mastered" : `${Math.min(count, MASTERY)} of ${MASTERY} · ${skill.what}`}</span>
                </span>
              ))}
          </li>
        ))}
      </ol>
    </div>
  );
}
