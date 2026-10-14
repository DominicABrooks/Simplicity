// People who aren't enemies. Their look is the hero's body (src/render/models/body.ts) in their own gear.

/**
 * A training dummy in a castle yard: a hostile target you can hit as much as you like. It takes every hit
 * (the numbers, the crits) but never falls: its health just fills up again. No XP, no drops.
 */
export const DUMMY = {
  name: "Training Dummy",
  radius: 4.5,
  height: 1.3,
  /** Health it's shown with, filled up again after every hit. */
  hp: 100,
} as const;

/** A guard at their post: a friendly target, and how they keep watch (see src/systems/sentry.ts). */
export const GUARD = {
  /** As a target: named, never hostile (a yellow ring, like the campfire's). */
  name: "Royal Guard",
  radius: 5,
  height: 1.5,
  /** How close the hero comes (px) before a guard turns to watch them... */
  notice: 30,
  /** ...if they're within this angle either side of where the guard's post faces (radians)... */
  fieldOfView: 1.7,
  /** ...turning at most this far from it. */
  maxTurn: 1.2,
  /** Seconds between glances while keeping watch (from, to). */
  glance: [2.5, 6.5] as const,
  /** How quickly they turn (rate per second; see turn() in core/math.ts). */
  turnRate: 2.2,
} as const;
