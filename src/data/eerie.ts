// The city after dark. Kingsholm's streets are emptied by the curfew bell, and a city that whispers all day has
// plenty left over for the night: now and then, while the hero walks them alone, something happens that
// nobody could explain and nobody would admit to. A shutter bangs with no one at the window. Footsteps keep
// pace behind him and stop when he does. Someone stands at the end of the street, watching, and isn't there
// when he gets close. A lamp gutters out as he passes and catches again on its own. A well whispers. And at
// nine, far off toward the river, a little bell rings the curfew, though nobody in the city is ringing it.
//
// None of it can hurt him. It's only the city, being a city that's been told not to talk about things.
// How it's run is src/game/eerie.ts; the watcher at the end of the street is drawn in src/render/watcher.ts.

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

  /** A shutter bangs on a house this near (px), not right beside him. */
  shutter: { near: [30, 110] as const },
  /** Footsteps behind him (px), one every so often while he walks: until he stops, or this long. */
  footsteps: { behind: 26, gap: 0.42, last: 12, least: 1.5 },
  /**
   * The watcher stands down a clear line of street, near the edge of what the hero can see: this far off (px) across
   * the screen and up or down it (the view is wider than it's tall), or a little nearer (`steps`, shares of that).
   * Gone if he comes this near, or after this long.
   */
  watcher: { wide: 44, deep: 30, steps: [1, 0.85, 0.7] as const, near: 20, last: 14, fade: 0.6 },
  /** A lit lamp this near (px) gutters out for this long. */
  lamp: { near: 36, out: 3.5 },
  /** A well this near (px) whispers, a line every so often. */
  well: { near: 40, gap: 1.6, lines: 3 },
  /** The little bell rings nine strokes, this far apart, toward the river (south); only in the curfew hour. */
  curfew: { from: 21, to: 22, strokes: 9, gap: 1.1, away: 150 },
} as const;

/** What's said (toasts), and what the well whispers (floating over it). */
export const EERIE_SAYS = {
  shutter: [
    "A shutter bangs up the street. Nobody's at the window.",
    "Somewhere close, a shutter slams. The window behind it is dark.",
    "A shutter swings and bangs, swings and bangs. There's no wind.",
  ],
  footsteps: "Footsteps, behind you, keeping pace.",
  footstepsStop: "When you stop, so do they. There's nobody there.",
  footstepsFade: "The footsteps turn off down a lane, and are gone.",
  watcher: "Someone is standing at the end of the street, watching you.",
  watcherGone: "There's nobody there.",
  watcherLeft: "When you look again, the end of the street is empty.",
  lamp: "The lamp beside you gutters and goes out.",
  lampBack: "...and catches again, by itself.",
  well: "Something down the well is whispering.",
  whispers: [
    "...down here...",
    "...mind the weather...",
    "...she saw them...",
    "...don't say it...",
    "...under the Crown...",
    "...little stone...",
    "...it's warm down here...",
    "...they're coming back...",
  ],
  whisperColor: "#b4c0d6",
  curfew: "Far off toward the river, a little bell is ringing nine. Nobody in the city is ringing it.",
  curfewBag: "The little bell in your bag is ringing nine, all by itself.",
} as const;
