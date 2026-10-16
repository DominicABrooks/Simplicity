// The city after dark. Kingsholm's streets are emptied by the curfew bell, and a city that whispers all day has
// plenty left over for the night: now and then, while the hero walks them alone, something happens that
// nobody could explain and nobody would admit to. A shutter bangs with no one at the window. Footsteps keep
// pace behind him and stop when he does. Someone stands at the end of the street, watching, and isn't there
// when he gets close. A lamp gutters out as he passes and catches again on its own. A well whispers. And at
// nine, far off toward the river, a little bell rings the curfew, though nobody in the city is ringing it.
//
// None of it can hurt him. It's only the city, being a city that's been told not to talk about things. Nothing
// says so, either: no message tells the player what just happened. They see it and hear it, or they don't.
// How it's run is src/game/eerie.ts; the watcher at the end of the street is drawn in src/render/watcher.ts, and
// the shutter, the footprints, the mist and the bell's ring in src/render/fx.ts.

/** The things that happen. */
export type EerieId = "shutter" | "footsteps" | "watcher" | "lamp" | "well" | "curfew";

/**
 * Tuning. Times in seconds (real), distances in px. A night in the city lasts about 200 seconds (8 hours of 25),
 * so with these a hero who spends the whole night in the streets meets two to four of them.
 */
export const EERIE = {
  /** The areas it happens in: the city's streets (never a house's inside, never by day). */
  areas: ["capital"] as readonly string[],
  /** How long after arriving, or after nightfall, before the first can happen. */
  settle: 15,
  /** Seconds between one and the next (picked at random between these). */
  every: [35, 75] as const,
  /** At most this many a night. */
  most: 4,
  /** Not near St Mary's churchyard (px round the graves): that's the Grey Ringer's, and she doesn't share. */
  churchyard: 70,
  /** How likely each is, when it's its turn (and it can happen there and then). 0 and it never does. */
  weights: { shutter: 3, footsteps: 3, watcher: 2, lamp: 3, well: 2, curfew: 6 } satisfies Record<EerieId, number>,

  /**
   * A shutter on a window of a house this near (px), in sight but not right beside him (and no further across or up
   * the screen than `wide` and `up`: the view's wider than it's tall), swings open in a
   * wind that isn't blowing and slams shut, again and again: these many seconds in (each slam a little jolt), the
   * swings dying away (how far open, radians).
   */
  shutter: { near: [16, 46] as const, wide: 40, up: 18, slams: [0.6, 1.5, 2.2, 3.3, 4.0] as const, open: [1.9, 1.6, 1.1, 1.3, 0.5] as const, jolt: 1.4 },
  /**
   * Footsteps behind him (px), one every so often while he walks, each leaving a pale, frosty print on the stones
   * that fades after a while (s): until he stops, or this long. Then they stop too.
   */
  footsteps: { behind: 11, gap: 0.32, last: 12, least: 1.5, prints: 6 },
  /**
   * The watcher stands down a clear line of street, near the edge of what the hero can see: this far off (px) across
   * the screen and up or down it (the view is wider than it's tall), or a little nearer (`steps`, shares of that).
   * Gone if he comes this near, or after this long.
   */
  watcher: { wide: 44, deep: 30, steps: [1, 0.85, 0.7] as const, near: 20, last: 14, fade: 0.6 },
  /** A lit lamp this near (px) sputters for a moment (flickering every so often, s), goes out for this long, and sputters back. */
  lamp: { near: 36, gutter: 1.1, flicker: [0.05, 0.16] as const, out: 4.5, catch: 0.5 },
  /** A well this near (px) whispers, a line every so often, a breath of mist coming up with each. */
  well: { near: 40, gap: 1.6, lines: 3 },
  /**
   * The little bell rings nine strokes, this far apart, toward the river (south); only around the curfew hour.
   * Each sends a faint ring of sound across the street from that side (px south of him, and its size).
   */
  curfew: { from: 21, to: 22.5, strokes: 9, gap: 1.1, away: 150, ring: { at: 26, radius: 20 } },
} as const;

/** What the well whispers, a line at a time, floating up out of it. */
export const WHISPERS = {
  lines: [
    "...down here...",
    "...mind the weather...",
    "...she saw them...",
    "...don't say it...",
    "...under the Crown...",
    "...little stone...",
    "...it's warm down here...",
    "...they're coming back...",
  ],
  color: "#b4c0d6",
} as const;
