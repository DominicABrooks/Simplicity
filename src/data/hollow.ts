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
  hurry: 1.5,
  /** How much wider her novas are, and how much faster her bolts fly, than an ordinary Frost mage's. */
  nova: 1.3, bolt: 1.15,
  /** How much longer than an ordinary Frost mage's her novas take to charge (time to see it and get clear), and to come round again. */
  novaCharge: 2.2, novaCooldown: 1.6,
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
    every: [3.6, 2.6], count: [2, 3],
    /** How long each creeps over the ice before it freezes hard, and stays frozen after; how wide (px); how long it freezes him. */
    warn: 1.4, hold: 2, radius: 8, freeze: 0.9,
  },
  /**
   * Icicle volleys: every so often she stands still, draws the cold in round her (`wind` seconds to see it coming), and
   * throws icicles out across the ice in one of two patterns: rings (`waves` of them, each `count` icicles, each ring
   * turned half a gap from the last so the safe lanes move), or a spiral (`arms` streams turning as they fire, `shots`
   * each). Calm, angry. Icicles fly straight at `speed` (px/s), shatter on the wall, and a dash or a jump goes through them.
   * No new frost creeps while she's throwing one: one thing at a time, as with Cinder's walls of fire.
   */
  volley: {
    first: 5, every: [8, 6], wind: 1.1, speed: 30,
    rings: { waves: [2, 2], count: [6, 7], gap: 0.75 },
    spiral: { arms: [2, 2], shots: [5, 6], gap: 0.24, turn: 0.32 },
  },
  /**
   * The ice block: carve `melee` damage off her up close within about `window` seconds and she seals herself in ice
   * for `hold` seconds. Nothing hurts her in there, and the floor fills: frost patches, and icicles falling out of the
   * cold (marked on the ice `warn` seconds before they land, `radius` px across). Then she bursts out in a nova that
   * freezes anyone still up against her. Not again for `cooldown` seconds after.
   */
  block: {
    melee: 12, window: 4, hold: 5, cooldown: 18,
    patches: { every: 1.8, count: 2 },
    falls: { every: 0.8, count: 2, warn: 1.3, radius: 7, damage: 1, shatter: 0.5 },
    burst: { radius: 26, freeze: 1 },
  },
  /**
   * Her last stand: the first blow that would finish her doesn't. She keeps her health, blinks to the middle of the
   * ring and seals herself in ice for `hold` seconds, and icicles stream out of it: a spiral of `arms` streams
   * turning as they fire (and turning back the other way every `flip` seconds), with icicles falling all over the ice,
   * one of each `falls.count` on him (`rings.count` 0: no rings through it). Then she bursts out, and the next blow that would finish her does.
   */
  lastStand: {
    hold: 8, speed: 28,
    spiral: { arms: 2, gap: 0.45, turn: 0.3, flip: 4 },
    rings: { every: 3, count: 0 },
    falls: { every: 0.9, count: 3 },
  },
  /** When she falls, the lake thaws in a ring round where she stood: from this far out to this far (tiles). */
  thaw: { inner: 2, outer: 3.6 },
  say: {
    stand: "Rime won't fall! She blinks to the middle and seals herself in ice. Survive!",
    standOut: "The ice cracks open. Rime staggers out, spent. Finish it!",
    block: "Rime seals herself in ice! The cold comes down all round you.",
    burst: "The ice block bursts!",
    warded: "Ice!",
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
  "\"...out of the crack the Aurel runs, cold and young, down past the hill and home...\" (She stops.)",
  "\"I'd forgotten the rest of it. Thank you. Tell Yssa I remember now.\"",
  "(She crumbles to grey stone. A breath of frost drifts up the valley.)",
] as const;

/**
 * The way up out of the Hollow, north to the Thunder Rift (STORY.md, "0:42 Up to the Thunder Rift"): the frozen bed of
 * the river Aurel, which comes down out of the great crack (HISTORY.md), one tile wide between the trees from the
 * bowl's north rim to the edge of the map. Yssa waits at the foot of it, and like the woodwardens and her own track
 * she wants a word only the player can know: the river's name (src/game/yssa.ts). Rime sings it as she falls, the
 * hunter scratched it on his hut door, and the guards on the King's Bridge say it to everyone who crosses.
 */
export const CLIMB = {
  /** The column it runs up (tiles), and the row Yssa stands in, its first tile above the bowl; she steps aside into the notch west of it. */
  x: 13, post: 7,
  /** The word she waits for, any case. */
  word: "Aurel",
  /** What the bark asks for. */
  hint: "Write the river's name",
} as const;

export const CLIMB_TALK = {
  ask: [
    "(Yssa is waiting at the foot of a frozen stream, as if she'd always been there.)",
    "Up there is the Thunder Rift, and Calder. He was my best pupil once. I send nobody up to him who doesn't know what they're walking into.",
    "This was a river, before Rime sang it to sleep. It comes down out of the great crack, and runs all the way under the King's bridge. Write me its name, and I'll wake it.",
    "(She holds out a curl of birch bark and a stub of charcoal.)",
  ],
  right: [
    `(She reads the bark, and says it to the ice, softly, the way you'd wake a child.) "Aurel."`,
    "(Somewhere under the ice, water starts to run. The frozen stream cracks into steps.)",
    "Go on up. Mind the lightning: it comes out of a clear sky.",
  ],
  wrong: [
    `(She reads the bark.) "{written}." (The ice doesn't stir.)`,
    "That isn't its name. It runs under the King's own bridge, little one. Come back when you know it.",
  ],
  blank: ["(She turns the bare bark over, and back.) Nothing.", "Come back when you know its name."],
  kept: ["Keep it, then. Come back when you know its name."],
  through: ["The river's awake. Go on up, and go carefully."],
  /** Walking into her before she's read the river's name: one of these over her, and back you step. */
  stop: ["Not yet.", "Its name first.", "(The cold off her stops you dead.)", "What's the river called, little one?"],
} as const;

/** Scratched into the hunter's hut door: read by walking up to it. */
export const HUNTER_NOTE = {
  name: "Scratched in the door",
  lines: [
    "(Someone has scratched letters into the door with an arrowhead.)",
    "WHITE LADY KEEPS THE FROZE STREAM. WANTS THE RIVERS NAME. AUREL, SAME AS UNDER THE KINGS BRIDGE. WENT UP. LIGHTNING OUT OF A CLEAR SKY. NOT GOING BACK. BOW IS FOR WHOEVER. ROB",
  ],
} as const;

/** ...and then, across the top. */
export const RIME_FALLS = ["The Hollow goes quiet. The Frost mages stop humming."] as const;

/**
 * The Great Koi: the very large koi under the Hollow's ice. Hook it through the hole and out it comes, and it's no
 * fish to eat: it flops after you across the ice in great leaps (`hop` seconds in the air, at `speed` px/s), slamming
 * down on landing (anyone within `slam` px is hurt), and spits fans of freezing water. Angry below half health: it
 * leaps sooner and spits wider.
 */
export const GREAT_KOI = {
  name: "The Great Koi",
  title: "It's only a very large koi",
  hp: 55, xp: 250,
  /** As a target. */
  radius: 9, height: 1.1,
  hop: 0.55, speed: 62, every: [1.3, 0.85], slam: 15, damage: 1,
  /** Spitting: every this often (calm, angry), a beat to wind up, then a fan of `fan` frost bolts `spread` radians apart. */
  spit: { every: [4.5, 3.2], wind: 0.6, fan: [5, 7], spread: 0.28 },
  /** What it leaves: potions round it. */
  potions: 3,
  say: {
    bite: "Something massive takes the line!",
    out: "The ice bursts. It's only a very large koi... and it's angry.",
    landed: "The Great Koi lies still at last. Caught in its whiskers: a fishing pole.",
  },
} as const;

/** What the Great Koi leaves: the legendary pole, its line made from the koi's own whisker. */
export const WHISKER_ROD: KitPiece = ["rod", "legendary", {}, "Greatwhisker"];
/** Its line in the tooltip. */
export const WHISKER_NOTE = "Strung with the Great Koi's whisker. Golden koi 30%, silver 40%, and they bite twice as quick";

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
