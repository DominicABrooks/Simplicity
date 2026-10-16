// Resting by a campfire (see src/game/resting.ts).

export const REST = {
  /** How close to the fire the hero must be to sit down by it (px, centre to centre). */
  reach: 20,
  /** Seconds for each heart back while sitting. */
  every: 3,
} as const;

// Sleeping in a tent or a bed (see src/game/sleeping.ts).

/** A camp's tent and a bed, as targets (radius in px, height in tiles). */
export const TENT_TARGET = { name: "Tent", radius: 9, height: 1.1 } as const;
export const BED_TARGET = { name: "Bed", radius: 6, height: 0.5 } as const;

export const SLEEP = {
  /** How close to the tent or the bed the hero must be to lie down (px, centre to centre). */
  reach: 22,
  /** In-game hours that pass each real second asleep (awake, it's 1 / SECONDS_PER_HOUR). */
  hoursPerSecond: 1,
  /** In-game hours asleep for each heart back. */
  healEvery: 1,
  /** Seconds between the Zs that float up off him. */
  snore: 1.4,
} as const;
