# The Foreigner's Gear

Gear sets for the hero, one for each stretch of the story, so what he wears tells you how far he's come.
They're drafts, built on the game's item system as it is: six slots (hood, robe, boots, ring, amulet and a
weapon), four stats (damage, life, movement speed and faster dash recovery), three rarities, and the
colour tiers in `src/data/tiers.ts`. The story they follow is in [STORY.md](STORY.md); the hero is in
[HERO.md](HERO.md).

## How the sets work

- **Each set belongs to a place.** Its pieces drop, or are given, in one part of the story, so a player
  wearing a full set can tell where they've been.
- **Pieces are ordinary items with a name and a set.** Each piece rolls like a magic item of its kind (a
  hood still gives life, boots still give speed), plus its set's fixed stat.
- **Wearing more pieces adds bonuses**, at 2, 4 and (for the bigger sets) 5 or 6 pieces. Mixing two
  half-sets is a fine choice; nobody should be forced into one set.
- **Each set looks like itself on the hero.** Every piece shows on him, so a full set changes his whole
  silhouette and colours: grey-green for the Ranger, crimson and gold for the King, red, white or indigo
  for the three deep zones.
- **Numbers stay small.** The game counts in single hearts and single points of damage, so a set bonus of
  +1 damage is a big deal. The bonuses below are sized to match.

**Where the Greyed's gear comes from.** When a Greyed mage falls and crumbles to grey stone, what they wore
falls with them, and the colour comes back into it as the grey goes out. That's why their drops are red,
white and indigo, never grey: the Foreigner is wearing what the wardens wore before they faded.

Bonuses marked **(new)** need a small new effect in the game. Everything else uses the four stats that
already exist.

## 1. The Ranger's Spares

*Found under the stone by the Ranger's fire. The first five minutes.*

Wystan Fell's spare kit, left under the old stone when he camped in the Clearing. Patched, practical and
smelling of woodsmoke. This is the game's starter kit as it already is, given a story: the Rusty Blade,
Worn Hood, Worn Robe, Worn Boots, Old Fishing Pole and Old Short Bow are all his.

| Slot | Piece | Stats |
|---|---|---|
| Weapon | Wystan's Rusty Blade | 1 damage |
| Weapon | Wystan's Old Fishing Pole | Fishing |
| Weapon | Wystan's Old Short Bow | 1 damage (+1 on a full draw) |
| Helm | Wystan's Worn Hood | +1 life |
| Armour | Wystan's Worn Robe | +2 life |
| Boots | Wystan's Worn Boots | +5% speed |

**Set bonus.** 3 pieces: **Woodsmoke**, +10% faster dash recovery.

*Look:* normal tier, browns and leather. On the bare stone body it reads as "a kid in borrowed clothes".

## 2. The Ranger's Grey

*Kingsholm: Meg Fell's gift (a detour), and the Fells' old house.*

The rest of the Fells' trackers' kit. If the player delivers the Ranger's note to Meg as well as the King,
she gives him her husband's **grey cloak**, the one she hangs at the window every evening, and tells him
where the family's old gear is kept: a chest in the Fells' loft.

| Slot | Piece | Stats |
|---|---|---|
| Armour | Wystan's Grey Cloak | +2 life, +10% faster dash recovery |
| Helm | Tracker's Hood | +1 life |
| Boots | Fell Boots | +8% speed |
| Weapon | Aldwin's Longbow (the Ranger's father's bow) | 1 damage, +1 on a full draw |

**Set bonuses.**
- 2 pieces: **Light Feet**, +6% speed.
- 4 pieces: **Fell's Aim**, full-draw arrows deal +1 more damage.

*Look:* a new palette, forest grey-green with leather browns and no glow. The cloak is long enough to
flap when he dashes.

## 3. The King's Errand

*Kingsholm: the castle, after the King gives him the watchword.*

The kingdom equipping its quiet champion. The King can't be seen arming a stranger, so these come
sideways: the Prince's word at the Hammonds' forge, a surcoat "lost" from the castle storehouse, a ring
from the Leafwrights on credit, and the King's own signet round his neck.

| Slot | Piece | From | Stats |
|---|---|---|---|
| Weapon | Hammond Steel | The Hammonds' forge, on the Prince's word | 2 damage |
| Armour | Crimson Surcoat | The castle storehouse | +2 life |
| Amulet | Signet of Aurenmark | The King, with the watchword | +1 life |
| Ring | Leafwright's Band | The Leafwrights, on credit (a detour) | +6% speed |

**Set bonuses.**
- 2 pieces: **The King's Peace**, +1 life.
- 4 pieces: **Champion of Aurenmark**, +1 damage.

*Look:* the existing guard tier: deep crimson cloth, gold trim, gold metal. In the full set he looks like
a tiny royal guard, which the real guards find hilarious and a bit touching.

## 4. The Cinderward

*The Ashwild: Ember Greyed drops, and Cinder.*

What the Ember wardens wore when they were the Vael's bakers and forge-keepers, warm to the touch even
now.

| Slot | Piece | Stats |
|---|---|---|
| Weapon | Cinder's Brand (always drops from Cinder) | 2 damage |
| Helm | Ember Cowl | +1 life |
| Armour | Ashen Robe | +2 life |
| Boots | Emberstep Boots | +8% speed |
| Ring | Coal Ring | +1 damage |

**Set bonuses.**
- 2 pieces: **Warm Hands**, +1 damage.
- 4 pieces: **Sheepproof**, the Ember orb's sheep lasts half as long on him. **(new)**
- 5 pieces: **Kindling**, his hits sometimes set an enemy smouldering for a little extra damage. **(new)**

*Look:* the existing ember tier: red cloth, orange trim, a soft glow.

## 5. The Rimewake

*The Frozen Hollow: Frost Greyed drops, the hunter's hut, and Rime.*

The Frost wardens kept the Vael's songs and history, and their clothes are cut for standing still in the
cold for a very long time.

| Slot | Piece | Stats |
|---|---|---|
| Weapon | Hunter's Longbow (from the abandoned hut) | 2 damage, +1 on a full draw |
| Helm | Rime Circlet (always drops from Rime) | +1 life, +10% faster dash recovery |
| Armour | Snowfall Robe | +2 life |
| Boots | Icewalk Boots | +6% speed, +10% faster dash recovery |
| Amulet | Hoarfrost Pendant | +2 life |

**Set bonuses.**
- 2 pieces: **Hard Frost**, +2 life.
- 4 pieces: **Thaw**, frost slows and freezes him for half as long. **(new)**
- 5 pieces: **Rime Arrows**, full-draw arrows chill what they hit, slowing it for a moment. **(new)**

*Look:* the existing frost tier: white and ice-blue, cyan trim.

## 6. The Stormcaller

*The Thunder Rift: Storm Greyed drops on the climb to the great crack.*

The Storm wardens were the Vael's messengers, built for speed, and their gear still is.

| Slot | Piece | Stats |
|---|---|---|
| Weapon | Galeblade | 2 damage |
| Helm | Thunderhood | +1 life, +10% faster dash recovery |
| Armour | Stormweave Robe | +2 life, +6% speed |
| Boots | Galestep Boots | +10% speed |
| Ring | Spark Ring | +15% faster dash recovery |

**Set bonuses.**
- 2 pieces: **Tailwind**, +8% speed.
- 4 pieces: **Quickstep**, +20% faster dash recovery.
- 5 pieces: **Ael's Heartbeat**, critical hits come a little more often. **(new)**

*Look:* the existing storm tier: indigo cloth, gold trim, the strongest glow of the three.

## 7. The Heartstone

*Hidden: one piece in each zone, for players who explore. Not needed to finish.*

The rare set, and the reward for leaving the story path. Each piece is something of Ael's own, waiting in a
place only an explorer finds. Together they make the Foreigner look like what he is: a chip of the stone
nearest Ael's heart, with all three fires in it.

| Slot | Piece | Where it's hidden |
|---|---|---|
| Armour | Barkwrap of Ael (the wrap he woke in, grown thick and green) | Under the Ranger's stone, after the King's errand |
| Ring | Ring of Three Fires | A woodcutters' hut in the Ashwild |
| Amulet | Heartstone Pendant | In the big koi's belly, under the ice of the Frozen Hollow |
| Helm | Pebble Crown | Hidden niche in the Fells' loft in Kingsholm |
| Boots | Rootwalkers | A hollow tree on the climb in the Thunder Rift |
| Weapon | Ael's Thorn | On the bed of the Clearing's lake, where only a swimmer would look |

Every piece is rare (purple and gold) and has one each of life, damage or speed as well as its normal
stat.

**Set bonuses.**
- 2 pieces: **Stonehearted**, +1 life.
- 4 pieces: **Lantern Eyes**, +1 damage, and his eyes glow brighter.
- 6 pieces: **All Three Fires**, his hits sometimes burn, chill or spark, at random. **(new)**

*Look:* a new palette: warm stone grey and gold, with one red, one white and one indigo gem. With all
six, he looks like a small walking shrine.

## Along the story path

What a player heading straight through should be wearing, beside the levels in [STORY.md](STORY.md):

| Point | About level | Likely gear |
|---|---|---|
| At the King | 2 | The Ranger's Spares |
| Into the Ashwild | 2 to 3 | The Spares, Hammond Steel, the Signet of Aurenmark (and the Grey Cloak if they visited Meg) |
| At Cinder | 5 | Mixed: the King's Errand pieces, a Cinderward piece or two |
| At Rime | 7 | Cinder's Brand or the Hunter's Longbow, two or three Cinderward or Rimewake pieces |
| At Calder | 9 | A mix of the three deep-zone sets, usually two or three pieces of one of them |

Players who explore will have more, and some will turn up to Calder in the full Heartstone. That's
fine: the sets reward exploring without being needed to finish.

## A note on the starting bow

The game's starter kit already includes a bow, but [STORY.md](STORY.md) introduces the bow in the Frozen
Hollow, where the Frost mages make it necessary. Both can be true: the Old Short Bow from the start is weak
and easy to ignore, and the Hunter's Longbow in the Frozen Hollow is the first bow worth using. If you'd
rather the bow arrive only in the Hollow, take it out of the starter kit.

## What needs building

1. **Named items and sets**: a way to make a specific named piece (like Hammond Steel) instead of a random
   roll, and to mark which set it belongs to.
2. **Set bonuses**: count the worn pieces of each set and add the bonus stats. The ones using damage, life,
   speed and dash recovery work straight away.
3. **Two new palettes**: the Ranger's grey-green and the Heartstone's stone and gold. The crimson, red,
   white and indigo tiers already exist.
4. **Where pieces come from**: Cinder's and Rime's guaranteed drops, the zone drop tables, and the given
   pieces (the King, the Hammonds, Meg).
5. **The new effects**, last: shorter sheep and frost, smouldering, chilling arrows, more crits, and the
   Heartstone's three fires.
