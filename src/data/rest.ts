// Resting by a campfire (see src/game/resting.ts).

export const REST = {
  /** How close to the fire the hero must be to sit down by it (px, centre to centre). */
  reach: 20,
  /** Seconds for each heart back while sitting. */
  every: 3,
} as const;
