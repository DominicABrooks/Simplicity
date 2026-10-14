// The townsfolk out and about: how many of the census's common people are on the streets of each area at
// once, how they walk and how long they stay. (What they wear is their own: see src/world/wardrobe.ts.)

export const TOWNSFOLK = {
  /** How many are out at once, by area id. */
  out: { capital: 30, castle: 10, kingsroad: 6 } as Record<string, number>,
  /** Seconds between one going in and the next coming out. */
  every: [1.5, 5] as const,
  /** Walking speed, px per second (the hero walks at 42). */
  speed: { adult: [17, 23], child: [20, 27], old: [11, 15] } as const,
  /** Seconds they stand about: at their work, and anywhere else. */
  work: [12, 30] as const,
  stop: [2, 7] as const,
  /** As a target: ring radius (px) and height (world units, for an adult). */
  radius: 4.5,
  height: 1.3,
  /** How close the hero can come in front of them before they stop and wait (px), and for how long. */
  personal: 8,
  patience: 1.2,
} as const;
