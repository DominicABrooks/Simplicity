// What the townsfolk say about a fright, after the city's done something uncanny at them after dark (src/game/eerie.ts)
// and they've run for it. The next time the hero talks to one of them, it's the first thing on their mind: when it was,
// where, what they saw (or heard), and what they make of it, which depends on where they stand on the Edict (people who
// deny everything deny this too; the whisperers know exactly what it means; the informers are going to tell the
// Marshal), and how much they say depends on their voice. Children just tell you. Later on they bring it up again
// now and then, shorter, until they've put it behind them. Put together in src/game/frights.ts.
//
// {when} is when it happened ("just now", "earlier tonight", "last night", "the other night"), {where} where
// ("in the market square", "on the high street"), {When} and {Where} the same with a capital.

import type { EerieId } from "./eerie.ts";

/** How they take it: from their stance on the Edict (src/world/people.ts). */
export type Take = "deny" | "shaken" | "hushed" | "defiant" | "informer";

export interface FrightTalk {
  /** What they saw or heard, in their own words: the first thing they say about it. */
  saw: readonly string[];
  /** What they make of it, by how they take things. */
  take: Record<Take, readonly string[]>;
  /** Bringing it up again, on a later visit. */
  again: readonly string[];
  /** A child's version. */
  kid: readonly string[];
}

/**
 * Where it was, as they'd say it, by area: the first of its places (tile rects: x0, y0, x1, y1, inclusive) that
 * holds the spot, or else the area's own. The Market Quarter's streets are laid out in src/areas/capital.ts.
 */
export const FRIGHT_PLACES: Record<string, { places: readonly (readonly [number, number, number, number, string])[]; else: string }> = {
  capital: {
    places: [
      [56, 38, 62, 44, "by the well in the square"],
      [30, 30, 66, 51, "in the market square"],
      [44, 0, 52, 29, "on Castle Street"],
      [44, 52, 52, 76, "on the high street"],
      [66, 24, 90, 38, "by St Mary's"],
      [66, 39, 90, 42, "on East Street"],
      [4, 18, 20, 30, "up by St Giles'"],
      [4, 52, 44, 76, "down in the Wallside"],
    ],
    else: "in the back lanes",
  },
  castle: { places: [], else: "up in the Castleward" },
  kingsroad: { places: [], else: "out on the King's Road" },
  witchwood: { places: [], else: "out in the Witchwood" },
  ashwild: { places: [], else: "out in the Ashwild" },
  hollow: { places: [], else: "out in the Hollow" },
};
/** Anywhere else. */
export const FRIGHT_PLACE_ELSE = "out there";

/** How many days on they stop bringing it up, and how many times they'll tell it before they've put it behind them. */
export const FRIGHT_MEMORY = { days: 4, tellings: 3, again: 0.5 } as const;

/** How long ago, as they'd say it: by whether it's still the same night, the night before, or longer ago. */
export const WHEN = { now: "just now", tonight: "earlier tonight", lastNight: "last night", before: "the other night" } as const;
export type When = keyof typeof WHEN;

/** Starting on it, before what they saw: by how long ago it was. */
export const OPENERS: Record<When, readonly string[]> = {
  now: [
    "Did you see that? Just now? Tell me you saw that.",
    "Don't stand there! Didn't you see it?",
    "You were right there. You must have seen it.",
    "My heart's going like a drum. Did you see?",
    "Oh, thank goodness, a person. A real one. You are real?",
    "Can't stop long. Not after that.",
  ],
  tonight: [
    "You were out earlier, weren't you? When it happened?",
    "I've not stopped shaking since earlier.",
    "I'm not going back out there tonight. Not after earlier.",
    "Did you hear about earlier? You were there, I think.",
  ],
  lastNight: [
    "Last night. I've not slept a wink since last night.",
    "You were out last night, weren't you? I saw you, before I ran.",
    "Can I tell you something about last night? You won't laugh?",
    "I've been telling everyone about last night. Nobody believes me.",
  ],
  before: [
    "I keep thinking about the other night.",
    "The other night. Do you remember? I do. Every night since.",
    "I still dream about the other night, you know.",
  ],
};

/** Finishing, after what they make of it: what they'll do now. Any fright, any take but the deniers'. */
export const AFTER: readonly string[] = [
  "I've put salt on every sill in the house. Old Mother Larke says it's the wrong salt. There's a wrong salt?",
  "I've bought a horseshoe. The ironmonger was out, so it's a drawing of a horseshoe. It's better than nothing.",
  "I'm indoors before the curfew bell from now on. Before it. Well before it.",
  "Mind the weather. I mean it more than usual.",
  "Don't go about after dark. You hear me? Not even you.",
  "My gran always said the city remembers what you're not allowed to say. I thought it was just a saying.",
  "I'm sleeping with the candle lit. Don't tell anyone.",
  "Rowan over the door, rowan over the fireplace, rowan in my boots. I'm taking no chances.",
  "I'll be in the Crown's back room till dawn, if anyone asks. Under the Crown, mind.",
  "If you see it again, don't tell me. I don't want to know.",
  "I've three-cut every loaf in the house. Even the ones that were already cut.",
  "I said a prayer to St Mary. And one to the other lot, just in case. Don't tell the Dean.",
];

/** Kept short, and in their own words, by a child (under twelve). Any fright: after their own line about it. */
export const KID_AFTER: readonly string[] = [
  "I ran SO fast. Faster than Tom. Tom says he wasn't running but he was.",
  "Mam says it's nothing but she locked the door twice.",
  "I'm not scared. I'm only shaking because it's cold.",
  "Are you scared? I'm not. A bit.",
];

/** Every fright, its own. */
export const FRIGHT_TALK: Record<EerieId, FrightTalk> = {
  shutter: {
    saw: [
      "A shutter, {where}. Banging and banging, open and shut, and not a breath of wind.",
      "There was a light in the window {where}, and the shutter going like somebody was trying to get out. Nobody at the window. Nobody.",
      "Bang. Bang. Bang. A shutter {where}, slamming by itself. I felt every one in my teeth.",
      "{Where}, a shutter flew open and slammed, over and over. That house has been empty since Lent.",
      "I heard it before I saw it: a shutter, banging {where}. Then I saw the window. Lit, and empty.",
      "It swung right out over the street {where}, that shutter, and slammed so hard the cobbles jumped.",
      "The shutter {where}. You heard it. Like a door knocking to be let out instead of in.",
      "Somebody's shutter {where} wouldn't keep still. Somebody that isn't there, I mean.",
      "A lit window {where}, and nobody in it, and the shutter beating against it like a heart.",
      "I counted. Five times that shutter banged {where}. Five. Then nothing, like it was done saying it.",
    ],
    take: {
      deny: [
        "It was the wind. There was no wind, but it was the wind.",
        "Loose hinge. I'll have a word with whoever lives there. Somebody lives there.",
        "There is nothing in this city that is not allowed to be in it. That's the law. So it was a shutter.",
      ],
      shaken: [
        "I don't want to think about who lit that lamp.",
        "My knees went. I'm not ashamed. Well, I am a bit.",
        "Who'd want to get out that badly? And out to where?",
      ],
      hushed: [
        "Somebody in there's trying to say something. Somebody who isn't allowed to.",
        "You know whose house that was, before the Edict? No? Good. Better you don't.",
        "Windows open when the house wants to talk. That's what my nan said. Houses remember.",
      ],
      defiant: [
        "Let them bang. Let every shutter in the city bang till the Marshal hears it.",
        "Shut the windows and shut the mouths and see what you get. Shutters that won't stay shut.",
        "Good. Somebody should make some noise round here.",
      ],
      informer: [
        "I've written down the house. And the time. And that you were there. Just so it's all down.",
        "The Marshal will want to know about that window. Everything gets reported. Everything.",
        "Disturbing the peace after the curfew. I'll see someone's named for it, ghost or no ghost.",
      ],
    },
    again: [
      "I still jump when anyone shuts a door. That shutter, you know.",
      "Every shutter in the street's nailed shut now. Mine too.",
      "I went past that window in daylight. Just a window. That's worse, somehow.",
      "Bang, bang, bang. I hear it when I'm falling asleep.",
    ],
    kid: [
      "A window was banging all by itself and there was a light and NOBODY.",
      "The shutter went BANG and I went AAAH and then I ran.",
      "Somebody's house was knocking. Houses can't knock. Can they?",
      "I saw a window open all on its own! I'm going to tell everyone.",
    ],
  },
  footsteps: {
    saw: [
      "Somebody was walking behind you {where}. Right behind. And there was nobody behind you.",
      "There were prints on the stones {where}, pale as frost, coming along after you. Just appearing. Step, step, step.",
      "You stopped, and the footsteps behind you stopped. I saw it {where}. I heard it.",
      "Frost footprints, {where}, on a night with no frost, following you like a dog. Left, right, left.",
      "I heard two people walking {where}. I looked. I saw one. You.",
      "The prints came right up to your heels {where}. Whoever made them, they could have touched you.",
      "Footsteps {where}, keeping time with yours. When you went quick they went quick.",
      "Somebody was following you {where} and leaving their feet behind them on the stones, white as salt.",
      "Barefoot, by the prints. Small, too. {Where}. Who goes barefoot on cobbles in the cold?",
      "I watched them come down the street {where}, those footprints, all on their own, after you.",
    ],
    take: {
      deny: [
        "Frost. Footprints are just frost in a footprint shape. That's science.",
        "Nobody was following you. Nobody follows anybody. It's not allowed after curfew.",
        "You must have doubled back and walked in your own steps. Must have.",
      ],
      shaken: [
        "What does it want with you? Why you?",
        "If it follows you, does it follow whoever you talk to? Like me? Now?",
        "I keep looking behind me. I'm doing it now. Sorry.",
      ],
      hushed: [
        "Somebody wants you to know they're still about. Somebody who was walked off and never walked back.",
        "The ones they marched off to the keep. They went barefoot. Did you know that? They took their boots.",
        "Gone to see the Ranger, people say. Maybe some of them are coming back the long way round.",
      ],
      defiant: [
        "Let it follow you right up Castle Street to the King's door. I'd pay to see that.",
        "That's what the Edict gets you. People who can't be talked about don't stop walking.",
        "Walk on. Don't you dare stop for it. That's what it wants: everyone stood still.",
      ],
      informer: [
        "A stranger, followed about by something after curfew. The Marshal will find that very interesting.",
        "I'll need to report where you were going. And whose prints those were. You'll want to help with that.",
        "Being followed is suspicious. It's on my list. You're on my list. Everything's on my list.",
      ],
    },
    again: [
      "Still being followed? Don't answer that.",
      "I sweep my step every night now, to see if there's prints in the morning. There never are. That's worse.",
      "I walk home with my eyes on my own feet now. Just my own.",
      "Has it stopped following you? Or did it start following someone else?",
    ],
    kid: [
      "There were ghost feet behind you! White ones! I SAW them!",
      "Something invisible was playing follow-my-leader with you.",
      "You had a shadow but it was made of footprints. That's not normal.",
      "I tried to jump in the footprints and they were COLD.",
    ],
  },
  watcher: {
    saw: [
      "There was someone at the end of the street {where}, all in black. Just standing. Watching you.",
      "Tall, it was, {where}, with a hood, and two little lights for eyes. And then it was gone.",
      "You walked toward it {where}, and it was gone. Not walked off. Gone. Like a candle.",
      "It didn't move {where}. Not once. Nobody stands that still. Nobody alive.",
      "A man, {where}. Or the shape of one, cut out of the dark. With eyes. It blinked at you.",
      "I thought it was the lamplighter {where}. The lamplighter isn't that tall. Or that black.",
      "Black as the inside of a chimney, it was, {where}, and it turned to watch you go by.",
      "{Where}, standing in the middle of the street like it owned it, looking at you and only you.",
      "No face under the hood. Just two pale little eyes {where}. I'll see them till I die.",
      "When it went {where}, it went in a puff, like dust off a beaten rug. Nothing left. Not a footprint.",
    ],
    take: {
      deny: [
        "A cloak on a hook. Somebody hung a cloak on a hook in the middle of the street. That's all.",
        "There are no hooded men in this city. Hoods have been very much discouraged.",
        "It was the Ranger's grey cloak out of some window. Half the street hangs them out now.",
      ],
      shaken: [
        "It was looking at you. I'm glad it was looking at you. Isn't that awful of me?",
        "What if it comes to the end of my street? I live at the end of a street. Everyone does.",
        "I can't close my eyes without seeing its eyes.",
      ],
      hushed: [
        "Robed folk in the dark. That's what Ismay said she saw from the tower. Robed folk.",
        "There were people in this valley before the Founder. Tall people. In robes. Don't say I said.",
        "It came out of the wood, maybe. Like you did. Don't look at me like that, I'm only saying.",
      ],
      defiant: [
        "Let it watch. Let it stand at the end of every street and watch every one of us. Then maybe the King will look too.",
        "I'm not running next time. I'm going to walk right up and ask it what it wants.",
        "It looked sad to me. Like it was waiting for someone to say hello and nobody's allowed.",
      ],
      informer: [
        "Loitering after curfew, in a hood. That's two offences. Three, with the eyes.",
        "I've given the Marshal a very good description. Tall. Black. Eyes. He seemed tired of me.",
        "Did it say anything to you? You'll need to tell me exactly. Word for word. For the report.",
      ],
    },
    again: [
      "Seen it again? The one at the end of the street?",
      "I've stopped looking down the ends of streets. I look at my shoes.",
      "Every time someone in a dark coat goes by, my heart stops. And everyone wears dark coats.",
      "My little one draws it now. Two dots and a lot of black crayon. I've burnt them all.",
    ],
    kid: [
      "There was a tall black man with no face and little glowy eyes! And then POOF!",
      "I waved at it. It didn't wave back. Rude.",
      "It was like a person made of night-time.",
      "It looked at you. Are you friends with it? Can I meet it? No. I don't want to.",
    ],
  },
  lamp: {
    saw: [
      "The lamp {where} went out. Just like that. Sputtered, and went, and then came back on all by itself.",
      "That lamp {where} was burning lovely, then it flickered like somebody was blowing at it, and out.",
      "Dark, all of a sudden {where}. Smoke coming off the lamp. And then it lit again. Nobody lit it.",
      "The lamplighter's lamp {where}. Out, with a curl of smoke, right as you passed. Like it knew you.",
      "Flicker, flicker, out. {Where}. And everything round it went cold.",
      "I was walking under the lamp {where} and it went out over my head like a snuffed candle.",
      "It came back on by itself, that lamp {where}. Sputtering, like it was catching its breath.",
      "The lamp {where} went out when you went by. Didn't it? Didn't it?",
      "Out went the lamp {where}, and in the dark I could have sworn someone was standing under it.",
      "That lamp {where} was out long enough for me to count to five, and I didn't like any of the numbers.",
    ],
    take: {
      deny: [
        "Bad oil. The lamplighter's been buying cheap oil. I'll have a word.",
        "A draught. Lamps go out. That's what lamps do. Then they come on. That's... also what they do.",
        "Nothing unusual about a lamp. They're very usual. Most usual things in the city.",
      ],
      shaken: [
        "If the lamps won't stay lit, what will? What's left?",
        "I ran home in the dark from the lamp to the next lamp, and counted every step.",
        "The lamplighter says he never had a lamp do that. He looked frightened. He's never frightened.",
      ],
      hushed: [
        "Something cold went by under it. Lamps go out for cold things. Everyone knows that, nobody says it.",
        "Lights in the dark, Ismay said. Lights moving in the wood. Now lights going out in the town. You see?",
        "Somebody snuffed it. Somebody who likes the dark better. And then they let it go again. Playing.",
      ],
      defiant: [
        "Every lamp in the city could go out and the King would only notice when he tripped.",
        "They spend gold on lamps so nobody can do anything in the dark. And look. Something does anyway.",
        "Good. Let it be dark. Folk talk more in the dark.",
      ],
      informer: [
        "I've reported the lamp. And the lamplighter. And the oil merchant. Someone's to blame.",
        "A lamp going out after curfew is very suspicious. Who benefits? I'm asking you.",
        "You were by the lamp. I'm only saying. For the record.",
      ],
    },
    again: [
      "I carry a candle now, in case the lamps go again. And a spare. And flint.",
      "That lamp's been burning fine ever since. Too fine. Like it's pretending.",
      "I don't walk under lamps any more. Beside them. Never under.",
      "Has any lamp gone out on you again? Don't tell me which.",
    ],
    kid: [
      "The lamp went out and came back like a winky eye.",
      "The lamp went BLINK and I went RUN.",
      "There was smoke and it smelled like a birthday candle. A sad one.",
      "I think the lamp was scared too.",
    ],
  },
  well: {
    saw: [
      "The well {where}. Whispering. Voices coming up out of it, little ones, saying things.",
      "I heard it say \"down here\". The well {where}. Down here! Who'd be down there?",
      "There was mist coming up out of the well {where}, a breath at a time, and every breath had words in it.",
      "The well {where} was talking. Not echoing. Talking. It said \"don't say it\".",
      "I went to draw water {where} and the water was whispering. I've not drunk a drop since.",
      "Voices out of the well {where}, soft as anything, like people talking in the next room under the floor.",
      "It said something about the Crown. Under the Crown. The well {where} knows what's said under the Crown!",
      "{Where}, the well breathed out mist and said \"she saw them\". Clear as I'm saying it.",
      "Little stone, it said. Out of the well {where}. Little stone. Is that you? It was looking at you.",
      "I put my ear to the well {where}, like a fool. It said it was warm down there. Wells aren't warm.",
    ],
    take: {
      deny: [
        "Wells gurgle. It's well known. Everyone knows wells gurgle words. Gurgles, I mean.",
        "Nothing under this city but foundations and the King's good law.",
        "I've had the well looked at. There's water in it. That's all there is in it. Water.",
      ],
      shaken: [
        "What's under us? What's been under us all this time, listening?",
        "I'll not drink from it again. I'll drink ale. I'll drink only ale. For safety.",
        "It knew things. Things that were said in kitchens, with the door shut.",
      ],
      hushed: [
        "There's old places under St Mary's. Older than St Mary's. Everyone says the crypt's locked. Nobody says why.",
        "It's warm down there, it said. The old lady up the hill sleeps warm. Don't you repeat that.",
        "They're coming back, it said. You heard it. I'm not the only one who heard it.",
      ],
      defiant: [
        "Even the wells won't keep quiet any more. Let's see the Marshal arrest a well.",
        "The Edict's for people. Seems nobody told the water.",
        "If the wells are talking, I'm talking too. She saw them. There. I said it.",
      ],
      informer: [
        "Seditious water. I'm reporting it. Somebody has to.",
        "I wrote down every word it said. The Marshal didn't want them. I'll keep them for him.",
        "You were standing by the well when it spoke. That's twice now you've been near something. I'm only noting it.",
      ],
    },
    again: [
      "Has the well said anything else? I'm not asking for me. A friend's asking.",
      "I lean over every well I pass now, just to listen. I can't stop.",
      "We've put a lid on the well. A heavy one. It still feels like it's listening.",
      "Down here, it said. I wonder what's down there. No. I don't.",
    ],
    kid: [
      "The well can TALK. It said a secret but I'm not allowed to tell you.",
      "I shouted hello down the well and it whispered back. Not hello. Something else.",
      "There's people living in the well and they're very quiet people.",
      "The well breathed on me. It was a cold breath.",
    ],
  },
  curfew: {
    saw: [
      "A bell, ringing nine. Little one, far off toward the river. St Mary's was dark.",
      "Did you hear the bell? Ting, ting, nine of them. Not from the church. From the river.",
      "A handbell ringing the curfew. Nobody rings the curfew with a handbell. Not since Ismay.",
      "Nine strokes, {where}, coming up the street from the water. Little and thin and cold.",
      "I heard nine rung, and the great bell of St Mary's never moved. I was watching the tower.",
      "That little bell, ringing nine. You could see it ring, almost. Rings in the air coming up off the river.",
      "It rang nine {where}. I know that bell. Everyone over forty knows that bell.",
      "Ismay's bell. Ringing the curfew from somewhere wet. I counted nine.",
      "Ting. Ting. Nine of them, and every one came up the street at us like a ripple in a pond.",
      "The curfew rang twice that night: once from the tower, once from the river. Only one of them had a ringer.",
    ],
    take: {
      deny: [
        "It was the bridge watch. They have a bell. Probably. They should have one.",
        "Bells ring at nine. That's what nine's for. Perfectly ordinary nine o'clock.",
        "There's no such person as Ismay Tollen. There never was. I've been told very clearly.",
      ],
      shaken: [
        "She rang that every night for forty-one years. My mother set the bread by it.",
        "If her bell's ringing, where is she? Is she coming home?",
        "I went in the moment I heard it. I always go in at nine. I went in faster.",
      ],
      hushed: [
        "They threw her bell off the bridge, after her. Everyone knows. Nobody knows. You know.",
        "She rang the alarm and they quieted her. And her bell's still ringing it. Isn't that something.",
        "Somebody should fish that bell up and take it home to her. Somebody brave. Somebody not from here.",
      ],
      defiant: [
        "Ring it louder, Ismay. Ring it till they all wake up.",
        "She saw the lights in the wood and she rang the bell, and they killed her for it. And she's still ringing it. Good.",
        "That's the real curfew. Not the Marshal's. Hers.",
      ],
      informer: [
        "Ringing a bell without a licence. After curfew. At curfew. It's complicated, but it's an offence.",
        "I've told the Marshal about the bell. He went very pale and told me to go home.",
        "Bells don't ring themselves. Someone's ringing it. You were out. I'm just saying you were out.",
      ],
    },
    again: [
      "Did you hear it again? The little bell? I lie awake at nine waiting for it.",
      "I set my bread by the little bell now. Don't tell anyone.",
      "Nine o'clock comes round and I go cold. Every night.",
      "Someone ought to give that bell back to her. I keep saying. Nobody listens.",
    ],
    kid: [
      "A bell was ringing in the river! Can bells swim?",
      "It went ting ting ting ting ting ting ting ting ting. That's nine. I counted on my fingers.",
      "Gran cried when she heard the little bell. Then she said she didn't.",
      "It's the ghost lady's bell! She wants it back! Everyone knows that.",
    ],
  },
};
