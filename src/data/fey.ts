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
} as const;

/** What the fair folk leave him when he comes out of their ring, if they said anything to him while he was in it. */
export const FEY_GIFT = {
  name: "Fey Acorn",
  /** Its note: they leave the last thing they said in it. */
  note: (last: string) => `Warm, and humming. It still holds the last thing they said: ${last}`,
  /** Said as it drops into his hand. */
  says: "Something small and warm drops into your hand.",
} as const;

/**
 * A Fey Acorn planted in open grass (src/game/oaks.ts): a shoot at first, and at the next nightfall a young gilded oak
 * that, after dark, whispers what its acorn held to anyone who comes near. Oaks stay where they're planted, run after run.
 */
export const GILDED_OAK = {
  /** How close to another oak (tiles) one can't be planted, and how far out from the fairy ring's edge it won't take. */
  spacing: 1.2,
  ringMargin: 0.5,
  /** How near (tiles) he has to come for one to whisper, and how long (s) before the same one whispers again. */
  near: 1.6,
  again: 40,
  says: {
    planted: "You press the acorn into the soft ground. Something under the grass hums back.",
    notHere: "It won't take root here. It wants open grass.",
    tooNear: "Too close to another. Give it room to grow.",
    inRing: "The fair folk won't have it in their ring.",
    indoors: "It wants the sky over it.",
    grown: "Somewhere, an acorn has become a little gilded oak.",
  },
} as const;

