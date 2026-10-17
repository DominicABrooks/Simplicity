// Cutscenes: short scenes the game plays for you, control taken away and the screen letterboxed, the camera
// moving on its own. Each is a list of beats, played in order (see src/game/cutscene.ts). Q (or Escape) skips.
import { KING_HOMECOMING } from "./ending.ts";
import { KING_AUDIENCE, KINGS_TASK } from "./king.ts";

/** The eye under the crack, in its scene: how long (s) it takes to open, and to search and narrow (src/render/undercroft.ts plays it). */
export const EYE_BEATS = { open: 1.1, search: 2.2 } as const;

/** What the camera looks at: the hero, the speaker, or between the two. */
export type Look = "hero" | "speaker" | "both";

/** Something that happens at a point in a scene, beyond walking and talking (the game says what: see onCue). */
export type Cue = "layHead" | "credits";

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
  /** What happens as the beat starts (once any walking's done). */
  cue?: Cue;
}

export interface Scene {
  id: string;
  /** Plays the first time (each run) the hero arrives in this area... */
  area: string;
  /** ...or, if this is set, once he comes this near (px) to whoever speaks; and only when the game says it can (see onlyIf). */
  near?: number;
  /** ...where this is who speaks (or, with no lines, who the scene's about): the render kind of the one to find there. */
  speaker: "king" | "stitches";
  /** Their conversation key (as talk.ts keeps them): the scene counts as the first talk with them. */
  key: string;
  beats: readonly Beat[];
  /** Shown as the scene ends (or is skipped). */
  after?: string;
  /** What happens as it ends (or is skipped). */
  then?: Cue;
  /** How fast the hero walks in a scene: a stately pace, px per second. */
  pace: number;
}

export const SCENES: readonly Scene[] = [
  {
    // The King's audience: in through the doors, the hall laid out ahead; up the long carpet to the foot of the
    // dais; the King, close; and his speech, the two of them in frame, ending with the watchword for his woodwardens.
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
  {
    // The homecoming (src/game/ending.ts): the King, out on the keep steps to see what the noise is; the hero carries
    // the head up to him through the crowd and sets it at his feet; the King looks at it, and at the crowd, and has his
    // say. Then the credits.
    id: "homecoming", area: "castle", near: 72, speaker: "king", key: "king", pace: 30,
    beats: [
      { look: "speaker", zoom: 0.8, hold: 1.4 },
      { look: "both", zoom: 0.9, approach: 20 },
      { look: "both", zoom: 0.6, hold: 1.2, cue: "layHead" },
      { look: "speaker", zoom: 0.5, hold: 2.2 },
      { look: "both", zoom: 0.62, say: KING_HOMECOMING.slice(0, 3) },
      { look: "hero", zoom: 0.95, hold: 1.4 },                  // a look back at the crowd, not far out: he's still talking
      { look: "both", zoom: 0.75, say: KING_HOMECOMING.slice(3) },
      { look: "both", zoom: 0.75, hold: 1 },
    ],
    then: "credits",
  },
  {
    // The deep places (src/game/sealchamber.ts), the first time in: no words. The camera eases down over the crack; the
    // eye under it opens, and searches along it, past the hero, back; it can't see him (the Erl-King: when it looks
    // for him it finds only warmth, and it's afraid), and it stops, and narrows. Then back to him.
    id: "eye", area: "sealchamber", near: 200, speaker: "stitches", key: "crack", pace: 26,
    beats: [
      { look: "both", zoom: 0.95, hold: 0.6 },
      { look: "speaker", zoom: 0.42, hold: EYE_BEATS.open },
      { look: "speaker", zoom: 0.42, hold: EYE_BEATS.search },
      { look: "hero", zoom: 1, hold: 0.7 },
    ],
  },
];
