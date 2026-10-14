// The townsfolk out and about: how many of the census's common people are on the streets of each area at
// once, how they walk and how long they stay, and the colours they wear.

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

/** Undyed and cheaply dyed cloth for most folk; richer colours for merchants; black for clergy. */
export const CLOTH = {
  common: ["#8a6a4a", "#a8845a", "#6f7a4a", "#5d6a7d", "#9a5a3e", "#7a6f62", "#b8a07a", "#6b4f3a", "#4f6b5a", "#8f7d5f"],
  rich: ["#2f4f8a", "#8a2f3a", "#2f6b4a", "#5a3a7a", "#7a5a2a"],
  clergy: ["#2b2830", "#3a3540"],
  /** Aprons, coifs and caps. */
  linen: ["#e8e0cc", "#d8cfb8", "#c9bea4"],
} as const;
