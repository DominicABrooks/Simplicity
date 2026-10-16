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
  /** How close to the middle of her stage (px) the hero comes before she rises out of the ice. */
  wakeAt: 30,
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
    rise: "Something hums under the ice. Rime rises out of it.",
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

/**
 * What a hero on the straight path has on reaching Rime (STORY.md and GEAR.md): about level 7, the Hunter's Longbow,
 * and a Rimewake piece or two. Worn when you go straight to her to playtest (src/debug.ts).
 */
export const RIME_READY = {
  level: 7,
  kit: [
    HUNTERS_LONGBOW,
    ["hood", "normal", {}, "Worn Hood"],
    ["robe", "normal", {}, "Snowfall Robe"],
    ["boots", "magic", { speed: 1, dash: 10 }, "Icewalk Boots"],
    ["amulet", "magic", { life: 1 }, "Signet of Aurenmark"],
  ] satisfies readonly KitPiece[],
} as const;
