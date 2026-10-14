// The sword swing curve, shared by the hero's swipes and the mages' melee swings.
import { angleDiff } from "../core/math.ts";
import { MAGE } from "../data/enemies.ts";
import { SWIPE } from "../data/player.ts";

/**
 * The blade's angle relative to the aim at swing progress k (0..1) for a swing toward `side` (+-1):
 * wind up to one side, sweep across with an ease, then recover back toward the middle.
 */
export function swingRel(side: number, k: number): number {
  const { arc, sweepStart: S, sweepEnd: E } = SWIPE;
  if (k < S) return side * arc * (0.4 + 0.6 * (k / S));
  if (k < E) {
    const u = (k - S) / (E - S);
    return side * arc * (1 - 2 * u * u * (3 - 2 * u));
  }
  return -side * arc * (1 - (k - E) / (1 - E));
}

/** Is the blade sweeping (able to hit) at some point between progress kPrev and k? */
export const sweeping = (kPrev: number, k: number): boolean => k > SWIPE.sweepStart && kPrev < SWIPE.sweepEnd;

/**
 * Did the blade pass through angle `rel` (relative to the aim) between progress kPrev and k?
 * Only the sweep phase hits; `slack` (radians) widens the arc for the target's size.
 */
export function sweptThrough(side: number, kPrev: number, k: number, rel: number, slack = 0.3): boolean {
  if (!sweeping(kPrev, k)) return false;
  const a0 = swingRel(side, Math.max(kPrev, SWIPE.sweepStart)), a1 = swingRel(side, Math.min(k, SWIPE.sweepEnd));
  return rel >= Math.min(a0, a1) - slack && rel <= Math.max(a0, a1) + slack;
}

/** The angle from one point to another, relative to an aim. */
export const relativeAngle = (dx: number, dy: number, aim: number): number => angleDiff(Math.atan2(dy, dx), aim);

/** One mage sword swing: a long, readable wind-up, a fast sweep, a short recovery, mapped onto swingRel's k. */
export function mageSwingK(t: number): number {
  const W = MAGE.swingWindup, S = MAGE.swingSweep, R = MAGE.swingRecover;
  const { sweepStart, sweepEnd } = SWIPE;
  if (t < W) return sweepStart * (t / W);
  if (t < W + S) return sweepStart + (sweepEnd - sweepStart) * ((t - W) / S);
  return Math.min(1, sweepEnd + (1 - sweepEnd) * ((t - W - S) / R));
}

export const MAGE_SWING_TIME = MAGE.swingWindup + MAGE.swingSweep + MAGE.swingRecover;
