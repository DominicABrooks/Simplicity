// The city's dogs and cats: how many are about in each area, how they move, how long they settle, and how
// they take to the hero and to each other. (Their coats are drawn by the renderer: see src/render/models/pets.ts.)

export type Species = "dog" | "cat";

export const PETS = {
  /** How many of each are about, by area id. */
  out: { capital: { dog: 9, cat: 12 }, castle: { dog: 3, cat: 4 } } as Record<string, Record<Species, number>>,
  /** How many coats each has to choose from (the renderer's list is the same length). */
  coats: { dog: 5, cat: 6 } as Record<Species, number>,
  /** Speeds, px per second (the hero walks at 42): an easy pace, and running. */
  speed: { dog: { walk: [24, 32], run: [58, 66] }, cat: { walk: [11, 15], run: [62, 72] } } as Record<Species, { walk: readonly [number, number]; run: readonly [number, number] }>,
  /** How far they go when they set off (tiles, at most, as the crow flies). */
  roam: { dog: 12, cat: 9 } as Record<Species, number>,
  /** Seconds they stay put once there: sniffing about, sitting, or lying down. */
  stay: { sniff: [1.5, 4], sit: [4, 10], lie: [10, 25], doze: [25, 60] } as Record<string, readonly [number, number]>,
  /** A dog trots up to the hero who comes within this many px (some of the time), sits a step away and wags. */
  greet: { near: 24, chance: 0.5, gap: 9, bored: [6, 12] as readonly [number, number] },
  /** A cat bolts from anything (the hero, a dog) that comes this close (px) while it's awake, this far (tiles). */
  shy: { near: 13, dogNear: 16, far: 7 },
  /** Hours they're mostly lying about: the small hours (rain sends the cats to the doorsteps too). */
  sleepy: { from: 22, to: 5 },
} as const;
