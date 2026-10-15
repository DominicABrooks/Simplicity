// What the townsfolk say when they notice a curiosity the hero's carrying (see CURIOS in items.ts): a clue to
// where it came from, or who'd want it. Said now and then, in the middle of an ordinary conversation.
import type { CurioId } from "./items.ts";

/** How likely someone is to bring one up, when the hero's carrying any. */
export const CLUE_CHANCE = 1 / 3;

export const CLUES: Record<CurioId, readonly string[]> = {
  stone: [
    "That stone you've got... it's warm, isn't it? There are old stones like it out in the Witchwood. The Ranger used to sit by one.",
    "My gran said the old stones talk to each other, underneath. That one looks like it's listening.",
    "Where did you get that stone? Don't show it round the market. Show it to someone who knows the wood.",
  ],
  key: [
    "That key's older than the city wall. There's a door under St Mary's nobody's opened since the Edict.",
    "The sexton at St Mary's keeps a ring of keys like that one. He's missing one, he says. Won't say what it opens.",
    "A key out of the river? Someone threw that in on purpose, mark my words. Someone wanted a door to stay shut.",
  ],
  eye: [
    "Is that a glass eye? There's an old sailor down by the quay who lost one in the river. Fell in, the night of the fog.",
    "Put that eye away, it's following me. ...It's following me!",
    "The quay folk say an eye that's been in the river sees what's under it. I wouldn't look through it, myself.",
  ],
  bottle: [
    "A letter in a bottle? Don't open it in the street. The Marshal's men read everything.",
    "In your own hand, you say? Then you've written it already, or you're going to. The wood does that to people.",
    "Bottles come down the river from the Witchwood sometimes. Nobody in the city sent them, that's for sure.",
  ],
  bell: [
    "Put that bell away! That's Ismay's bell, the bell-ringer's. She'll come looking for it after dark.",
    "A little bell that rings itself at nine? Take it to St Mary's churchyard. Or don't. I'd rather you didn't.",
    "They buried Ismay without her bell. Everyone knows that. So whose is that?",
  ],
};
