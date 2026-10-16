// The Thunder Rift (src/areas/rift.ts): Calder of the Storm, the leader of the Greyed, at the edge of the great crack,
// and his fight (src/game/calderfight.ts): the last of them, and the end of the road (STORY.md, "0:50 Calder").
import type { KitPiece } from "./items.ts";
import { CINDERS_BRAND, RIME_CIRCLET, RIME_READY } from "./hollow.ts";

/**
 * Calder: a Storm mage underneath (src/systems/mage.ts runs him), only far tougher, his sparks faster still. Once the
 * captain of the wardens and the best Storm mage of his age; he held the great crack shut alone for forty years, and
 * now he's prising it open.
 */
export const CALDER = {
  name: "Calder",
  /** Under his name on the boss bar. */
  title: "Storm Captain of the Greyed",
  hp: 100,
  /** As a target: bigger than a mage. */
  radius: 7,
  height: 1.8,
  /** How much faster than an ordinary Storm mage he gets his casts, his lightning and his blinks back. */
  hurry: 1.7,
  /** How much faster his sparks fly than an ordinary Storm mage's. */
  bolt: 1.1,
  /** Experience for beating him (a mage is worth 50). */
  xp: 400,
} as const;

/**
 * Calder's fight, at the edge of the great crack (src/game/calderfight.ts). Come close and lightning comes down all round
 * the glade in a great ring (the whole glade below the crack): nobody leaves until one of you falls. It's all the shapes
 * lightning makes. He goes through three moods as he weakens:
 * - the storm walks (from full health): his sparks fork into three as they fly, and the lightning comes down in shapes
 *   marked on the ground, a line of strikes walking out from him toward the hero, or a star of them bursting out from
 *   him, each strike landing a moment after the last (only a dash gets you through one: src/systems/hazards.ts).
 * - the rods (below `phases[0]` of his health): he drives three iron rods into the ground round the glade, and lightning
 *   runs between them, one side of the triangle after another, round and round (each side marked by a flicker first;
 *   jump or dash over it). He blinks from rod to rod, so fast he seems to be in three places, and the air he went
 *   through crackles behind him.
 * - the eye of the storm (below `phases[1]`): the whole triangle at once, or a rod at a time arcing to where he stands;
 *   and the bullseye, rings of strikes round the hero closing in to where he stood.
 * Whenever he blinks he stops a moment after to earth himself, and a blade in that moment cuts twice as deep. His
 * static turns any arrow short of a full draw. And the crack: every time the hero's knocked back it opens wider, and
 * every time he lands a hit it closes a little; the wider it is, the harder its cold pulls him toward it, the faster
 * Calder goes, and the further its dark reaches across the ground (stepping into it hurts).
 */
export const CALDER_FIGHT = {
  /** How close to where he stands (px) the hero has to come for the lightning to shut him in. The ring it then keeps
   *  him in: its middle (tiles south of where he stands, its north side the crack), and how far out it is (tiles). */
  shutAt: 52, arena: { below: 4, r: 7.5 },
  /** Below these shares of his health: the rods, and then the eye of the storm. */
  phases: [0.66, 0.33],
  /** His sparks: how long after he throws one it forks (s), into how many, how far apart (radians). */
  fork: { after: 0.32, count: 3, spread: 0.42 },
  /** The strikes' shapes: how long each is marked before the first lands (s). */
  warn: 0.9,
  /** Seconds between shapes, in each mood (the first comes after `first`). */
  shapes: { first: 2.5, every: [3.4, 5, 4.2] },
  /** A line of strikes walking out from him toward the hero (and on past): how many, how far apart (px), how soon after one another (s). */
  walk: { count: 10, step: 11, gap: 0.11 },
  /** A star of them bursting out from him: how many arms, strikes an arm, how far apart, how soon after one another. */
  star: { arms: 6, count: 5, step: 12, gap: 0.13 },
  /** The bullseye: rings of strikes round where the hero stands, outer first, each `between` s after the last, and last
   *  of all one where he stood. How far out each ring is (px), and how many strikes in it. */
  bullseye: { rings: [{ r: 42, count: 14 }, { r: 18, count: 6 }], between: 0.55 },
  rods: {
    /** How far out round the glade's middle they stand (share of the ring), and how long they take to go in (s). */
    out: 0.62, plant: 1.2,
    /** Lightning between them: marked by a flicker (s), then live (s), how close to it hurts (px). */
    arc: { warn: 0.85, live: 0.45, width: 5 },
    /** Seconds between one side of the triangle and the next (the rods); between the whole triangle or the rods arcing to him (the eye). */
    every: [1.5, 3.2],
    /** Seconds between his blinks from rod to rod, and how soon the air he went through crackles live (s) and how long. */
    blink: 4, trail: { warn: 0.2, live: 0.4 },
  },
  /** After any blink, he stops this long to earth himself (s); a blade in that moment: damage times `cut`. How far he
   *  has to have moved in a frame to count as a blink (px). */
  earth: 0.9, cut: 2, jump: 20,
  /** His static: an arrow that isn't a full draw is turned aside this close to him (px). */
  static: 14,
  crack: {
    /** How open it is when the fight starts (0 shut, 1 as wide as it goes), how much each knock opens it, and each hit closes it. */
    start: 0.25, knock: 0.12, hit: 0.05,
    /** As wide as it goes: its width times this. */
    widest: 1.45,
    /** How hard its cold pulls the hero toward it at its widest (px/s), and for how long it lets go after biting him (s);
     *  and how much faster Calder gets at its widest. */
    pull: 10, letGo: 2, hurry: 0.8,
    /** How long it takes to groan shut when he falls (s), sealed over with grey stone; and how wide the seam of new
     *  stone is, times its width (a little wider than the crack was, over the rubble at its lips). */
    shut: 3, seam: 1.35,
  },
  say: {
    shut: "Lightning comes down all round the glade! There's no way out.",
    rise: "Calder turns from the edge of the crack. \"So. You're the one they can't see.\"",
    open: "The lightning round the glade flickers, and goes out.",
    static: "Calder's static turns the arrow aside. Only a full draw gets through.",
    wider: "The great crack yawns wider!",
    widest: "The great crack is wide open! Its cold drags at you.",
    cold: "The dark in the crack bites!",
    caught: "Caught!",
    rods: "Calder drives three iron rods into the ground. Lightning runs between them!",
    eye: "The sky over the glade goes white. Calder calls the whole storm down!",
    shutCrack: "The great crack groans, and grinds shut.",
  },
} as const;

/** As he falls (STORY.md): the grey goes out of him last of all; and he says it in Vael. */
export const CALDER_LAST_WORDS = [
  "(The grey goes out of Calder last of all. For a moment he's only a tired old Storm mage, leaning on nothing.)",
  "(He looks at you, and says something in Vael, softly. Somehow you understand it.)",
  "\"Oh. He sent you. Good.\"",
  "(A spark leaves him and flies away south, over the trees. His body crumbles to grey stone, all but his head.)",
] as const;

/** ...and then, across the top. */
export const CALDER_FALLS = ["All through the Witchwood, the Greyed stand still and look up."] as const;

/**
 * What's left of him (STORY.md): his head, a round grey stone with the dark gone out of its face. It doesn't fade
 * where it lies, and it's for carrying back to the King (the way home and the King's ending are their own pieces).
 */
export const CALDERS_HEAD: KitPiece = ["runestone", "legendary", {}, "Calder's Head"];

/**
 * What a hero on the straight path has on reaching Calder (STORY.md: about level 9, everything above plus the climb's
 * drops): the Hollow's kit with Rime's circlet on and Cinder's Brand in the bag, the bow in hand. Worn when you go
 * straight to him to playtest (src/debug.ts).
 */
export const CALDER_READY = {
  level: 9,
  kit: RIME_READY.kit.map(piece => (piece[0] === "hood" ? RIME_CIRCLET : piece)),
  bag: [CINDERS_BRAND] satisfies readonly KitPiece[],
} as const;
