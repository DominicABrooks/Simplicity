// King Osric IV, the Gilded, on his throne in the keep: who gives the Foreigner his task (see STORY.md,
// "The King"). The first time you go before him he reads the Ranger's note you carry and asks you to go
// deep into the Witchwood and kill Calder, leader of the mages. After that he reminds you, less patiently.

import type { GiftKind } from "./items.ts";

/** As a target: named, never hostile. A little taller than his guards, for the crown. */
export const KING = { name: "King Osric", radius: 5, height: 1.75 } as const;

/** His task for the Foreigner, as the game puts it once he's given it. */
export const KINGS_TASK = "New task: go deep into the Witchwood and kill Calder";

/** Handing over his writ: it goes into the bag as he says it (a gift line: see GIFT in voices.ts). */
export const KING_WRIT = {
  say: "(He presses his seal into a strip of parchment.) Take this to my woodwardens. They'll let you through.",
  gives: "writ",
} as const satisfies { say: string; gives: GiftKind };

/** Going before the King for the first time. */
export const KING_AUDIENCE: readonly string[] = [
  "A stone child, out of the Witchwood, holding something out. Well? Give it here.",
  "(He takes the Ranger's note, reads it, and goes very quiet, and then very red.)",
  "You can't talk, can you? No. Of course not. Good. Then you can't repeat this either.",
  "Officially, there are no witches in the Witchwood. I've said so. I've had it read at the cross every market day.",
  "Unofficially... there is one. A Storm mage. He calls himself Calder. He leads the rest of them, and every week he comes a little closer to my city.",
  "The road south is shut. The bridge isn't paid for. My people hang horseshoes on their doors and whisper about the weather.",
  "My kingdom is frightened, and it's getting desperate.",
  "My soldiers won't go deep into that wood. But you came out of it. You walked out of it, in bark, without a scratch.",
  "So. If you can go deep into the woods and kill him... I need it. The kingdom needs it.",
  "Bring me proof, and you'll have anything Aurenmark can give.",
  KING_WRIT.say,
  "Now go.",
];

/** Going before him again, while the task's still to do. Each time the next one along. */
export const KING_AGAIN: readonly string[] = [
  "Calder. Deep in the Witchwood. Why are you still here?",
  "Every day he lives, my city whispers louder. Go.",
  "You can't talk, so I'll say it once more: the wood, the mage, proof. Off you go.",
  "Did I not make myself clear? Go and do it.",
  "I'm a patient king. That was a lie. Go.",
];
