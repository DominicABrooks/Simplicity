// Enemy tuning: slimes, the three mage schools and their spells, and spawn scaling.

export const SLIME = { hp: 3, hopTime: 0.3, hopSpeed: 46, sight: 72, drag: 0.002 } as const;

export const SPAWNING = { startSlimes: 12, startPotions: 8, every: 3, baseCap: 12, maxCap: 20, killsPerCap: 5 } as const;

export type School = "ember" | "frost" | "storm";
export type BoltKind = "fire" | "frost" | "spark" | "poly";
export type SpellName = BoltKind | "nova" | "strike";

/** Three schools share one body and one brain; each has its own bolt and a signature spell. */
export const SCHOOLS: Record<School, { name: string; bolt: BoltKind; special: SpellName }> = {
  ember: { name: "Ember Mage", bolt: "fire", special: "poly" },
  frost: { name: "Frost Mage", bolt: "frost", special: "nova" },
  storm: { name: "Storm Mage", bolt: "spark", special: "strike" },
};

export interface Spell {
  charge: number;
  speed?: number;
  cooldown?: number;
  chance?: number;
  chill?: number;
  sheep?: number;
  radius?: number;
  freeze?: number;
  delay?: number;
  count?: number;
}

export const SPELLS: Record<SpellName, Spell> = {
  fire:   { charge: 0.7, speed: 70 },                                   // 1 damage
  frost:  { charge: 0.7, speed: 60, chill: 2.5 },                       // 1 damage and a slow
  spark:  { charge: 0.45, speed: 140 },                                 // quick to cast, very fast
  poly:   { charge: 1.0, speed: 85, cooldown: 12, chance: 0.45, sheep: 5 },
  nova:   { charge: 0.6, cooldown: 9, radius: 30, freeze: 1.6 },        // cast when you get close
  strike: { charge: 0.6, cooldown: 7, chance: 0.5, delay: 0.9, radius: 7, count: 3 },
};

export const CHILL_SLOW = 0.55;

export const MAGE = {
  hp: 6, speed: 20, near: 28, far: 64, sight: 100, every: [1.6, 2.8], boltLife: 2.4,
  blinkCooldown: 6, stuckBeforeBlink: 0.3, blinkMin: 40, blinkMax: 72,
  // Melee: caught up close with blink on cooldown, it draws a sword and chases you until it can blink.
  chaseSpeed: 30, swingReach: 16, swingWindup: 0.32, swingSweep: 0.16, swingRecover: 0.2, swingRest: 0.5,
  meleeLeash: 44,   // get further than this (5.5 tiles) and it sheathes the sword and goes back to casting
} as const;

/** Mages scale with the hero's level: more likely to appear, more at once, and tougher. */
export const mageChance = (level: number): number => Math.min(0.5, 0.15 + 0.02 * (level - 1));   // 15% at 1, 50% by 18
export const mageCap = (level: number): number => 1 + Math.floor((level - 1) / 5);               // +1 every 5 levels
export const mageHp = (level: number): number => MAGE.hp + 2 * (level - 1);                      // 6 at 1, 44 at 20
/** Mages only start appearing after this many kills. */
export const MAGE_MIN_KILLS = 3;
