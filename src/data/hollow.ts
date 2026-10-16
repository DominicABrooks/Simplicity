// The Frozen Hollow (src/areas/hollow.ts): Rime, the Frost lieutenant of the Greyed, out in the middle of the frozen
// lake, and her fight (src/game/rimefight.ts); and the hunter's hut on the rim, where the bow is.
import type { KitPiece } from "./items.ts";

/**
 * Rime: a Frost mage underneath (src/systems/mage.ts runs her), only far tougher, her novas wider and her bolts
 * faster. She once kept the Vael's oldest songs; now she hums the one note the Gloom hums, very beautifully.
 */
export const RIME = {
  name: "Rime",
  /** Under her name on the boss bar. */
  title: "Frost Lieutenant of the Greyed",
  hp: 65,
  /** As a target: bigger than a mage. */
  radius: 7,
  height: 1.7,
  /** How much faster than an ordinary Frost mage she gets her casts, her novas and her blinks back. */
  hurry: 1.8,
  /** How much wider her novas are, and how much faster her bolts fly, than an ordinary Frost mage's. */
  nova: 1.6, bolt: 1.5,
  /** Experience for beating her (a mage is worth 50). */
  xp: 300,
} as const;

/** What she always leaves behind (GEAR.md, the Rimewake): the Rime Circlet. A hood: +1 life, and dash back 10% sooner. */
export const RIME_CIRCLET: KitPiece = ["hood", "rare", { dash: 10 }, "Rime Circlet"];

export const RIME_FIGHT = {
  /** How far in among the pillars (px from the middle) the hero has to come for the ice to shut him in, and how far in it then keeps him. */
  shutAt: 36, keepIn: 42,
  /** Below this share of her health, she's angry. */
  angry: 0.5,
  patch: {
    /** Seconds between rounds of frost patches: calm, angry. How many each round: calm, angry (one always under the hero). */
    every: [3.2, 2], count: [2, 4],
    /** How long each creeps over the ice before it freezes hard, and stays frozen after; how wide (px); how long it freezes him. */
    warn: 1.2, hold: 2.4, radius: 9, freeze: 1.2,
  },
  /** When she falls, the lake thaws in a ring round where she stood: from this far out to this far (tiles). */
  thaw: { inner: 2, outer: 3.6 },
  say: {
    shut: "Ice shoots up between the pillars! There's no way out.",
    rise: "Something hums under the ice. Rime rises out of it.",
    open: "The wall of ice cracks, and falls away in shards.",
    patch: "Frost creeps across the ice around you!",
    thaw: "The ice groans, and thaws in a ring round where she stood.",
  },
} as const;

/** As she falls. */
export const RIME_LAST_WORDS = [
  "(The grey goes out of Rime. The note she was humming breaks, and for a moment it's a song: an old one, about a river.)",
  "\"I'd forgotten the rest of it. Thank you. Tell Yssa I remember now.\"",
  "(She crumbles to grey stone. A breath of frost drifts up the valley.)",
] as const;

/** ...and then, across the top. */
export const RIME_FALLS = ["The Hollow goes quiet. The Frost mages stop humming."] as const;

/** The bow in the hunter's hut on the Hollow's rim (GEAR.md): the first bow worth using. */
export const HUNTERS_LONGBOW: KitPiece = ["bow", "magic", { damage: 1 }, "Hunter's Longbow"];
/** As he picks it up. */
export const HUT_FIND = "The hunter's longbow, left lying in his doorway. Still strung, after all this time.";

/** What Cinder leaves (GEAR.md, the Cinderward): a blade, 2 damage. */
export const CINDERS_BRAND: KitPiece = ["blade", "rare", { damage: 1 }, "Cinder's Brand"];

/**
 * What a hero on the straight path has on reaching Rime (GEAR.md, "Along the story path": about level 7, Cinder's
 * Brand or the Hunter's Longbow, two or three Cinderward or Rimewake pieces). Rime is the bow's fight, so the
 * longbow from the hut on the way down is in hand and Cinder's Brand in the bag; an Ember Cowl and Ashen Robe from
 * the Ashwild's mages, Icewalk Boots off a Frost mage on the way in, and the King's signet still round his neck.
 * Each piece's stats are its whole line in GEAR.md (the base's own stat plus its mods). Worn when you go straight
 * to her to playtest (src/debug.ts).
 */
export const RIME_READY = {
  level: 7,
  kit: [
    HUNTERS_LONGBOW,                                         // 2 damage, +1 on a full draw
    ["hood", "magic", {}, "Ember Cowl"],                     // +1 life
    ["robe", "magic", {}, "Ashen Robe"],                     // +2 life
    ["boots", "magic", { speed: 1, dash: 10 }, "Icewalk Boots"],   // +6% speed, +10% faster dash recovery
    ["amulet", "magic", { life: 1 }, "Signet of Aurenmark"], // +1 life
  ] satisfies readonly KitPiece[],
  bag: [CINDERS_BRAND] satisfies readonly KitPiece[],
} as const;
