// Under the Hill (src/areas/underhill.ts, src/game/underhill.ts): where a Fey Acorn takes the hero if he follows it.
// Right-click it in the bag and he's held where he stands while the fair folk's magic comes up over everything (the
// fairy ring's spell, src/render/trance.ts), and he wakes in a glade under the hill, a sky of violet over it that isn't
// a sky, before the Erl-King on his throne of moss: the king of the ones who dance, older than the first Pebbling.
//
// The first time, the Erl-King tells him the secret under all the others, and gives him the ring the Founder dropped
// dancing the Long Reel on the night of the Great Pinch. The second time, he tells him something smaller, and warns
// him not to come a third time: others dance under the hill, and they've been watching him come and go. The third
// time, the throne is empty, and they're there instead: watchers, all round the glade, staring at him until he goes.
// Every time after that, there are more of them, and they stand a little nearer.
//
// The pixel font has capitals, digits and . , : ; ! ? ' - + = / ( ) [ ] < > % _ & * and nothing else.
import type { Mods } from "./items.ts";

/** The glade's middle (tiles), and where the Erl-King's throne stands (centre, tiles, and how wide): at its head. */
export const GLADE_MID = { x: 16, y: 14 } as const;
export const THRONE = { x: 16, y: 6.6, r: 1.5 } as const;

export const UNDERHILL = {
  /** How long the magic takes to come up over him before he goes (s), and how long it takes to clear once he's there. */
  going: 2.8,
  clearing: 2.4,
  /** How long after he's there before the Erl-King speaks (s). */
  firstWord: 1.2,
  /** Each line: in, held (at least `hold`, longer the longer it is), out, and the pause before the next (s). */
  line: { in: 0.6, hold: 3.2, perChar: 0.06, out: 0.7, gap: 0.35 },
  /** The watchers, from the third time on: how many at first, how many more each time after, at most; how far out
   * (tiles from the glade's middle) at first and how much nearer each time, at least; and how long they take to show (s). */
  watchers: { first: 7, more: 2, most: 19, far: 7.5, nearer: 0.7, nearest: 3.5, fade: 3 },
  /**
   * And they murmur (WATCHER_MURMURS): once they're out of the dark (`from` s after he arrives), every so often
   * (`every`, s [min, max]) one of them says something, over its head, in a low voice; each line comes and goes over
   * `life` s.
   */
  murmurs: { from: 3, every: [2.5, 5.5], life: 3.4 },
  /**
   * And while they're there, their magic gets into everything: every so often (`every`, s [min, max]) the world swims and
   * glows for `last` s [min, max], rising and falling away.
   */
  glitch: { every: [1.4, 4], last: [0.7, 1.8] },
  says: {
    cannot: "It won't hum here. It wants the sky over it.",
    gift: "The Erl-King's gift drops into your hand.",
  },
} as const;

/**
 * What the watchers murmur, the third time under the hill and after: the others who dance under the hill, that the
 * Erl-King warned him of, who've been learning the way. All of them are said before any is said again.
 */
export const WATCHER_MURMURS: readonly string[] = [
  "This was a mistake.",
  "What have you done.",
  "He told you not to come a third time.",
  "The throne is empty. Where do you think he went?",
  "You stand so well.",
  "Little stone. Little stone. Little stone.",
  "We have learned the way now. Thank you.",
  "Go up, then. We will be right behind you.",
  "The grass has stopped talking.",
  "You smell of Ael. It is fading.",
  "Count us. Now count us again.",
  "There were fewer of us last time.",
  "Next time there will be more.",
  "We danced here before the dancers.",
  "Don't look at us.",
  "Look at us.",
  "You came for a secret. We are the secret.",
  "The eye on the other side of the door can see you down here.",
  "It is smiling wider.",
  "Nobody up there knows where you are.",
  "Hang the acorn by your door, he said.",
  "Who let you in? You did.",
  "Six hundred years we waited at the edge of the light.",
  "Your face is so warm. Come closer.",
  "We were stones once too.",
  "The Old Mother is still lying very still.",
  "Stay. Stay. Stay.",
  "You can still go back. For now.",
  "Every time you leave, the door stays open a little longer.",
  "Something is already on the path behind you.",
  "Shh. It's listening.",
  "We know the way to your camp.",
];

/** What the Erl-King gives him, the first time: the Founder's own ring, dropped dancing. */
export const REEL_RING = {
  type: "ring",
  name: "Ring of the Long Reel",
  mods: { crit: 5, life: 4, speed: 20, dash: 30 } satisfies Mods,
  note: "The Founder dropped it dancing, the night he stole the eggs. The fair folk kept it for whoever came down first.",
} as const;

/** The first time: who he is, the secret under all the others, and the ring. */
export const FIRST_VISIT: readonly string[] = [
  "So. The little stone has found the way down. Stand there. You stand so well.",
  "I am the king of the ones who dance. We were here before the first Pebbling woke. We danced on Ael's back while it was still warm from the bite.",
  "Everyone who comes under the hill wants a secret. Here is the one under all the others.",
  "Beneath St Mary's there is a little door, carved with three flames, a snowflake and a lightning bolt. The masons think it is the Vael's door.",
  "It is not a door. It is the Vael's lock, on somebody else's door. And it keeps coming unlocked.",
  "The night Aldric carried the eggs out of the deep places, something on the other side of that door opened one eye, and looked up at the valley, and smiled.",
  "It has been smiling for six hundred years. The star that grows a little bigger every night is that eye, seen from our side.",
  "And you, little stone, are the one thing it cannot see. Your face does not open onto the Hush. It opens onto Ael's heart.",
  "When it looks for you, it finds only warmth, and it is afraid. That is why the Greyed hate you. That is why Ael sent you.",
  "Do not tell the King. He would only make it illegal.",
  "Take this. The Founder dropped it dancing the Long Reel, the night he stole the eggs. We kept it, for whoever came down here first.",
];

/** The second time: no more gifts, one thing more, and a warning. */
export const SECOND_VISIT: readonly string[] = [
  "Back again. The grass told me you were coming. The grass tells me everything. It never stops.",
  "You have had your secret, and your gift. That is all there is, even for a child of Ael's heart.",
  "Here is one more, for nothing, since you came. The Old Mother is not sleeping. She has not slept since her eggs grew warm. She is only lying very still, to see what you will all do.",
  "Now hear me, little stone. Do not come down a third time.",
  "We are not the only ones who dance under the hill. The others have been watching you come and go. They are learning the way.",
  "Keep your acorns. Hang them by your door. Do not follow them again.",
  "If you keep coming back, something will follow you up. Go.",
];
