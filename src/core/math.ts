/** Signed difference between two angles, wrapped to [-PI, PI]. */
export const angleDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Ease a value toward a target, frame-rate independent (k is the rate per second). */
export const smooth = (cur: number, target: number, dt: number, k: number): number =>
  cur + (target - cur) * (1 - Math.exp(-dt * k));

/** Turn an angle toward a target along the shortest way round, frame-rate independent. */
export const turn = (cur: number, target: number, dt: number, k: number): number =>
  cur + angleDiff(target, cur) * (1 - Math.exp(-dt * k));

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
