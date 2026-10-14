// Work done out in the open that you can see and hear: the smith at the anvil, the minstrel at the fountain.

export const CRAFTS = {
  /** Seconds between strokes of the smith's hammer (each one throws sparks off the anvil). */
  hammer: 0.9,
  /** Seconds between the notes a minstrel's tune floats up (a range), and their colour. */
  notes: [0.7, 1.5] as readonly [number, number],
  note: "#f5d562",
} as const;
