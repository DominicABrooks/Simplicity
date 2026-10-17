// The woodcutters' strongbox (src/game/lockbox.ts): in the Coppins' hut in the Ashwild (src/areas/cutterhut.ts), an
// iron-bound box with four brass number wheels on its front, left behind the night the woods went grey. Set the wheels
// to Abel Coppin's number and it opens on his good boots, the ones he kept for best. Three ways to the number: ask Abel
// himself, in Kingsholm, where he stands about the Wallside lanes; stand in the fairy ring after dark and the fair folk
// tell it first, before anything else they say; or the letter in the bottle may have it, if it's the one secret left
// that it chooses to tell.
import type { Dress } from "../world/wardrobe.ts";
import type { ItemType, Mods, Rarity } from "./items.ts";

/** The strongbox, and where it stands in the hut (tiles, the middle of it): against the back wall, in the middle. */
export const LOCKBOX = {
  code: "4917",
  name: "Iron strongbox",
  at: { x: 4.5, y: 1.15 },
  /** How near (px) he must be to try its wheels. */
  reach: 14,
} as const;

/** What's said about it: as he tries it, and as it answers. */
export const LOCKBOX_SAYS = {
  /** Over the wheels, as the player sets them. */
  ask: "Set the four wheels",
  label: "The strongbox's number",
  try: "Try it",
  /** The first time he's in the hut each run. */
  seen: "An iron-bound strongbox sits against the back wall, four brass number wheels set in its front.",
  wrong: "The wheels click round to {code}. The lid doesn't move.",
  opens: "The wheels click round to the last number, and the lid lifts. Inside: a pair of good boots, never worn.",
  empty: "The strongbox stands open and empty.",
  far: "Too far away to reach it",
} as const;

/** What's in it: Abel Coppin's good boots, kept locked up for best, light as ash. Legendary. */
export const ASHWALKERS = {
  type: "boots" as ItemType, rarity: "legendary" as Rarity, name: "Ashwalkers",
  mods: { speed: 12, dash: 20, life: 2 } satisfies Mods,
  note: "Abel Coppin's good boots, kept locked up for best. They've never touched the ash",
} as const;

/**
 * Abel Coppin, the woodcutter, come up out of the Ashwild with his family the night the woods went grey: where he stands
 * in Kingsholm by day (tiles, the middle of where he stands), in the Wallside lane a few doors from the Fells', looking up
 * and down it with nothing to do; the house he lodges in, two doors down from the Fells' (its top-left tile), which he
 * comes out of in the morning and goes back into at bedtime, as the townsfolk do; how fast he walks (px/s); and how he's dressed: a woodcutter's smock and leather jerkin, a felt hat, a sack over his
 * shoulder with what they carried out.
 */
export const ABEL = {
  name: "Abel Coppin",
  area: "capital",
  x: 29.9, y: 59.5,
  home: [28, 52] as const,
  speed: 14,
  dress: {
    garment: "smock", pattern: "plain", cloth: "#5e6b3a", second: "#7a8450", trim: "#3a2a1e", over: "vest", head: "felt",
    hair: "#5a3a22", longHair: false, hose: "#4a3e30", feather: false, pouch: true, brooch: false, shoes: "#2e2218", carry: "sack",
  } satisfies Dress,
} as const;

/**
 * What Abel Coppin says (src/game/lockbox.ts, abelLines): the woodcutter, come up out of the Ashwild with his family the
 * night the woods went grey. All of it the first time, the number among it; after, a line at a time, the number never far
 * off; and once the box is open, that he's glad.
 */
export const ABEL_TALK = {
  first: [
    "(A big man with sawdust in his beard.) You've come up the old trail. We were woodcutters down there, in the first glade.",
    `We ran the night the trees went grey. My strongbox is still in the hut, my good boots in it. The number's ${LOCKBOX.code.split("").join("-")}.`,
    "Take them. Somebody ought to walk in them.",
  ],
  again: [
    `${LOCKBOX.code.split("").join("-")}. The box against the back wall.`,
    "Mind the cracks in the second glade. They're cold.",
    "Wat still won't put that knife down.",
  ],
  opened: ["You found them. Good. Walk somewhere green in them."],
} as const;

/** What the fair folk say first, before anything else, while the box is still shut (src/game/fairyring.ts). */
export const LOCKBOX_FEY = `The woodcutter's box in the grey wood counts to four: ${LOCKBOX.code.split("").join(", ")}. He has forgotten it is still his.`;

/** The letter in the bottle's line for it, if that's the secret it chooses (src/game/quay.ts). */
export const LOCKBOX_LETTER = `The strongbox in the woodcutters' hut, the first glade in the Ashwild: ${LOCKBOX.code}. The boots in it are the best thing you'll ever wear.`;
