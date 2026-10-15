// Old Gil and his glass eye, and the letter in the bottle (see docs/CURIOSITIES.md and src/game/quay.ts).
//
// Gil Harrow has rowed folk across under the King's Bridge for forty years, since before it was gilded. The night
// of the fog he leaned out over the side to see what was glowing down in the water, and his glass eye dropped
// out and went in after it. He's worn a patch since, and sworn the river took it on purpose. It had: an eye that's
// been in the river sees what the river's seen, and the river carries everything down out of the Witchwood.
import type { CurioId, ItemType, Stats } from "./items.ts";

export const GIL = {
  name: "Old Gil",
  /** Where he sits on the south bank, west of the bridge's foot (tiles), looking out over his boat. */
  x: 7.5, y: 37.6,
  /** His fisherman's clothes (see Dress in src/world/wardrobe.ts). */
  dress: {
    garment: "smock", pattern: "plain", cloth: "#6b4f3a", second: "#8a6a4a", trim: "#3a2a1e", over: "vest", head: "cap",
    hair: "#d8d2c8", longHair: false, hose: "#5d4a3a", feather: false, pouch: true, brooch: false, shoes: "#2e2218", carry: "none",
  },
} as const;

export const GIL_TALK = {
  /** His eye still in the river. */
  without: [
    "Don't mind the patch. Lost the eye the night of the fog, leaning over to see what was glowing down in the water.",
    "Glass, it was. Good glass. The river took it on purpose, I'll swear to that. Wanted to see something, I reckon.",
  ],
  /** He sees it in the hero's bag. */
  given: [
    "Wait. Wait, what's that you've got? ...That's my eye! You fished up my eye!",
    "Hold still while I... there. Oh. Oh, that's cold. Ohh, it's seen things, down there.",
    "The river carries everything down out of the Witchwood, you know. And it's shown me where it all went.",
    "There's a thorn of grey wood on the bed of the lake in the Clearing. Sharp as a blade, and it isn't any tree's.",
    "Swim out to the middle and look down. Go on. Only a swimmer would ever find it. That's why it's still there.",
  ],
  /** After. */
  after: [
    "Still seeing double some mornings. One of me's looking at the river and the other's under it.",
    "The lake in the Clearing, little one. Swim out to the middle. Did you go yet?",
  ],
} as const;

/** What lies on the lake bed, once Gil's told him: Ael's Thorn, a rare blade of grey wood (GEAR.md, the Heartstone). */
export const THORN = { type: "blade" as ItemType, name: "Ael's Thorn", mods: { damage: 2, life: 1, speed: 6 } satisfies Stats } as const;
export const THORN_SAYS = "Something glints on the lake bed, far out in the middle. Gil was right.";

/** The letter in the bottle, in the hero's own blocky hand, from a run he doesn't remember. */
export const LETTER = {
  name: "A letter in your own hand",
  /** It opens: */
  open: "You've done this before. You won't remember. I didn't. So I'm writing it down, and putting it back in the river.",
  /** One line for each curiosity he hasn't yet taken where it belongs this run. */
  hints: {
    stone: "The warm stone wants to go home. There's a ring of them under St Mary's, with a gap.",
    key: "The rusted key is for the low door at the foot of St Mary's tower, by the churchyard.",
    eye: "The glass eye is Old Gil's. He sits by his boat at the foot of the King's Bridge.",
    bell: "The little bell is Ismay's. Take it to her in the churchyard, after dark. She won't hurt you.",
  } satisfies Record<Exclude<CurioId, "bottle">, string>,
  /** If they're all done already. */
  none: "You've found everything else already. Of course you have. You always do, eventually.",
  /** And it ends: */
  close: "The sky over the Rift is clear. Don't trust it. And when it's over, take the King's offer of a bed. -- You",
  /** Opened from the bag. */
  later: "You break the seal and shake the letter out of the bottle.",
} as const;
