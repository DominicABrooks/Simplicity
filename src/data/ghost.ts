// The Grey Ringer: the ghost of St Mary's churchyard, who only walks when the city talks about her.
//
// Ismay Tollen rang St Mary's bells for forty-one years, the curfew bell at nine every night of them. On
// the last night before the Edict of the Quiet Tongue (spring, 600 AF), she saw lights moving in the
// Witchwood from the bell loft: robed folk carrying fire, frost and lightning. She rang the great bell
// at midnight and shouted down to the sleeping city that the witches had come back. The Marshal's men
// went up the tower to quiet her. Nobody says what happened on the stair; Ismay came down it faster
// than they did. The Dean buried her that same night in the far corner of the churchyard, with no stone
// and no bell, so there would be nothing to talk about, and the next morning the Edict was read at the
// market cross. Since then it's been against the law to say what she saw.
//
// So people whisper it instead, and that is what keeps her. A ghost is made of what's said about her:
// every time the story goes round, she gets a little plainer. Hear it often enough and you'll see her
// too, among the graves after dark, grey as ash, ringing a handbell that no living hand is ringing,
// trying to wake a city that won't listen. Lay her to rest and the whispers die down for a while.

import type { KitPiece } from "./items.ts";

/** Her name over her head, as a target. */
export const GHOST_NAME = "The Grey Ringer";
/** Under her name on the boss bar. */
export const GHOST_TITLE = "Ghost of St Mary's";

/**
 * What a hero has when he first walks the city by night, round about meeting the King (STORY.md, GEAR.md):
 * about level 2, the Ranger's Spares with a few better finds from the road in their place (a keener blade,
 * a sturdier robe, quicker boots). Worn when you go straight to her to playtest (src/debug.ts). Her health
 * grows with his level, so she's a fair fight at any; this is about the one a player will have.
 */
export const RINGER_READY = {
  level: 2,
  kit: [
    ["blade", "magic", { crit: 2 }, "Keen Blade"],
    ["hood", "normal", {}, "Worn Hood"],
    ["robe", "magic", { life: 1 }, "Sturdy Robe"],
    ["boots", "magic", { dash: 15 }, "Boots of the Wind"],
  ] satisfies readonly KitPiece[],
} as const;

/**
 * Tuning. Distances in px, times in seconds, speeds in px/s. Damage is in hearts (the hero starts with 5).
 * Her health scales with the hero's level, like the mages'.
 */
export const GHOST = {
  hp: 26, hpPerLevel: 5, xp: 150,
  /** How close to the graves (px, around the churchyard) the hero must come at night for her to rise. */
  wake: 40,
  /** How far from her grave she'll follow you before drifting back to it, mending as she goes (hp/s). */
  leash: 150, mend: 3,
  /** Rising out of the ground: she can't be hurt until she's up. */
  rise: 2.2,
  /** Drifting after you, through walls and gravestones alike; faster once she's wailing. */
  speed: 15, angrySpeed: 22, returnSpeed: 34,
  /** Touching her chills you to the bone: 1 heart. */
  touch: 1,
  /** Seconds between attacks. */
  every: [1.8, 2.8] as const, angryEvery: [1.2, 2] as const,
  /** The toll: she raises her bell and rings it; the sound breaks over everything near her. Dash or jump through it. */
  toll: { charge: 1.1, angryCharge: 0.8, radius: 38, damage: 2, near: 46 },
  /** The wail: a fan of wisps that drift after you. */
  wail: { charge: 0.75, count: 3, angryCount: 5, spread: 0.32 },
  /** Below this share of her health she wails in anger: faster, more wisps, and she fades and comes back behind you. */
  angry: 0.5,
  /** Fading: gone (and untouchable) this long, then back this far from you, already tolling. */
  fade: { gone: 1.3, behind: 22, chance: 0.35 },
  /** What laying her to rest is worth: from her grave goods, Hollow Bite and another rare thing or two; and a potion or two. */
  reward: { items: 1, potions: 2 },
  /** Townsfolk within this far (px) of her when she's out run for it, this many times their walking pace. */
  scare: 170, run: 2.4,
  /** Hit ring and height (world units), as a target. */
  radius: 6, height: 1.7,
} as const;

/**
 * The chance she rises on a night you walk into the churchyard, after hearing about her `heard` times:
 * never if you've heard nothing, a little more each time you hear it, almost certain once the whole city's told you.
 */
export const ghostChance = (heard: number): number => (heard <= 0 ? 0 : Math.min(0.95, 0.15 + 0.2 * (heard - 1)));

/** Her health against a hero of this level. */
export const ghostHp = (level: number): number => GHOST.hp + GHOST.hpPerLevel * (level - 1);

/**
 * The rumour, as the townsfolk pass it on (each one after a lead-in such as "You didn't hear it from me, but..."):
 * every one of these the hero hears makes her more likely to rise.
 */
export const GHOST_RUMOURS: readonly string[] = [
  "There's a grey woman in St Mary's churchyard after dark, ringing a bell nobody's ringing. Old Ismay, the bell-ringer",
  "Don't cut through the churchyard after the curfew bell. Ismay Tollen walks there, and the more folk talk about her, the plainer she gets",
  "Ismay rang the great bell the night before the Edict, shouting about lights in the wood. They say she's still ringing it",
  "My cousin saw her among the graves, grey as ash, with her little bell. Ran all the way home without his boots",
  "They buried the bell-ringer by night, no stone, no prayers, so there'd be nothing to talk about. Now she won't stay down",
  "If you hear a bell at night and St Mary's is dark, run. That's Ismay",
  "The sexton won't go near the east end of the churchyard at night. There's no stone there, but there's someone under it",
  "Every time someone says her name, the bell-ringer comes a step closer. So I'm not saying it. Ismay. Oh, no",
];

/** Did this line pass on the ghost's rumour? */
export const isGhostRumour = (line: string): boolean => GHOST_RUMOURS.some(r => line.includes(r));

/** What's said as she comes and goes (toasts), and what the frightened townsfolk shout as they run. */
export const GHOST_SAYS = {
  quiet: "The churchyard is still tonight.",
  rise: "A bell tolls among the graves... The Grey Ringer rises!",
  angry: "The Grey Ringer wails!",
  dawn: "At first light, the Grey Ringer fades into the grass.",
  laid: "The bell falls silent. Ismay Tollen is at rest.",
  scream: ["Aaah!", "It's her!", "Ismay!", "Run!", "The bell!", "Help!", "Not me!"],
} as const;

/**
 * The bell come home. Ismay's little handbell went off St Mary's bridge with the Marshal's men the night she
 * died, and still rings the curfew at nine from wherever it is. Fish it up and carry it into her churchyard
 * after dark, and she rises whether the city's talking about her or not: not to fight, but to have it back.
 * She rings nine one last time and lies down for good, and leaves the hero her grave goods for his trouble.
 */
export const BELL_HOME = {
  /** Her name, once she's calm enough to have one. */
  name: "Ismay Tollen",
  /** As she wakes for it (toast); if she was already up and fighting, she hears it and lowers her own bell. */
  wake: "The little bell in your bag rings by itself. Under the grass, something answers.",
  hush: "The Grey Ringer stops. She's heard the little bell in your bag.",
  /** How near she comes before she speaks (px), and how fast (px/s). */
  near: 14, speed: 18,
  /** What she says (the dialogue box). */
  lines: [
    "...That's my bell. That's my bell!",
    "Forty-one years I rang the curfew with that, and they put me under without it, so there'd be nothing left of me to ring.",
    "The river had it? Of course it did. The Marshal's men threw it off the bridge after me. I heard it go in.",
    "You came out of the wood, didn't you, little stone? Then you've seen the lights. I wasn't mad. I wasn't wrong.",
    "Stand back, now. It's nine o'clock somewhere. Let me ring it one last time.",
  ],
  /** How long she rings before she goes (s), and what's said as she does. */
  ring: 2.4,
  rest: "Ismay Tollen rings the curfew, and the churchyard is quiet. Quiet for good, this time.",
} as const;

/** The best of her grave goods, left whenever she's laid to rest (beaten, or the bell brought home): a legendary blade. */
export const HOLLOW_BITE: KitPiece = ["blade", "legendary", { crit: 6, life: 2, dash: 15 }, "Hollow Bite"];
