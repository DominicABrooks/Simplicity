// One-shot visual effects. Gameplay pushes them; the renderer consumes each once, so gameplay never
// waits on (or knows about) particles. Positions are cell top-lefts, like everything else.

export type BurstPalette = "slime" | "fire" | "arcane" | "frost" | "spark";

export type Fx =
  /** A small yellow spark burst where a hit lands. */
  | { type: "hit"; x: number; y: number }
  /** A bigger burst: a slime popping, a bolt bursting, a mage blinking. */
  | { type: "burst"; x: number; y: number; palette: BurstPalette }
  /** Frost Nova's expanding ring. */
  | { type: "nova"; x: number; y: number; radius: number }
  /** A lightning column where a strike lands. */
  | { type: "bolt"; x: number; y: number }
  /** A golden pillar around the hero. */
  | { type: "levelUp"; x: number; y: number };
