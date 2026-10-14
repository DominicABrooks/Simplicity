// Hero movement, actions and weapons. Speeds are game pixels per second; times are seconds.

export const BASE_HP = 5;

export const MOVE = {
  speed: 42,
  swimSpeed: 24,
  attackSlow: 0.35,     // speed multiplier while attacking
  sheepSlow: 0.8,       // ... while polymorphed
  drag: 0.001,          // knockback velocity kept per second
} as const;

export const JUMP_TIME = 0.45;

/** Double-tap dash: 16 px (2 tiles) in a quick burst. */
export const DASH = { time: 0.1, speed: 160, cooldown: 0.6, doubleTap: 0.25 } as const;

/** Punches and the fishing pole's bonk: a short thrust 1..20 px ahead, 7 px either side. */
export const THRUST = { time: 0.3, cooldown: 0.38, reach: 20, width: 7, knock: 90, hitAt: 0.66 } as const;

/** Sword swipes: the blade sweeps +-arc radians around the aim. Swipes alternate sides. */
export const SWIPE = {
  dur: 0.26, step: 22, knock: 90, hitstop: 0.045, shake: 0.12,
  arc: 1.25, reach: 20, sweepStart: 0.25, sweepEnd: 0.6,
} as const;

/** Bow: hold to draw (full power at drawTime), release to shoot. Only a full draw hits hard. */
export const BOW = {
  drawTime: 0.6, drawSlow: 0.45, arrowLife: 0.45, cooldown: 0.25, minSpeed: 110, maxSpeedBonus: 130,
  knock: 90,
  /** A partial draw deals at most this share of your damage, scaled by the draw, rounded down. */
  partialDamage: 0.5,
  stuckTime: 1.5,   // arrows sink into trees and stay there this long
  hitRadius: 5,     // px between cell positions
  nock: 5,          // arrows leave this far out from the hero's centre
} as const;

/** Fishing: cast reach is 10..40 px from the hero; a bite must be hooked within the window. */
export const FISHING = {
  castTime: 0.4, biteWindow: 0.9, castMin: 10, castMax: 40, biteMin: 2, biteRange: 4,
  castCooldown: 0.38,   // before the pole can be used again
  noMouseReach: 24,     // without a mouse, casts land this far along the aim
} as const;

/** Crits: 10% of hits deal double damage and land a little harder. */
export const CRIT = { chance: 0.1, multiplier: 2, hitstop: 0.07, shake: 0.25 } as const;

/** Taking a hit: a moment of invulnerability, a shove away from the source, and a shake. */
export const HURT = { invulnerable: 1, knock: 110, shake: 0.3 } as const;

/** Hold R this long to restart the run. */
export const RESET_HOLD = 1;
