// Cutscenes: short scenes the game plays for you, control taken away and the screen letterboxed, the camera
// moving on its own. Each is a list of beats, played in order (see src/game/cutscene.ts). Escape skips.
import { KING_AUDIENCE, KINGS_TASK } from "./king.ts";

/** What the camera looks at: the hero, the speaker, or between the two. */
export type Look = "hero" | "speaker" | "both";

export interface Beat {
  /** Where the camera looks, and how close (1 is the usual distance; less is closer, more is wider). */
  look: Look;
  zoom: number;
  /** The hero walks up to stand this many px in front of the speaker, then the beat goes on. */
  approach?: number;
  /** The speaker says these; the beat lasts until they're done (a click goes on, as in any conversation). */
  say?: readonly string[];
  /** Seconds the beat holds once any walking's done (and before any lines). */
  hold?: number;
}

export interface Scene {
  id: string;
  /** Plays the first time (each run) the hero arrives in this area... */
  area: string;
  /** ...where this is who speaks: the render kind of the one to find there. */
  speaker: "king";
  /** Their conversation key (as talk.ts keeps them): the scene counts as the first talk with them. */
  key: string;
  beats: readonly Beat[];
  /** Shown as the scene ends (or is skipped). */
  after?: string;
  /** How fast the hero walks in a scene: a stately pace, px per second. */
  pace: number;
}

export const SCENES: readonly Scene[] = [
  {
    // The King's audience: in through the doors, the hall laid out ahead; up the long carpet to the foot of the
    // dais; the King, close; and his speech, the two of them in frame, ending with his writ in the hero's hand.
    id: "audience", area: "throneroom", speaker: "king", key: "king", pace: 26,
    beats: [
      { look: "both", zoom: 1.45, hold: 1.8 },
      { look: "hero", zoom: 1.05, approach: 24 },
      { look: "speaker", zoom: 0.55, hold: 1.2 },
      { look: "both", zoom: 0.72, say: KING_AUDIENCE },
      { look: "hero", zoom: 0.9, hold: 0.8 },
    ],
    after: KINGS_TASK,
  },
];
