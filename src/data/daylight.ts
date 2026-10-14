// The day/night cycle. The hour of the day runs on through play (and across runs); the renderer lights
// the world by it and the HUD shows it as a notch sliding between a sun and a moon.

/** Real seconds per in-game hour: a whole day is 24 of these (10 minutes). */
export const SECONDS_PER_HOUR = 25;
/** The hour a new game starts at: mid-morning. */
export const START_HOUR = 8;
/** Daytime runs from sunrise to sunset; the rest is night (the moon is up), half as long as the day. */
export const SUNRISE = 5, SUNSET = 21;

export const isDay = (hour: number): boolean => hour >= SUNRISE && hour < SUNSET;

/**
 * Where the clock's notch sits between the sun (0) and the moon (1): across from sun to moon as the
 * day passes, then back again through the night. No numbers, just how far the day or night has run.
 */
export function dialPosition(hour: number): number {
  if (isDay(hour)) return (hour - SUNRISE) / (SUNSET - SUNRISE);
  return 1 - ((hour - SUNSET + 24) % 24) / (24 - (SUNSET - SUNRISE));
}
