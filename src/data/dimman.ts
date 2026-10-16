// The Dim Man: what the city calls the watcher at the end of the street after dark (src/game/eerie.ts), and what
// it says about him when it thinks nobody's listening. Now and then, talking to the hero, the townsfolk mention
// him; and sometimes one of them tells the next part of who he was, so that a hero who listens can piece the
// whole of it together, one telling at a time. Put together in src/game/dimman.ts.
//
// The story, as the city tells it. Before the Edict, Kingsholm had a night watch that walked the streets calling
// the hours: "Ten o'clock and all's well." Its last watchman was Gideon Wicke, who walked the Market Quarter for
// thirty years with his lantern and his staff. On the night Ismay Tollen rang the great bell, Gideon saw the lights
// in the wood too, from the top of Castle Street, and he called it, the way he'd called everything for thirty
// years: "Midnight, and lights in the wood!" The Marshal's men went up the tower for Ismay. For Gideon they didn't
// bother: the next morning the Edict was read at the cross, and the calling of the hours was the first thing it
// stopped. Gideon kept walking his round every night anyway, without a word, standing at the ends of streets and
// looking at whatever he wasn't allowed to say. He got thinner and greyer and quieter, and his lantern lower, and
// one night at the end of that summer only his lantern came home, burnt right down, found standing at the
// end of Castle Street. And now there's a tall dark shape at the ends of streets after the curfew, with two pale
// little lights for eyes, that goes when you come near. A face is a window with a lamp in it, the old saying
// goes: keep your lamp lit. Gideon's is very low now. He's still watching. He's just not allowed to say what for.

import type { Take as DimTake } from "./frighttalk.ts";

/** When they'll mention him at all, talking to the hero (one of these a conversation, at most), and how often it's the next of his story. */
export const DIM_MAN = {
  /** The chance a grown-up mentions him: more after dark, more again if the hero's seen him. */
  chance: { day: 0.07, night: 0.16, seen: 0.1 },
  /** Of those, the chance it's the next part of his story (if there's more to tell), not just a mention. */
  story: 0.45,
  /** The chance a child mentions him. */
  kid: 0.08,
} as const;

/** Just mentioning him, by how they take things. {seen} is said only to a hero who's seen him. */
export const DIM_MENTIONS: Record<DimTake, readonly string[]> = {
  deny: [
    "If anyone tells you about a Dim Man, they're making it up. There's no such man. There was never a night watch, either.",
    "Tall dark fellow at the end of the street? A chimney sweep. They're all tall and dark.",
    "The Dim Man is a story for frightening apprentices into bed. I'm not frightened. I'm going to bed because I'm tired.",
    "There's nobody standing at the end of any street. The Marshal had the ends of the streets checked.",
  ],
  shaken: [
    "Don't go to the end of a street after the curfew bell. The Dim Man stands there.",
    "If you see two little pale lights at the end of the street, don't walk toward them. Walk home.",
    "My neighbour saw the Dim Man. She says he looked at her like he wanted to tell her something. She's not been out since.",
    "He's always at the end of the street, they say. Whichever street you're in. Always the end.",
    "The Dim Man doesn't do anything. That's the worst of it. He just watches.",
    "The lamplighters won't do the end of Castle Street on their own any more. They go in twos.",
  ],
  hushed: [
    "Have you heard of the Dim Man? Tall, dark, two little lights for eyes. He keeps the watch nobody's allowed to keep.",
    "A face is a window with a lamp in it, my gran said. Keep your lamp lit. The Dim Man let his go low.",
    "He watches the wood, the Dim Man. Every night, the end of the street that looks toward the wood.",
    "They stopped the calling of the hours, you know, with the Edict. Nobody says it's all well any more. He'd know if it was.",
    "The Dim Man's been seen out past the walls, too. On the road, in the trees. Following something. Or someone.",
  ],
  defiant: [
    "The Dim Man's the only honest watchman this city's got. He sees what's coming and he's not afraid to stand there and look.",
    "I wave at the Dim Man. Somebody should. He's been standing out there every night since the summer.",
    "They took his voice and left the rest of him out in the street. That's the Edict for you.",
    "If the Dim Man ever gets to say what he's been watching for, I want to be there to hear it.",
  ],
  informer: [
    "There've been reports of a hooded figure after curfew. I made most of them. If you see him, tell me first.",
    "The Dim Man is not on the census. I've checked. That's very suspicious.",
    "I've asked the Marshal for a warrant for the Dim Man. He said a word I won't repeat.",
  ],
};

/** Said first, to a hero who's seen him themselves (then the rest). */
export const DIM_SEEN: readonly string[] = [
  "You've seen him, haven't you? The Dim Man. I can tell by how you stand.",
  "You've been out after dark. You've seen the Dim Man. Everybody who's seen him has the same look.",
  "They say you've met the Dim Man. At the end of a street. Was he looking at you?",
  "You've got the look of someone the Dim Man's watched.",
];

/** Starting on his story, before the next part of it: who's telling it, and why now. */
export const DIM_LEADS: readonly string[] = [
  "Do you want to know who he was? The Dim Man? I'll tell you. Quietly.",
  "My gran told me about the Dim Man. She knew him, before.",
  "Everyone knows a bit of it. Here's my bit.",
  "I'll tell you about the Dim Man, but you didn't hear it from me.",
  "Sit a moment. You should know this, going about at night like you do.",
  "Under the Crown, mind. This is about the Dim Man.",
];

/**
 * His story, in the order it's told: each telling is the next part, in one of its ways of being told, so a hero who
 * listens hears it all in the end, from all over the city.
 */
export const DIM_STORY: readonly (readonly string[])[] = [
  [
    "Before the Edict, there was a night watch. Men who walked the streets with a lantern and a staff, calling the hours. \"Ten o'clock, and all's well.\"",
    "There used to be men who called the hours, all night, up and down every street. \"Eleven o'clock, and all's well.\" You slept better for it.",
  ],
  [
    "The last of them was Gideon Wicke. Thirty years he walked the Market Quarter. Knew every door, every dog, every drunk by name.",
    "Gideon Wicke, his name was. The last watchman. Tall, and slow, and kind. He walked my gran home from the Crown more nights than she'd admit.",
  ],
  [
    "The night Ismay rang the great bell, Gideon was at the top of Castle Street. He saw the lights in the wood too. Fire, and frost, and lightning.",
    "Ismay saw the lights from the tower. Gideon saw them from the top of Castle Street, the same night, the same lights. Robed folk, carrying fire.",
  ],
  [
    "And he called it. The way he'd called everything for thirty years. \"Midnight, and lights in the wood!\" Up and down the street, till his voice went.",
    "He did what a watchman does. He called it. \"Midnight, and lights in the wood! Midnight, and lights in the wood!\" Half the city heard him.",
  ],
  [
    "The Marshal's men went up the tower for Ismay. For Gideon they didn't bother. In the morning the Edict was read at the cross, and the first thing it stopped was the calling of the hours.",
    "They didn't need to march Gideon anywhere. They just read the Edict at the cross next morning. No more calling the hours. No more watchmen. No more \"all's well\".",
  ],
  [
    "But Gideon kept walking his round. Every night. Not a word. He'd stand at the end of a street for hours, looking at whatever he wasn't allowed to say.",
    "He couldn't stop. Every night, lantern and staff, round the Market Quarter, saying nothing. Standing at the ends of streets, looking. Just looking.",
  ],
  [
    "He got thinner. Greyer. Quieter, if you can be quieter than silent. And his lantern got lower every night, like he'd stopped buying oil. Like he'd stopped needing it.",
    "People said he was going dim. You know the saying: a face is a window with a lamp in it. Keep your lamp lit. Gideon's was going out, a little every night.",
  ],
  [
    "One night at the end of the summer, only his lantern came home. Burnt right down, standing on its own at the end of Castle Street. No Gideon. Not then, not ever.",
    "They found his lantern one morning this summer, at the end of Castle Street, burnt to nothing, set down neat as you like. Nobody ever found him.",
  ],
  [
    "And since then, there's been someone at the ends of the streets after the curfew. Tall. Dark. Two little lights where a face should be, turned right down low. Keeping the watch.",
    "So that's the Dim Man. Gideon Wicke, still on his round. Still watching. Still not allowed to say what for. Whatever it is, it's coming from the wood.",
  ],
];

/** After the last part's been told, anyone telling it again: how it ends, as they'd end it. */
export const DIM_ENDINGS: readonly string[] = [
  "If the Edict's ever lifted, I think the Dim Man will call the hour one last time. And then go home.",
  "I'd like to think, if someone told Gideon it was all well, really well, he could rest.",
  "Someone should find out what he's watching for. Someone who isn't from here. Someone like you.",
  "You know all of it now, I think. More than most. Don't go standing at the ends of streets.",
];

/** After a part of his story, now and then: what they make of it. */
export const DIM_CODA: readonly string[] = [
  "Don't tell anyone I told you that.",
  "That's all I know. That's more than I should.",
  "Somebody else'll know the rest. Everybody knows a bit.",
  "Mind the weather.",
  "I've never told anyone that. You've got one of those faces.",
];

/** A child's version. */
export const DIM_KID: readonly string[] = [
  "If you're out after the bell, the Dim Man gets you. That's what Mam says. I don't think he gets anybody. I think he's sad.",
  "The Dim Man has lamp eyes! Little ones! My brother says he saw him but my brother lies.",
  "We play Dim Man. You stand at the end of the street and don't talk and everyone runs. I'm the best at it.",
  "The Dim Man used to be a person. Gran says. Then he forgot how.",
];
