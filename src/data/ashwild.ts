// The Ashwild: the first of the deep woods past the King's woodwardens (see STORY.md), where the trees have
// gone ash-grey, cold cracks run through the ground, the Ember mages hunt, and Cinder waits at the Greyed's
// camp. Here: the woodwardens and what they say, Cinder, and Yssa on the track west to the Frozen Hollow.

import type { KitPiece } from "./items.ts";
import { WATCHWORD } from "./king.ts";

/** The King's woodwardens at the barricade across the trail south: friendly, firm. */
export const WOODWARDEN = { name: "Woodwarden" } as const;

/**
 * What they say. Before he's given them the watchword: asking for it, and handing him a scrap of paper and a stub of
 * crayon to write it on (src/game/watchword.ts). Then, reading it: right, wrong ({written}: what he wrote), blank, or
 * the paper not handed back at all. And once he's through, that's that.
 */
export const WARDEN_TALK = {
  ask: [
    "Halt, little one. King's orders: nobody goes deeper into the Witchwood without the King's watchword. Not woodcutters, not hunters, not you.",
    "There's things in there now. Robed things. If you've business with the King, the cave's north, up the path. He's in Kingsholm, over the river.",
    "Can't talk? Half the woodcutters can't either. Here: paper, and a crayon. Write it down.",
  ],
  right: [
    `(The warden squints at your crayon letters.) "${WATCHWORD}." That's the one. Is it, though.`,
    "Through you go, then. Mind yourself in there. The trees aren't the right colour any more.",
  ],
  wrong: [
    '(The warden squints at your crayon letters.) "{written}"? That\'s not it.',
    "No watchword, no way through. Back you go, little one.",
  ],
  blank: ["A blank page. Very funny.", "No watchword, no way through."],
  kept: ["Keep it, then. But you're not getting past without the watchword."],
  through: ["Go on through, then. Mind yourself in there."],
  /** Walking up to the gate before he's given them the watchword: one of these, over a warden, and back you step. */
  stop: ["No further! King's orders.", "Watchword? No? Then no.", "Back you go, little one.", "Nobody goes deeper. Nobody."],
} as const;

/** Cinder, the Ember lieutenant: an Ember mage, but far tougher, quicker to cast and quicker to blink. */
export const CINDER = {
  name: "Cinder",
  /** Under his name on the boss bar. */
  title: "Ember Lieutenant of the Greyed",
  hp: 45,
  /** As a target: bigger than a mage. */
  radius: 7,
  height: 1.7,
  /** How much faster than an ordinary Ember mage he gets his casts, his sheep orbs and his blinks back. */
  hurry: 2.2,
  /** Experience for beating him (a mage is worth 50). */
  xp: 200,
} as const;

/**
 * Cinder's fight, in his arena (src/game/cinderfight.ts). Step in among the stones and fire leaps up between
 * them, and Cinder steps out of it: there's no way out until one of you falls. Then the ground erupts under you, a few spots at a time
 * (each marked a moment before it goes up, then burning a while after: dash or jump clear), and every so
 * often a wall of fire sweeps across the circle from one side to the other (jump it, or dash through).
 * Below half health he's angry, and all of it comes faster. Distances in game px, times in seconds.
 */
export const CINDER_FIGHT = {
  /** How far in from the stones (px from the middle) the hero has to come for the fire to shut him in, and how far in it then keeps him. */
  shutAt: 40, keepIn: 45,
  /** Below this share of his health, he's angry. */
  angry: 0.5,
  flare: {
    /** Seconds between rounds of eruptions: calm, angry. How many each round: calm, angry (one always under the hero). */
    every: [2.8, 1.8], count: [2, 4],
    /** How long each is marked on the ground before it goes up, and burns after; how wide; how much it hurts. */
    warn: 1.1, burn: 1.6, radius: 8, damage: 1,
  },
  beam: {
    /** Seconds before the first sweep, and between them: calm, angry. */
    first: 4, every: [8, 5],
    /** How long it smoulders at its edge first, how long it takes to cross, how thick (px either side), how much it hurts. */
    warn: 1.1, sweep: 2.6, width: 3.5, damage: 2,
  },
  /**
   * The inferno: the first time he's down to `at` of his health, he steps out through the fire and stands among the
   * stones, out of reach (warded: `warded` is what a blow on him says), and for `last` seconds the circle is a furnace.
   * He paces round outside it (`orbit` px out past the fire, `pace` radians a second). Spokes of fire flare up from the
   * middle (`warn` seconds smouldering first) and turn like a wheel (`turn` radians a second), `spokes` of them, more
   * after `more` seconds, and halfway through the wheel stops and turns the other way; they're `width` px thick and
   * hurt `damage`, and a jump or a dash clears them. And every `every` seconds he throws a fan of fire from where he
   * stands, `count` bolts `spread` radians wide at `speed` px/s, lasting `life` s; the standing stones stop them. At the
   * end he bursts back into the middle, throwing a ring of `burst` bolts out round him.
   */
  inferno: {
    at: 0.25, last: 16, warded: "Out of reach!", orbit: 10, pace: 0.35,
    wheel: { spokes: [2, 3], more: 8, warn: 1.4, turn: 0.75, width: 3.5, damage: 1 },
    fan: { first: 2.2, every: 1.5, count: 5, spread: 0.6, speed: 38, life: 5 },
    burst: { count: 14, speed: 42 },
  },
  say: {
    shut: "Fire leaps up between the stones! There's no way out.",
    inferno: "Cinder steps out through the fire! The circle becomes a furnace!",
    back: "Cinder bursts back into the circle!",
    rise: "Cinder steps out of the flames.",
    beam: "Cinder sweeps a wall of fire across the circle!",
    open: "The fire between the stones gutters out.",
  },
} as const;

/**
 * What a hero on the straight path has on reaching Cinder (the tables in STORY.md and GEAR.md): about level 5,
 * the King's Errand pieces (Hammond Steel, the Signet of Aurenmark) and a Cinderward piece or two. Worn when
 * you go straight to him to playtest (src/debug.ts), so the fight is the one a player will have.
 */
export const CINDER_READY = {
  level: 5,
  kit: [
    ["blade", "magic", { damage: 1 }, "Hammond Steel"],
    ["hood", "normal", {}, "Worn Hood"],
    ["robe", "magic", { life: 1 }, "Sturdy Robe"],
    ["boots", "magic", { speed: 6 }, "Boots of Haste"],
    ["amulet", "magic", { life: 1 }, "Signet of Aurenmark"],
  ] satisfies readonly KitPiece[],
} as const;

/**
 * Yssa of the Frost (HERO.md), on the narrow track west out of the Ashwild, down to the Frozen Hollow. She doesn't fight;
 * she lets nobody by who doesn't know her name, and the woodcutters only ever called her the white lady. The hero can't
 * talk, so she hands him a curl of birch bark and a stub of charcoal: the player writes it (src/game/yssa.ts). Two
 * places tell it: Cinder, as the grey goes out of him (CINDER_FALLS), and a carving on the woodcutters' hut door
 * (HUT_CARVING). A player who knows it already can walk straight past the camp.
 */
export const YSSA = {
  /** What her target shows: what the woodcutters called her. */
  name: "The White Lady",
  /** The word she waits for, any case. */
  word: "Yssa",
  /** What the bark asks for. */
  hint: "Write her name",
} as const;

/**
 * The track west (tiles): one tile wide along `row`, from the cracked glade out to the west edge. She stands in it at
 * `post`, and once she's read her name steps aside into the notch north of it.
 */
export const YSSA_TRACK = { row: 29, post: 11 } as const;

export const YSSA_TALK = {
  ask: [
    "(A tall woman in frost-white robes stands in the track. The cold comes off her the way light comes off a lamp.)",
    "You aren't one of them. Good. Down this track the wood turns to winter, and the Greyed walk on the ice.",
    "We're Vael, they and I: the old orders of the south, Ember, Frost and Storm. They were my wardens once, sent north to hold the cracks under this wood shut. They held them too long. Every spell opens the window in your face a little wider, and something looked in through theirs, and stayed.",
    "When you beat one, the grey goes out of them, and what's left of them goes home. It's the kindest thing anyone can do for them now. It can't see you, little one. Use that.",
    "I let nobody by who doesn't know me. Not what the woodcutters call me. My name.",
    "(She holds out a curl of birch bark and a stub of charcoal.)",
  ],
  right: [
    '(She reads the bark, and something in her face thaws.) "Yssa." Six hundred years since anyone wrote it.',
    "Who told you? No. I can guess. Go on, then. Mind the ice.",
  ],
  wrong: [
    '(She reads the bark.) "{written}." (She lets it fall. It frosts over before it lands.)',
    "That isn't my name. Come back when you know me.",
  ],
  blank: ["(She turns the bare bark over, and back.) Nothing.", "Come back when you know me."],
  kept: ["Keep it, then. Come back when you know me."],
  through: ["The track is open to you. Go carefully. The Hollow is colder than it looks."],
  /** Walking into her before she's read her name: one of these over her, and back you step. */
  stop: ["Not yet.", "Do you know me?", "(The cold off her stops you dead.)", "Who am I, little one?"],
} as const;

/** Cut into the woodcutters' hut door: read by walking up to it. */
export const HUT_CARVING = {
  name: "Carved in the door",
  lines: [
    "(Someone has cut letters into the door with a knife, deep and in a hurry.)",
    "IF THE WHITE LADY STOPS YOU ON THE WEST TRACK DONT RUN. GIVE HER HER NAME. SHES YSSA. MOTHER KNEW HER. WAT",
  ],
} as const;

/** When Cinder falls: his last words, in the dialogue box (a toast shows only one line at a time, and this is the one that matters)... */
export const CINDER_LAST_WORDS = [
  `(As the grey goes out of him, Cinder looks up, and knows you.) "Tell the white lady... tell ${YSSA.word}... I'm sorry."`,
  "(He crumbles to grey stone. A spark flies south.)",
] as const;

/** His spirit, in the middle of his arena once he's fallen (src/game/spirits.ts): Yssa's name again, for anyone who missed it. */
export const CINDER_SPIRIT = {
  name: "Cinder's Spirit",
  lines: [
    "(Cinder's spirit flickers over the cold stones: warm now, the grey all gone out of it.)",
    `The white lady on the west track. Her name is ${YSSA.word}. Tell her I'm sorry.`,
  ],
} as const;

/** ...and then, across the top. */
export const CINDER_FALLS = ["Somewhere in Kingsholm, a sheep sneezes."] as const;
