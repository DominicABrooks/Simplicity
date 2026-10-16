// The Ashwild: the first of the deep woods past the King's woodwardens (see STORY.md), where the trees have
// gone ash-grey, cold cracks run through the ground, the Ember mages hunt, and Cinder waits at the Greyed's
// camp. Here: the woodwardens and what they say, and Cinder.

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
    `(The warden squints at your crayon letters.) "${WATCHWORD}." That's the one. Well.`,
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

/** When Cinder falls. */
export const CINDER_FALLS = [
  "Cinder crumbles to grey stone. A spark flies south.",
  "Somewhere in Kingsholm, a sheep sneezes.",
] as const;
