# The Curiosities

One catch in twenty comes up something stranger than a koi (`CURIOS` in `src/data/items.ts`). Each is a
thread back into the city's story: the townsfolk notice it in the bag and drop a clue (`src/data/clues.ts`),
and each has somewhere it belongs. Taking it there **spends** it (`src/game/curios.ts`): out of the bag, and
off the line for the rest of the run. A new run has them all back in the water.

None is needed to finish. Each is a few minutes' detour with a story at the end of it and something worth
having.

| Curiosity | Where it belongs | What happens | Reward | Status |
|---|---|---|---|---|
| **Little Handbell** | St Mary's churchyard, after dark | Ismay Tollen rises for it, calm, rumour or none (and an already-angry Grey Ringer stops to listen). She takes it back, rings the curfew one last time and rests for good. | Her grave goods (two rare items, two potions), the ghost's XP, no fight | **Built** |
| **Rusted Key** | The low locked door at the foot of St Mary's tower | It turns and stays in the lock: **the Undercroft** is open for the rest of the run. Without it: "locked fast". | The way down to the tombs and the stone ring | **Built** |
| **Mysterious Stone** | The empty socket in the Undercroft's ring | Walk it up to the socket: it slides home, stands glowing, and the ring wakes. It's still there every time you come back. | Healed to full, and the **Ringstone Pendant** (rare amulet: +2 life, +1 damage, +8% speed) | **Built** |
| **Glass Eye** | Old Gil, the one-eyed boatman by his boat at the foot of the King's Bridge | Talk to him with it in the bag: he takes it back (his patch comes off) and tells what the river showed it. | **Ael's Thorn** (rare blade: +2 damage, +1 life, +6% speed) on the bed of the Clearing's lake | **Built** |
| **Sealed Bottle** | Right-click it in the bag | The bag closes and a letter in the hero's own hand is read, from a run he doesn't remember. | A hint for every curiosity still to take home this run, and one true thing about the ending | **Built** |

## The bell come home (built)

The little handbell rings at nine every night, though nobody rings it. It's Ismay's: the Marshal's men threw
it off the bridge after her the night before the Edict, and the Dean buried her without it so there'd be
nothing left of her to ring.

Carry it into St Mary's churchyard after dark and it rings in the bag; something under the grass answers.
She rises **calm**, named, not a foe: she can't be hit and doesn't attack. She drifts over and has her say
(`BELL_HOME` in `src/data/ghost.ts`), takes the bell, rings nine with it, harmless rings of sound going out
over the city, and goes, leaving her grave goods. She never rises again this run, however much the city
whispers. If she's already up and fighting when the hero picks the bell up, she stops, lowers her own bell
and comes for it instead.

## The Undercroft (built)

St Mary's was built in 88 AF on the old temple's foundations (see HISTORY.md). The sexton's lost key opens
the low door in the south face of the tower, in the nook where the nave meets it, just off the churchyard
(`UNDERCROFT_DOOR` in `src/areas/capital.ts`). Without the key the hero is put back a step and told the door's
locked fast; with it, the key turns and stays in the lock, and the door is open for the rest of the run.

Down the steps (`src/areas/undercroft.ts`): the church's dead in their chest tombs down both walls, effigies on
the oldest, the Kellets' mason mark on every one, the Waxleys' candles still burning between them, the
sexton's stores by the door. At the north end, older and rougher than all of it, the temple floor: a ring of
seven grey standing stones, a faint light breathing along their feet, one socket empty, facing the way in.
The door, tombs and ring are drawn in `src/render/undercroft.ts`; what's said, in `src/data/undercroft.ts`.

## The Ring Stone (built)

The Mysterious Stone is the missing piece ("Maybe someone is interested in this..."). Carry it near the ring and
it's warm in the bag; walk it up to the socket and it slides home (`src/game/undercroft.ts`). It stands there
glowing blue-green and slowly turning, rings of light go out over the room, the warmth goes right through the
hero (healed to full), and a chip of the ring is left at its foot: the **Ringstone Pendant**. Come back and
it's still standing there.

As it wakes, the ring tells him what it is (`UNDERCROFT_SAYS.wake`): the Vael's temple floor, where the Old Mother
laid her three eggs; Aldric stole them and Hereward gilded them, and the ring has held the crack under the hill
shut alone ever since. And it's an **old stone** now (STORY.md, "Checkpoints"): it knows him, and a fall wakes
him in the ring; walk up to it again after touching another stone and it knows him again. The little sealed door
behind the ring, the Vael's lock on somebody else's door, goes quiet: no cold comes under it any more.

The way to it: one of the stone's clues (`CLUES.stone`) sends him to St Mary's, built on stones like it.

## Old Gil's eye (built)

Gil Harrow, who has rowed folk across under the King's Bridge for forty years, stands by his boat on the south
bank west of the bridge's foot (`GIL` in `src/data/quay.ts`), a patch over one eye. The night of the fog he
leaned over to see what was glowing in the water and his glass eye went in after it. Talk to him and he says
so; talk to him with the Glass Eye in the bag and he takes it back (the patch comes off, in `src/render/quay.ts`)
and tells the hero what it saw down there: a thorn of grey wood on the bed of the lake in the Clearing.

From then on **Ael's Thorn** lies in the deepest water of the Clearing's lake (the water furthest from any
shore, `lakeBed` in `src/game/quay.ts`), its beam showing, until the hero swims out and takes it. It never
fades away, and if he loses it, the lake has it back.

## The letter in the bottle (built)

Right-click the Sealed Bottle in the bag (its tooltip says so): the bag closes, the seal breaks, and a letter in
the hero's own blocky hand is read in the dialogue box, from a run he doesn't remember. It says what each
curiosity still unspent this run is for, one line each (none, if he's done them all: "You always do,
eventually"), and ends with a line that only makes sense later: don't trust the clear sky over the Rift, and
take the King's offer of a bed.
