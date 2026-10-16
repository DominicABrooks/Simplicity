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
  /** What it leaves him: a pendant with a chip of the ring in it, warm to the touch. Legendary: worn, it holds him up
   *  once when he'd fall, and an old stone warms it again (src/game/pendant.ts). Its note says as much, quietly. */
  reward: {
    type: "amulet" as ItemType, rarity: "legendary" as Rarity, name: "Ringstone Pendant", mods: { life: 3, damage: 2, speed: 10 } satisfies Stats,
    note: "A chip of the ring under St Mary's, warm against your chest. It held the crack shut; it won't let you fall. Not twice, till an old stone warms it.",
  },
} as const;

export const UNDERCROFT_SAYS = {
  /** At the door, without the key, and with it. */
  locked: "A low door, iron-banded, locked fast. The lock is old and rusted.",
  unlock: "The Rusted Key turns with a shriek of old iron. The low door swings in on steps going down.",
  /** The first time down. */
  arrive: "Under St Mary's: the church's dead, and something older.",
  /** Near the socket with the stone in the bag. */
  warm: "The stone in your bag is warm. It knows where it is.",
  /** Up by the little door in the wall behind the ring (HISTORY.md: the Vael's lock on somebody else's door). */
  seal: [
    "A little door in the wall behind the ring, sealed and sealed again: iron bands, lead seals stamped with the Kellets' mark.",
    "Older than the seals, cut into the stone: three flames, a snowflake and a lightning bolt. The top band has snapped. Cold air comes under it.",
  ],
  /** The sealed door, once the ring's whole again: said with the first of `seal` if he's not been up to it yet. */
  sealCalm: "The three fires on the little door burn steady now the ring is whole, and no cold comes under it.",
  /** The pendant, worn: holding him up when he'd fall, and warm again at an old stone. */
  catch: "The Ringstone Pendant flares hot against your chest. You don't fall.",
  rewarm: "The Ringstone Pendant is warm again.",
  /** Setting it back: what the ring was (HISTORY.md, "The Seal" and "88 AF"), and what it is to him now. */
  wake: [
    "The stone slides home into the socket, as if it had never left.",
    "One by one, the old stones wake, and in their warmth you know this place: the Vael's temple floor. Under it the Old Mother laid her three eggs, one for each fire.",
    "Aldric stole them, and Hereward gilded them for his treasury. Ever since, the ring has held the crack under the hill as shut as it could, alone.",
    "The warmth goes right through you. The ring knows you now: fall, and Ael will wake you here.",
  ],
} as const;
