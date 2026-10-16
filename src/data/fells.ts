// The Fells (src/world/people.ts): the Ranger's family, in the Wallside, the house with the grey cloak at the window.
// The Ranger's note tells whoever finds it to go to Meg Fell; this is what she says when he does. She hangs her
// husband's cloak from the window every evening so he'll know the house when he comes home (src/game/fells.ts hangs
// it there till the King lets him go), and she has no idea where he is.

/** What Meg Fell says, by how far the story's come: before Calder's beaten, and after. Then the next line along, each time. */
export const MEG_TALK = {
  first: [
    "(A woman with soap to her elbows looks at you, and then at the grey cloak hanging from the window above her, and back at you.)",
    "You've come up from the south. Nobody comes up from the south. Not since the road was shut.",
    "My husband's the King's Ranger. Wystan Fell. The King sent him down into the Witchwood last spring to see what was there.",
    "He came back with a face like he'd seen something wonderful, and asked to see the King. The King's men came for him that night, and nobody will tell me where he is.",
    "So I hang his cloak in the window every evening, so he'll know which house when he comes home.",
    "...You've seen him. Haven't you. You can't say, can you? No. But you've seen him.",
  ],
  again: [
    "Every evening. He'll know the house.",
    "Hob wants to go south and look for him himself. He's fourteen. I've hidden his boots.",
    "If you see the King, you might look at him the way you're looking at me. It's very hard to bear.",
  ],
  /** Calder's beaten: the storm's gone quiet, and everyone's saying the stone child did it. */
  quiet: [
    "They say the storm over the Witchwood's stopped. They say it was you.",
    "If it's over... then maybe the King can let him go. Maybe.",
  ],
} as const;
