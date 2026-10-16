// The Undercroft under St Mary's, and the ring of old stones on its floor (see docs/CURIOSITIES.md and
// src/game/undercroft.ts): what's said there, and what the ring leaves the hero when the Mysterious Stone goes home.
//
// St Mary's was built in 88 AF on the floor of a temple older than the city, and Hereward's masons broke up what
// was standing there to make its footings. All but one ring of stones, which the sexton's grandfather's
// grandfather locked away under the church, so nobody would ask what it was. One stone was gone even then. It
// turned up in the river, the way things do in this city, on the end of a little stone child's fishing line.
import type { ItemType, Rarity, Stats } from "./items.ts";

export const UNDERCROFT = {
  /** How near the socket (px) he must bring the stone for it to go home, and when he first feels it warm. */
  reach: 12, hint: 40,
  /** How near the sealed door (px, from the spot just in front of it) he must come to be told of it. */
  seal: 22,
  /** Once woken, an old stone (src/game/stones.ts): its name, and how near the socket (px) he comes to touch it again. */
  stone: { name: "The ring under St Mary's", touch: 20 },
  /** The ring's waking, as a ring of light going out over the room (px). */
  wake: 60,
  /** What it leaves him: a pendant with a chip of the ring in it. Legendary: worn, it drinks from the old stones, and
   *  burning it opens the little door behind the ring (src/game/pendant.ts). Its note says as much, quietly. */
  reward: { type: "amulet" as ItemType, rarity: "legendary" as Rarity, name: "Ringstone Pendant", mods: { life: 3, damage: 2, speed: 10 } satisfies Stats },
  /** How long (s) the little door takes to swing open, while he's kept out of it. */
  swing: 1.6,
} as const;

/** The pendant's charge: how many old stones it drinks from (the Ranger's, the fountain, ash, hollow and rift stones),
 *  and its note as it fills. */
export const PENDANT = {
  stones: 5,
  note: (n: number): string => n >= 5
    ? "A chip of the ring under St Mary's, burning now with all five of Ael's old stones in it. Three fires carved on a little door would know it."
    : "A chip of the ring under St Mary's, cool where the old stones are warm. They're all one stone underneath; it wants to drink from each of them."
      + (n > 0 ? ` It's drunk from ${n} of the five.` : ""),
} as const;

/**
 * Behind the little door, the Vael's lock (HISTORY.md, "What the chronicle doesn't say"): the deep places, where the
 * Old Mother laid the eggs right on the crack to hold it shut (src/areas/sealchamber.ts). With the eggs gone, only the
 * Vael's stitches across it hold the somebody else's door under it, and they're coming loose; the burning pendant,
 * Ael's warmth, pulls them tight again (src/game/sealchamber.ts).
 */
export const CHAMBER = {
  /** The nest's middle (tiles, in src/areas/sealchamber.ts's room). */
  nest: { x: 5, y: 3.8 },
  /** How near the nest (px) he comes to read it, and what's left by it, once a run. How near the crack's middle to reach the stitches. */
  near: 18, crack: 10,
  gift: { type: "hood" as ItemType, rarity: "legendary" as Rarity, name: "Warden's Wrap", mods: { life: 4, speed: 8, dash: 25 } satisfies Stats,
    note: "A Vael warden's wrap, dropped by the empty nest not long ago. One of the wardens sent north to hold the cracks came down here too. It smells of snow." },
} as const;

/** What's said in the deep places: only what can't be seen there (the picture shows the rest). */
export const CHAMBER_SAYS = {
  /** At the crack without the pendant on: a hint. */
  unworn: "The stitches want holding shut. Something of Ael's, worn, would know how.",
  /** At the nest: what it was for, and what that means now. */
  nest: [
    "The eggs lay here, right on the crack, to hold it shut.",
    "Now they're a floor or two above you, six hundred years warm in St Mary's treasury, over this same crack. When they hatch there, the seal hatches with them.",
  ],
} as const;

export const UNDERCROFT_SAYS = {
  /** At the door, without the key, and with it. */
  locked: "A low door, iron-banded, locked fast. The lock is old and rusted.",
  unlock: "The Rusted Key turns with a shriek of old iron. The low door swings in on steps going down.",
  /** The first time down. */
  arrive: "Under St Mary's: the church's dead, and something older.",
  /** Near the socket with the stone in the bag. */
  warm: "The stone in your bag is warm. It knows where it is.",
  /** Up by the little door behind the ring (HISTORY.md: the Vael's lock on somebody else's door): what can't be seen. */
  seal: "The Kellets reseal this door every spring, and every spring it's come unlocked again.",
  /** The pendant, worn: drinking from an old stone, and full. */
  drinks: (stone: string, n: number): string => `The Ringstone Pendant drinks from ${stone[0]!.toLowerCase()}${stone.slice(1)}. (${n} of 5)`,
  charged: "The Ringstone Pendant burns with all five of Ael's stones. Under St Mary's, three carved fires would know it.",
  /** At the little door, without the pendant burning. */
  sealShut: "It won't move.",
  /** Setting it back: what the ring was (HISTORY.md, "The Seal" and "88 AF"), and what it is to him now. */
  wake: [
    "In the ring's warmth you know this place: the Vael's temple floor. Under it the Old Mother laid her three eggs, one for each fire.",
    "Aldric stole them, and Hereward gilded them for his treasury. Ever since, the ring has held the crack under the hill as shut as it could.",
    "The ring knows you now: fall, and Ael will wake you here.",
  ],
} as const;
