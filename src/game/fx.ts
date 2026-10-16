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
  /** The Grey Ringer's toll: a ghostly ring of sound breaking outward from her bell. */
  | { type: "toll"; x: number; y: number; radius: number }
  /** A lightning column where a strike lands. */
  | { type: "bolt"; x: number; y: number }
  /** A golden pillar around the hero. */
  | { type: "levelUp"; x: number; y: number }
  /** A shutter on a window of the house front at (x, y), facing its street, swinging and slamming (src/game/eerie.ts). */
  | { type: "shutter"; x: number; y: number; facing: "north" | "south" | "east" | "west" }
  /** A pale, frosty footprint, pointing `angle` (game radians), the left foot or the right. */
  | { type: "footprint"; x: number; y: number; angle: number; left: boolean }
  /** A pale breath of mist or dust drifting up from here. */
  | { type: "puff"; x: number; y: number; n: number }
  /** A faint ring of sound going out over the street: a far-off bell. */
  | { type: "chime"; x: number; y: number; radius: number };
