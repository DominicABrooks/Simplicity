// Beating a boss: the celebration (src/game/victory.ts, src/ui/victory.ts).

export const VICTORY = {
  /** Seconds the whole thing lasts: the banner up, then gone; the music held off till then. */
  last: 5.5,
  /** Seconds the world stops dead as they fall, and how hard the screen shakes. */
  hitstop: 0.45, shake: 4,
  /**
   * Fireworks round the hero: the first after `first` s, then every `every` s [min, max] until `until` s in, each
   * `near` px [min, max] from him and `up` px over his head.
   */
  fireworks: { first: 0.5, every: [0.18, 0.4], until: 4, near: [14, 46], up: 10 },
  /** How many bits of confetti come down. */
  confetti: 70,
  /** What the banner says over their name and title. */
  says: "Victory!",
} as const;
