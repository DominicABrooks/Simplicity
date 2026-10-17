// WoW-flavoured progression: kills give XP, each level needs a bit more, levels grant raw stats.

export const XP = { slime: 10, mage: 50, ghost: 150, maxLevel: 20 } as const;

export const xpToNext = (level: number): number => 50 + (level - 1) * 40;

export interface LevelBonus {
  level: number;
  speed: number;   // percent
  life: number;    // extra hearts
}

/** +2% speed per level, +1 life every 2 levels. Damage comes only from gear. */
export function levelBonus(level: number): LevelBonus {
  return { level, speed: (level - 1) * 2, life: Math.floor((level - 1) / 2) };
}
