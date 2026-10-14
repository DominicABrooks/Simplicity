// Enemy tuning: slimes, the three mage schools and their spells, and spawn scaling.

/** How enemies show up as targets: name, ring radius (px) and height (world units). */
export const SLIME_TARGET = { name: "Slime", radius: 4.5, height: 0.6 } as const;
export const MAGE_TARGET = { radius: 5, height: 1.15 } as const;

export const SLIME = { hp: 3, hopTime: 0.3, hopSpeed: 46, sight: 72, drag: 0.002, firstHop: 0.5, hopEvery: 0.7 } as const;

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
  /** Bolts curve toward the hero at up to this many radians per second (low enough to sidestep). */
  homing?: number;
}

export const SPELLS: Record<SpellName, Spell> = {
  fire:   { charge: 0.7, speed: 70, homing: 1.5 },                      // 1 damage
  frost:  { charge: 0.7, speed: 60, homing: 1.3, chill: 2.5 },          // 1 damage and a slow
  spark:  { charge: 0.45, speed: 140, homing: 0.7 },                    // quick to cast, very fast, barely bends
  poly:   { charge: 1.0, speed: 85, homing: 1.8, cooldown: 12, chance: 0.45, sheep: 5 },
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
  firstSwing: 0.35,    // delay before the first swing after drawing the sword
  afterBlink: 0.8,     // a beat to reorient before casting after a blink
  afterLeash: 0.6,     // ... and after you escape its sword
  boltOffset: 5,       // bolts start this far out from the mage's centre
  blinkTries: 60,
} as const;

/** The order a new mage's school is rolled in. */
export const SCHOOL_ORDER: School[] = ["ember", "frost", "storm"];

/** A hit enemy holds still this long before acting again. */
export const STAGGER = 0.6;

/** Mages scale with the hero's level: more likely to appear, more at once, and tougher. */
export const mageChance = (level: number): number => Math.min(0.5, 0.15 + 0.02 * (level - 1));   // 15% at 1, 50% by 18
export const mageCap = (level: number): number => 1 + Math.floor((level - 1) / 5);               // +1 every 5 levels
export const mageHp = (level: number): number => MAGE.hp + 2 * (level - 1);                      // 6 at 1, 44 at 20
/** Mages only start appearing after this many kills. */
export const MAGE_MIN_KILLS = 3;
