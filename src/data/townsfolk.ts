// The townsfolk out and about: how many of the census's common people are on the streets of each area,
// hour by hour; how they walk, how long they stay at what they're doing, and how children keep together.
// (What they wear is their own: see src/world/wardrobe.ts.)

export const TOWNSFOLK = {
  /** How many are out at once at the busiest time of day, by area id. */
  out: { capital: 30, castle: 10, kingsroad: 6 } as Record<string, number>,
  /** How busy the streets are through the day, 0-1, at each hour from midnight. */
  busy: [0.08, 0.05, 0.04, 0.04, 0.05, 0.12, 0.35, 0.65, 0.9, 1, 1, 1, 1, 1, 1, 1, 0.95, 0.9, 0.8, 0.7, 0.55, 0.4, 0.25, 0.14],
  /** Seconds between one party going in and the next coming out. */
  every: [1.5, 5] as const,
  /** Walking speed, px per second (the hero walks at 42). */
  speed: { adult: [17, 23], child: [20, 27], old: [11, 15] } as const,
  /** Seconds they stay at what they're doing. */
  stay: {
    work: [40, 90], shop: [4, 9], chat: [10, 25], drink: [20, 45], church: [6, 12], errand: [1, 3], play: [15, 30],
  } as Record<string, readonly [number, number]>,
  /** Hours of things: when work starts and stops, when the inns fill, and when everyone's in. */
  hours: { workFrom: 7, workTo: 18, innFrom: 17, bedtime: 22, kidsIn: 19 },
  /** How far behind their leader (px) a child walks, and how far beside them they stand; how far kids run about at play (tiles). */
  follow: { gap: 7, beside: 6, play: 2.5 },
  /** Knocking at a door: how close the hero must be (px), how long before someone comes (s), how long they'll stand
   *  in the doorway (s), how far off the hero can go before they go back in (px), and how likely nobody comes at night. */
  knock: { reach: 16, answer: 1.4, wait: 30, leave: 36, asleep: 0.6 },
  /** As a target: ring radius (px) and height (world units, for an adult). */
  radius: 4.5,
  height: 1.3,
  /** How close the hero can come in front of them before they stop and wait (px), and for how long. */
  personal: 8,
  patience: 1.2,
} as const;
