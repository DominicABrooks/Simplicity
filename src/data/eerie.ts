// The city after dark. Kingsholm's streets are emptied by the curfew bell, and a city that whispers all day has
// plenty left over for the night: now and then, while the hero walks them alone, something happens that
// nobody could explain and nobody would admit to. A shutter bangs with no one at the window. Footsteps keep
// pace behind him and stop when he does. Someone stands at the end of the street, watching, and isn't there
// when he gets close. A lamp gutters out as he passes and catches again on its own. A well whispers. And at
// nine, far off toward the river, a little bell rings the curfew, though nobody in the city is ringing it.
//
// And the watcher isn't only the city's. Out on the King's Road, in the Witchwood, the Ashwild and the Frozen
// Hollow, after dark, he stands just inside the trees at the edge of open ground, and is gone when the hero comes.
//
// None of it can hurt him. It's only the city, being a city that's been told not to talk about things. Nothing
// says so, either: no message tells the player what just happened. They see it and hear it, or they don't.
// How it's run is src/game/eerie.ts; the watcher at the end of the street is drawn in src/render/watcher.ts, and
// the shutter, the footprints, the mist and the bell's ring in src/render/fx.ts.

/** The things that happen. */
export type EerieId = "shutter" | "footsteps" | "watcher" | "lamp" | "well" | "curfew";

/**
 * Each area it happens in (outdoors, never a house's inside, never by day): which of them can happen there, and how
 * likely each is when it's its turn (one that isn't listed never does, nor one weighted 0); how many seconds between
 * one and the next (picked at random between these); and where the watcher stands, at the end of a street or just
 * inside the trees.
 */
export interface EerieArea {
  weights: Partial<Record<EerieId, number>>;
  every: readonly [number, number];
  watcher: "street" | "trees";
}

/**
 * Tuning. Times in seconds (real), distances in px. A night in the city lasts about 200 seconds (8 hours of 25),
 * so with these a hero who spends the whole night in the streets meets two to four of them.
 */
export const EERIE = {
  /**
   * Where it happens (see EerieArea). The city has all of them; out in the wild there's only the watcher in the
   * trees, and not as often: the wild's dark has enough in it already.
   */
  areas: {
    capital: { weights: { shutter: 3, footsteps: 3, watcher: 2, lamp: 3, well: 2, curfew: 6 }, every: [35, 75], watcher: "street" },
    kingsroad: { weights: { watcher: 1 }, every: [50, 100], watcher: "trees" },
    witchwood: { weights: { watcher: 1 }, every: [50, 100], watcher: "trees" },
    ashwild: { weights: { watcher: 1 }, every: [60, 120], watcher: "trees" },
    hollow: { weights: { watcher: 1 }, every: [60, 120], watcher: "trees" },
  } satisfies Record<string, EerieArea> as Record<string, EerieArea>,
  /** How long after arriving, or after nightfall, before the first can happen. */
  settle: 15,
  /** At most this many a night. */
  most: 4,
  /** Not near St Mary's churchyard (px round the graves): that's the Grey Ringer's, and she doesn't share. */
  churchyard: 70,
  /** Nor near a boss's arena (tiles past its ring: Cinder's stones, Rime's ice pillars), nor while any boss is up. */
  arena: 4,

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
  watcher: { wide: 34, deep: 26, steps: [1, 0.85, 0.7] as const, near: 16, last: 14, fade: 0.6 },
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

/**
 * Anyone still out in the streets near where it happens (px) takes fright: they shout one of these and run for
 * home, this many times their walking pace (like they do from the Grey Ringer, src/game/townsfolk.ts). The bell
 * frightens anyone near the hero, who hears it too.
 */
export const FRIGHT = {
  radius: 64,
  run: 2.2,
  shouts: [
    "What was that?!",
    "Who's there?",
    "Not again!",
    "Mind the weather!",
    "Home! Now!",
    "Did you hear that?",
    "Lord preserve us!",
    "I'm not stopping!",
    "Salt on the sills!",
    "Don't look at it!",
  ],
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
