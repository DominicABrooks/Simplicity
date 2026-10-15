# The Story, Minute by Minute

The playable hour, from waking on the stone to the credits: every story beat, where it happens, what the
player does there, what it teaches, and how long it should take. The lore behind it is in
[HERO.md](HERO.md) (the Foreigner, the Greyed and the ending), [LORE.md](LORE.md),
[HISTORY.md](HISTORY.md) and [FAMILIES.md](FAMILIES.md).

**The hour is the story path:** a player who goes straight from beat to beat, fighting only what's in
their way, reaches the credits in about 60 minutes. Exploring, fishing, loot-hunting and the city's
people come on top, as much as anyone likes.

## The story in one breath

You wake in the Witchwood. The way deeper into the woods is barred by the King's woodwardens, so you go
north to Kingsholm instead and stand before the King. He reads the Ranger's note you carry, works out
what you are, and asks you, quietly, for the one thing his frightened kingdom needs: go deep into the
Witchwood and kill **Calder**, the leader of the mages. With the King's writ the barricade opens. You fight
your way through three ever-deeper parts of the wood, growing stronger, beat Calder at the great crack at
its heart, and carry his head back to the King. Credits roll.

## How to pace an hour (the short version)

A few rules this plan follows, so you can change it later and keep it working:

1. **Get them playing in 30 seconds.** No long opening. Wake, look around, move.
2. **Show the goal early, then make them earn it.** The barricade in the first minutes tells the player
   where the game is going (deeper in) before they're allowed there.
3. **One new thing per stretch.** Each part of the wood brings one new kind of mage. The player practises
   on the ordinary ones, then a boss tests it. Nintendo calls this *teach, practise, test*.
4. **Breathe between fights.** The city visit is the long calm stretch, where the story and the people
   live. In the deep woods, each boss is followed by a quiet minute at an old stone.
5. **Each zone harder than the last.** The Ashwild, the Frozen Hollow and the Thunder Rift climb in
   difficulty, and the player's levels climb with them.
6. **End fast.** After the last boss, get the player back to the King quickly and roll the credits.
   Nobody wants a long walk after the final fight.
7. **Every area has one job.** If an area doesn't teach, test, rest or reveal something, cut it.

## The map of the hour

| Area | Status | Its job |
|---|---|---|
| **The Clearing** (Witchwood) | Exists, plus the barricade | Teach moving, punching, swimming and fishing; show the barred way deeper |
| **The King's Bridge** | Exists | Arrival in the kingdom: spectacle, a breather |
| **The Market Quarter** | Exists | The city: people, rumours, potions, the way to the castle |
| **The Castle** | Exists | The King, and the quest |
| **The Ashwild** | **New** | The first deep zone: Ember mages, and Cinder |
| **The Frozen Hollow** | **New** | The second: Frost mages, and Rime |
| **The Thunder Rift** | **New** | The last: Storm mages, and Calder at the great crack |

### The barricade

On the Clearing's far side from the cave (across the river, where an old trail runs on into the trees), the
King's **woodwardens** have built a barricade of sharpened stakes across the trail, with two wardens on
guard. They're friendly, like the city's guards, and talking to them is how the player learns where they
can't go yet.

Before the King's writ:

> *"No further, little one. King's orders: nobody goes deeper into the Witchwood. Not woodcutters, not
> hunters, not you."*
>
> *"There's things in there now. Robed things. If you've business with the King, the cave's north, up the
> path. He's in Kingsholm, over the river."*

After it:

> *"That's the King's own seal. Well. Mind yourself in there."* (The stakes are pulled aside.)

### The new areas

All three continue from the barricade, one leading into the next, each a bit deeper, darker and stranger
than the last. The forest is the same forest, going more and more wrong.

**The Ashwild.** The trees go ash-grey the further in you go, and cold cracks run across the ground like dry
riverbeds. Slimes are thicker here. The **Ember** Greyed hunt in pairs, throwing fire and the sheep orb.
Partway in are the woodcutters' abandoned huts, and at the far end the Greyed's first camp, three faded
tents round a cold fire, where **Cinder** waits. Size: about the Clearing's.

**The Frozen Hollow.** A sunken valley in the wood where it's always winter: a frozen lake, white trees,
ice underfoot and snow falling. The **Frost** Greyed patrol the ice. Their frostbolts slow you, and
standing close to one gets you frozen solid. **Rime** sits at the middle of the frozen lake. Something big
swims under the ice now and then; it's only a very large koi.

**The Thunder Rift.** The oldest, tallest trees in the valley, a storm that never stops overhead, and
the ground split by the **great crack**: the deepest one under the Witchwood, cold and humming, a door into
the dark. The **Storm** Greyed hold the paths up to it. **Calder** stands at its edge. The lightning here
comes out of a sky that is, if you look closely, perfectly clear.

### The King's audience

The King holds court in **the Throne Room**, inside the keep (`src/areas/throneroom.ts`). The player walks
up Castle Street, through the barbican and the gatehouse into the ward, and up the keep's stairs to its
doors. Inside, a crimson carpet runs the length of a white marble hall, between pillars hung with banners,
under gold chandeliers, to the velvet dais where the King stands before his golden throne, gilded lions and
braziers at its foot and the Royal Guard along the carpet.

### Checkpoints: the old stones

The Foreigner wakes on the oldest stone in the valley (see [HERO.md](HERO.md#falling-and-waking-again)).
Losing twenty minutes to one mistake makes people quit, so **Ael wakes him on the last old stone he
touched, with his gear and level kept.** (He might drop his potions, so falling still stings.) The stones
are grey, flat and faintly warm, and glow a little when he touches one.

| Stone | Where |
|---|---|
| The Ranger's stone | The Clearing, by the camp (the start) |
| The fountain stone | The Market Quarter, at the foot of the fountain |
| The ash stone | The Ashwild, at its entrance just past the barricade |
| The hollow stone | The Frozen Hollow, at its entrance |
| The rift stone | The Thunder Rift, just below the great crack (before Calder) |

**The way home.** When Calder falls, the rift stone glows brighter than any stone has before. Touching it
carries the Foreigner straight to the fountain stone in the Market Quarter, so the walk back to the King
is two minutes, not ten. (Ael's stones are all one stone underneath. It just took the crack closing for
them to be able to tell each other so.)

### The clock

The day and night cycle runs a whole day every ten minutes. Let it run freely, with two moments the story
sets: **arriving at the King's Bridge is golden late afternoon**, and **the return to the King is at
dawn**, the first sunrise after the crack closes.

## The hour, beat by beat

*Intensity* is how hard the stretch feels, from 1 (calm) to 5 (the hardest fight).

| Clock | Beat | Area | Intensity |
|---|---|---|---|
| 0:00 | Waking | The Clearing | 1 |
| 0:02 | First slimes, the barricade | The Clearing | 2 |
| 0:07 | Through the cave, over the golden bridge | The King's Bridge | 1 |
| 0:09 | The city | The Market Quarter | 1 |
| 0:13 | **The King** | The Castle | 1 |
| 0:17 | Back to the wood, through the barricade | The Clearing | 1 |
| 0:20 | Into the Ashwild | The Ashwild | 3 |
| 0:28 | Cinder | The Ashwild | 4 |
| 0:31 | Into the Frozen Hollow | The Frozen Hollow | 3 |
| 0:39 | Rime | The Frozen Hollow | 4 |
| 0:42 | Up to the Thunder Rift | The Thunder Rift | 4 |
| 0:50 | **Calder** | The Thunder Rift | 5 |
| 0:55 | The head, the King, the credits | The city, the Castle | 1 |

### Part one: the King's errand (0:00 to 0:20)

**0:00 Waking (2 min).** He opens his eyes on the stone by the Ranger's fire. No text, just the clearing,
birdsong and the fire crackling. The player moves within seconds. Under the stone: the Ranger's note, a
fishing pole and a crust. *Teaches:* moving, looking around, picking things up.

**0:02 First slimes, and the barricade (5 min).** Slimes bounce out of the pond. *Teaches:* punching,
dashing, jumping. The lake teaches swimming (slimes won't follow you in) and fishing (koi heal you). A
blade drops from a slime, and swinging it feels great after punching. Exploring the clearing, the player
finds the trail across the river and the **barricade**: the wardens turn him back and point north to the
King. *Shows the goal:* the real adventure is behind those stakes.

**0:07 Through the cave and over the bridge (2 min).** Up the path, through the cave, out between the
gilded lions onto the King's Bridge in late-afternoon gold. Nothing to fight. Let the player look.

**0:09 The city (4 min).** Through Southgate into the Market Quarter, up the high street, across the square
and up Castle Street. The city tells its story through what's around: three-cut loaves, horseshoes over
doors, the Edict read at the cross, people muttering about "the weather". Anyone the player talks to has a
rumour (see [FAMILIES.md](FAMILIES.md)). **Old Mother Larke** looks into his eyes on the way past, laughs,
and gives him three potions. *Teaches:* talking to people, potions. The fountain stone is here.

**0:13 The King (4 min).** Through the castle gates to the ward, and up the keep's stairs into the Throne
Room. **King Osric** on his dais, with
Prince Edmund beside him and the Marshal glowering. The Foreigner can't speak (he has no mouth), so he does
the only thing he can: he holds out the Ranger's note. The scene, in the King's words:

> *"A stone child, out of the Witchwood, with my Ranger's handwriting. Give it here."*
>
> *(He reads. He goes very quiet, and then very red.)*
>
> *"You can't talk, can you? No. Of course not. Good. Then you can't repeat this either."*
>
> *"Officially, there are no witches in the Witchwood. I've said so. I've had it read at the cross every
> market day. Unofficially... there is one. A Storm mage. He calls himself Calder. He leads the rest of
> them, and every week he comes a little closer to my city."*
>
> *"The road south is shut. Nobody will drive it. The bridge isn't paid for. The people are whispering about
> the weather and hanging horseshoes on their doors, and on Founder's Night they'll be in the square
> burning straw witches with half of them wondering if the real ones are watching. My kingdom is
> frightened, and it's getting desperate."*
>
> *"My soldiers won't go deep into that wood. I can't make them, and I can't tell them why they should.
> But you came out of it. You walked out of it, in bark, without a scratch."*
>
> *"So. If you can go deep into the woods and kill him... I need it. The kingdom needs it. Bring me proof,
> and you'll have anything Aurenmark can give."*
>
> *(He presses his seal into a strip of parchment and hands it over.)* *"Show that to my woodwardens.
> They'll let you through."*

The player now has **the King's writ**. The Prince, as the player leaves, adds quietly: *"The Hammonds'
forge is by the gate. Tell Walter I sent you."* (A better sword, if the player stops.)

**0:17 Back to the wood (3 min).** Back down through the city, over the bridge, through the cave, to the
barricade. The wardens see the seal and pull the stakes aside. *(Tip for building it: this walk is the one
stretch with nothing new in it, so keep it short. The fountain stone can carry him back to the Ranger's
stone once he holds the writ, which saves most of it.)*

### Part two: deep into the Witchwood (0:20 to 0:55)

**0:20 Into the Ashwild (8 min).** Past the ash stone, the trees go ash-grey. The first Greyed mage blinks
into view, throws fire and turns him into a sheep. It wears off in five seconds and he chases it down.
*Teaches:* enemies that keep their distance and blink; the sheep; catching a mage after it blinks. Ember
mages in ones and then in pairs, slimes between them. At the edge of the trees, a tall frost-white figure
watches him and nods: **Yssa**. She doesn't fight. She's the only robed one who doesn't.

**0:28 Cinder (3 min).** The Greyed's first camp. **Cinder**, the Ember lieutenant: faster fire, more
blinks, and the sheep orb in volleys of three. *Tests:* dashing through gaps, punishing after a blink.
When he falls, he crumbles to grey stone, and his spark flies south. (Back in the city, the Applebys' sheep
sneezes and becomes Tam again.) **Power spike:** Cinder always drops a magic-or-better weapon.

**0:31 Into the Frozen Hollow (8 min).** Down into the always-winter valley, past the hollow stone. Frost
mages on the ice: frostbolts that slow you, and a nova that freezes you if you stand close. *Teaches:*
keeping your distance, and the **bow**, found in an abandoned hunter's hut at the Hollow's edge (hold to
draw, only a full draw hits hard). Rushing a Frost mage with a sword gets you frozen and punished.

**0:39 Rime (3 min).** The middle of the frozen lake, nowhere to hide. **Rime**, the Frost lieutenant:
bigger novas, faster bolts, and patches of ice that freeze over around her. *Tests:* the bow and
keeping distance. When she falls, the lake thaws in a ring around where she stood, and the path up out of
the Hollow opens.

**0:42 Up to the Thunder Rift (8 min).** The climb through the oldest trees, under the storm that
isn't there. Storm mages: sparks too fast to react to, and lightning that marks the ground before it
strikes. *Teaches:* watch the ground and dash out of the marked circles. Everything at once by the end:
Ember, Frost and Storm mages together, slimes pouring up out of the cracks. The rift stone is just below
the great crack.

**0:50 Calder (5 min).** The edge of the great crack, humming, cold and wide open. **Calder of the Storm**:
sparks, three lightning strikes at a time, and a blink so fast he seems to be in three places. Every time
the Foreigner is knocked back, the crack opens wider, and every time he lands a hit, it closes a little.
*Tests:* everything: dodging the marked circles, full-draw arrows at range, the sword in the moment after
each blink, potions and koi to stay alive.

When Calder falls, the grey goes out of him last of all. For a moment he's a tired old Storm mage. He looks
at the Foreigner and says, in Vael, *"Oh. He sent you. Good."* Then his spark flies south, his body
crumbles to grey stone, and the great crack groans shut. All that's left whole is **his head**: a round
grey stone with the dark gone out of its face. The Foreigner picks it up.

### The ending (0:55 to 1:00)

**0:55 The head, the King, the credits (5 min).** The rift stone glows, and he touches it and wakes at the
fountain stone, at dawn. The city is waking up. People stop and stare at the little stone figure carrying
a stone head up the high street, and by Castle Street there's a crowd following him.

On the keep steps, he sets Calder's head at the King's feet. The King looks at it for a long time.

> *"...You did it."*
>
> *"Then it's over. No more whispering. No more Edict. Quill can read something else at the cross on
> market day, for once."*
>
> *(He looks at the crowd that's followed the Foreigner into the ward, and seems to make up his mind.)*
>
> *"And I suppose I'd better tell them the rest."*

**Credits roll**, over a few still pictures showing how it all ends (the full ending is in
[HERO.md](HERO.md#the-end)): the King reading the true chronicle at the cross and going very red; the Ranger
walking home to the house with the grey cloak; the Vael coming over the King's Bridge to take their eggs
home; Yssa playing cards with Widow Crane; Tam Appleby eating a turnip; the Foreigner asleep in the top room
of the Fells' house, with a lantern of his own in the window. **The End.**

## Fights, levels and gear along the way

A rough guide to how strong the Foreigner should be at each boss on the straight path, so the bosses can be
tuned. It uses the game's experience numbers (a slime is worth 10, a mage 50) and suggests the bosses be
worth 200 each.

| Point | Fights on the way | Total XP | About level | Gear |
|---|---|---|---|---|
| At the King | ~10 slimes | ~100 | 2 | A blade |
| At Cinder | + ~10 slimes, ~6 Ember mages | ~500 | 5 | A piece or two of armour, maybe the Hammonds' sword |
| At Rime | + Cinder, ~8 slimes, ~6 Frost mages | ~1,080 | 7 | Cinder's weapon, the bow |
| At Calder | + Rime, ~10 slimes, ~8 Storm mages | ~1,780 | 9 | Everything above, plus the climb's drops |

Players who explore will arrive stronger. That's fine: the bosses should be fair at these levels and
easier above them, so exploring is rewarded and nobody is forced to grind. The gear sets for each stretch,
and the hidden Heartstone set for explorers, are in [GEAR.md](GEAR.md).

## The detours

Off the story path, for players who want them. Each is a few minutes, and none is needed to finish.

| Detour | Where | Reward |
|---|---|---|
| **The whole Clearing** | The Witchwood | Koi, slimes, early loot |
| **The city's people** | The Market Quarter, the Castle | Rumours, gossip, the families' stories (see [FAMILIES.md](FAMILIES.md)) |
| **The Hammonds' forge** | The Castle | A better sword, on the Prince's word |
| **Meg Fell** | The Market Quarter | Deliver the Ranger's note to his wife as well as the King. She gives him her husband's grey cloak (armour). |
| **The woodcutters' huts** | The Ashwild | Hidden chests |
| **The big koi** | The Frozen Hollow | Fish through a hole in the ice for a golden koi |

## What needs building

**Already in the game:** the Clearing, the King's Bridge, the Market Quarter and the Castle; slimes and the
three kinds of mage; the blade, bow, fishing pole, armour, rings and amulets; potions, koi, levels, the
dash, jump and swimming; the day and night cycle; and (in progress) talking to people.

**To build, roughly in order of the hour:**

1. **The barricade** in the Clearing, with its two woodwardens, and an exit beyond it.
2. **The King** as someone you can talk to in the castle ward, with his scene, and **the writ** that opens
   the barricade.
3. **Old stones** as checkpoints, keeping gear and level on a fall, and the fountain-stone shortcut.
4. **The Ashwild, the Frozen Hollow and the Thunder Rift**, each leading into the next.
5. **Bosses:** Cinder, Rime and Calder, as bigger versions of the three mages with a twist each (the sheep
   volley, the frozen lake, the triple blink and the crack).
6. **Calder's head**, carried back, and the rift stone's way home.
7. **The ending**: the King's last lines, and the credits over still pictures.
