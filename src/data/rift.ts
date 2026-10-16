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
 * Calder's fight, at the edge of the great crack (src/game/calderfight.ts). Come close and lightning comes down in a ring
 * round the glade's edge: nobody leaves until one of you falls. Then:
 * - the storm: every so often three circles are marked on the ground (one where the hero stands, one where he's going,
 *   one near), and lightning comes down in them a moment later. Only a dash gets you through (src/systems/hazards.ts).
 * - his blink, so fast he seems to be in three places: he lands close by the hero with two echoes of himself round him.
 *   The echoes throw a spark each and are gone; he stands a moment catching his breath (the one with a shadow), and a
 *   blade in that moment cuts twice as deep.
 * - his static, which turns aside any arrow that isn't a full draw.
 * - the crack: every time the hero's knocked back it opens wider, and every time he lands a hit it closes a little.
 *   The wider it is, the harder its cold pulls him toward it, the faster Calder casts and blinks, and the further its
 *   dark reaches across the ground (stepping into it hurts, and throws him back out: and that opens it wider still).
 */
export const CALDER_FIGHT = {
  /** How close to where he stands (px) the hero has to come for the lightning to shut him in; and how far from the
   *  ring's middle (where he stands: its north side is the crack) it then keeps him. */
  shutAt: 52, keepIn: 44,
  /** Below this share of his health, he's angry. */
  angry: 0.5,
  storm: {
    /** Seconds before the first round, and between rounds: calm, angry. Strikes a round, and seconds from mark to strike. */
    first: 3, every: [4.2, 3], count: 3, warn: 1,
    /** How far ahead of the hero the second lands (seconds of his walking), and how far off the third (px). */
    lead: 0.6, near: [10, 22],
  },
  blink: {
    /** How far from the hero (px) he lands, and his echoes round him; how far he has to have moved in a frame to count as a blink. */
    land: 24, jump: 20,
    /** Seconds he stands catching his breath after (his echoes last as long, then throw their sparks and go). */
    daze: 1.2,
    /** A blade in that moment: damage times this. */
    cut: 2,
  },
  /** His static: an arrow that isn't a full draw is turned aside this close to him (px). */
  static: 14,
  crack: {
    /** How open it is when the fight starts (0 shut, 1 as wide as it goes), how much each knock opens it, and each hit closes it. */
    start: 0.25, knock: 0.12, hit: 0.05,
    /** As wide as it goes: its width times this. */
    widest: 2.1,
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
