// The fair folk's tuning: what standing in a fairy ring after dark does to you (src/game/fairyring.ts).

export const FAIRY_RING = {
  /** How far in it starts the moment he steps into the ring at night (0 to 1). */
  base: 0.3,
  /** Seconds standing still till it's all he can see. */
  full: 4,
  /** Seconds standing still till the hearts, the bar and the rest start to fade too, and how many more till they're gone. */
  uiFrom: 8,
  uiOver: 3,
  /** How far (px) he can drift in a frame and still be standing still. */
  drift: 0.05,
  /**
   * Seconds standing still till the fair folk start talking to him (src/data/feysayings.ts), and how each thing they say
   * comes and goes (s): it holds at least `hold`, longer the longer it is (`perChar` a letter, to read it by).
   */
  speakFrom: 8,
  line: { in: 1, hold: 3.4, perChar: 0.055, out: 1.2, gap: 0.8 },
  /**
   * What he hears in it: bells now and then, closer together the deeper he's in (seconds between them, [min, max], at
   * the deepest; twice that the moment he steps in), and a low wavering hum every `hum` seconds once he's `humFrom` deep.
   */
  sound: { chime: [0.6, 1.6], hum: 2.2, humFrom: 0.5 },
} as const;

/** What the fair folk leave him when he comes out of their ring, if they said anything to him while he was in it. */
export const FEY_GIFT = {
  name: "Fey Acorn",
  /** Its note: they leave the last thing they said in it. */
  note: (last: string) => `Warm, and humming. It still holds the last thing they said: ${last}`,
  /** Said as it drops into his hand. */
  says: "Something small and warm drops into your hand.",
} as const;
