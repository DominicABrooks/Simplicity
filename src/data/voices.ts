// How the people of Kingsholm talk. Everyone has a voice, from their personality (warm, gruff, shy,
// chatty, dreamy or plain), and a handful of things they might talk about: their work, their family,
// their quirks, the city, the hero in front of them, the Edict, and only now and then a rumour. The lines
// are put together in src/game/conversation.ts. Placeholders: {name} the speaker's first name, {work}
// what they do in their own words ("I'm a baker"), {q} their quirk in their own words ("I collect
// buttons"), {kin} a housemate's first name, {rel} what they are to the speaker ("wife", "son"), {kwork}
// what the housemate does ("is a baker"), {kq} the housemate's quirk ("Tom collects buttons"), {said} a
// rumour about the speaker's own family.

import type { GiftKind } from "./items.ts";

export type Voice = "warm" | "gruff" | "shy" | "chatty" | "dreamy" | "plain";

/** Which voice a personality trait gives. The first trait that has one decides. */
export const VOICE_OF: Record<string, Voice> = {
  cheerful: "warm", jolly: "warm", kind: "warm", generous: "warm", gentle: "warm", polite: "warm", hopeful: "warm",
  "warm-hearted": "warm", "kind-hearted": "warm", easygoing: "warm", loyal: "warm",
  grumpy: "gruff", stubborn: "gruff", impatient: "gruff", sarcastic: "gruff", bossy: "gruff", proud: "gruff",
  gloomy: "gruff", stingy: "gruff", vain: "gruff", grand: "gruff", outspoken: "gruff",
  shy: "shy", quiet: "shy", nervous: "shy", careful: "shy", discreet: "shy", worried: "shy", anxious: "shy", jumpy: "shy", watchful: "shy",
  chatty: "chatty", nosy: "chatty", curious: "chatty", loud: "chatty", competitive: "chatty", mischievous: "chatty", sly: "chatty", "eager to please": "chatty",
  dreamy: "dreamy", romantic: "dreamy", forgetful: "dreamy", thoughtful: "dreamy", superstitious: "dreamy", gullible: "dreamy",
};

/** How they open: some don't bother. */
export const GREET: Record<Voice, readonly string[]> = {
  warm: [
    "Oh, hello! Lovely to see a new face.", "Well, aren't you a sight. Hello!", "Hello, little one!", "Morning! Or is it afternoon already?",
    "There you are. I was hoping someone would stop for a chat.", "Hello, hello!", "Oh, you're sweet. Hello.", "Good to see you, friend.",
    "You look like you could use a friendly face.", "Hello there! Don't be shy.",
  ],
  gruff: [
    "What.", "Yes? What is it?", "Make it quick.", "Oh. It's you. Whoever you are.", "I'm busy. Well, go on then.", "Hm.",
    "If you're selling something, I'm not buying.", "Don't stand so close.", "You again? No, wait. I've never seen you.", "Out with it.",
  ],
  shy: [
    "Oh! Um. Hello.", "Sorry, were you... talking to me?", "H-hi.", "Oh, goodness, you startled me.", "Hello... I don't usually talk to strangers.",
    "Um, can I help? Probably not. But hello.", "Oh. Hi. Sorry.", "...Hello?", "Is something wrong? No? Oh. Hello, then.",
  ],
  chatty: [
    "Oh, finally, someone to talk to!", "Hello! Have you heard? No? Well, let me tell you.", "Ooh, you're new. Where are you from? Never mind, I'll talk.",
    "Hello, hello! Sit down. Well, stand. Whatever you like.", "Look at you! I've been dying to meet you.", "Psst. Yes, you. Come here.",
    "Hello! I was just saying to myself, I need someone to talk to.", "There's a face I don't know. I know everyone's face.",
  ],
  dreamy: [
    "Oh... hello. I was miles away.", "Hm? Oh, hello.", "Did you hear that? No? Hello, anyway.", "You have very glowy eyes. Hello.",
    "Hello. I think. Yes, hello.", "Oh, a visitor. How nice.", "Have we met before? I feel like we've met before.",
  ],
  plain: [
    "Hello.", "Afternoon.", "Hi there.", "Oh, hello.", "Can I help you?", "All right?", "Hello, stranger.", "Busy day. Hello, though.",
  ],
};

export const BYE: Record<Voice, readonly string[]> = {
  warm: ["Come back any time!", "Take care of yourself, now.", "It was lovely talking to you.", "Mind you eat something!", "Off you pop. Be safe.", "Don't be a stranger."],
  gruff: ["Right. Off you go.", "That's enough talking.", "I've got work to do.", "Go on, shoo.", "Don't let me keep you.", "We're done here."],
  shy: ["Um. Bye, then.", "Sorry. I'll go now.", "It was nice... talking. Bye.", "Oh, I should go.", "Bye!", "I'll just... go. Bye.", "Thanks for listening. Nobody usually does."],
  chatty: [
    "Oh, look at the time! Come back and I'll tell you the rest.", "Tell everyone I said hello! Well, maybe not everyone.", "Don't go far, I've got more stories!",
    "Lovely chat. Mostly me, but lovely.", "Come back tomorrow, I'll have heard something new.", "Ooh, I've just thought of something else. Never mind, next time!",
    "You're a wonderful listener, you know that?", "Must dash. Someone else needs to hear all this.",
  ],
  dreamy: ["Where was I going? Oh, right. Bye.", "Watch the sky. You never know.", "Goodbye, glowy eyes.", "I'll remember you. Probably.", "Sweet dreams. It's not night, is it? Oh well.", "Off you float."],
  plain: ["See you around.", "Right, I'd better get on.", "Bye, then.", "Take care.", "Good luck."],
};

/** Telling you who they are: `{name}` and their work. */
export const INTRO: Record<Voice, readonly string[]> = {
  warm: ["I'm {name}, dear. {work}.", "Everyone round here knows me. I'm {name}! {work}.", "Call me {name}. {work}, and I love it."],
  gruff: ["Name's {name}. {work}. Busy.", "{name}. {work}. Happy?", "I'm {name}. {work}, which is why I haven't got time for this."],
  shy: ["I'm... {name}. {work}.", "Um, {name}. That's me. {work}.", "My name's {name}. {work}. It's not very interesting."],
  chatty: ["I'm {name}! {work}, and let me tell you, it's never dull.", "{name}, that's me! {work}. Ask me anything.", "Everyone knows me! I'm {name}. {work}, among other things."],
  dreamy: ["I'm {name}. {work}, mostly.", "{name}... yes, that's my name. {work}, I think.", "They call me {name}. {work}, when I remember to."],
  plain: ["I'm {name}. {work}.", "{name}. {work}.", "Name's {name}. {work}, round here."],
};

/** Their quirk, said by themselves: `{q}` is "I collect buttons". */
export const QUIRK: Record<Voice, readonly string[]> = {
  warm: ["Funny thing about me: {q}.", "{q}. My family thinks it's sweet.", "Can I tell you a secret? {q}."],
  gruff: ["{q}. What of it?", "{q}. Don't laugh.", "Yes, {q}. Everyone has something."],
  shy: ["Um, {q}. Sorry, that's a strange thing to say.", "{q}. Don't tell anyone.", "I suppose... {q}."],
  chatty: ["Did you know {q}? It's true!", "Ooh, here's something about me: {q}.", "People always say I talk too much, but they never mention that {q}!"],
  dreamy: ["{q}. I've always wondered why.", "Sometimes I think {q}. And sometimes I just do it.", "{q}. Doesn't everyone?"],
  plain: ["{q}, for what it's worth.", "{q}. Always have.", "Not many people know {q}."],
};

/** Somebody in their household: `{rel}` is what they are to the speaker, `{kin}` their first name. */
export const KIN: readonly string[] = [
  "My {rel}, {kin}, {kwork}.", "Have you met my {rel}? {kin}. {kin} {kwork}.", "{kin}'s my {rel}. Don't tell {kin} I said so, but {kq}.",
  "If you see my {rel} {kin}, say hello.", "My {rel} {kin} {kwork}. I'm very proud. Don't tell {kin}.",
  "I live with my {rel}, {kin}. {kin} {kwork}, and {kq}.",
];

/** What they say about work, by what their job contains. The first match wins; `any` if none does. */
export const WORK: readonly [RegExp, readonly string[]][] = [
  [/bak|bread/, ["Up before dawn, every day. The ovens don't light themselves.", "Three cuts on every loaf. For luck. Don't ask.", "If you smell burning, it isn't mine."]],
  [/butcher/, ["Best sausages in the city. Don't believe the other shop.", "Mind your fingers near my counter.", "The good cuts go early. Come back at dawn."]],
  [/cook|kitchen|pot-boy/, ["Peel, chop, stir, scrub. Peel, chop, stir, scrub.", "If the soup's good, I made it. If it isn't, someone else did.", "I've burned myself on every pot in the place."]],
  [/guard|soldier|archer|watch|captain|sergeant/, ["Long shifts. Cold feet. Good pay, though.", "Nothing's happened on my watch yet. Fingers crossed.", "My spear arm aches from standing about."]],
  [/mason|carver/, ["Stone dust in everything. My hair, my food, my bed.", "St Mary's spire took forty years. I did the last four.", "Every stone I lay gets my mark on it."]],
  [/fish/, ["The fish are swimming north early this year. Odd.", "Best spot is under the King's Bridge. Don't tell anyone.", "My hands smell of river, and they always will."]],
  [/laund|wash/, ["Other people's dirty shirts. All day.", "I know everyone's secrets. You'd be amazed what's in a pocket.", "Lovely drying weather today. For once."]],
  [/carter|porter|carri|water/, ["Up and down this hill all day long.", "My back's not what it was. Neither's the cart.", "Heavy load today. Heavy load every day."]],
  [/merchant|mercer|draper|goldsmith|wool|spice|wine/, ["Business is slow since the south road closed.", "Prices are up, buyers are down. Don't get into trade.", "I've got a lovely bolt of red cloth, if you're interested. No? Pity."]],
  [/clerk|scrivener|notary|lawyer|proctor|alderman/, ["Forms, forms, forms. This city runs on ink.", "If it's not written down, it didn't happen.", "My fingers are blue from ink. Permanently."]],
  [/priest|dean|deacon|choir|chaplain|clergy/, ["The bells don't ring themselves. Well, they nearly do.", "More candles than ever lately. People are worried.", "Come to the service on Sunday. There's cake after."]],
  [/smith|armourer|farrier|fletcher|bowyer|harness/, ["Hammer, heat, hammer, heat. Lovely work.", "We've never been so busy. Arrows, mostly.", "Mind the sparks."]],
  [/potter|pottery/, ["Clay under my nails since I was six.", "The kiln's been acting strange lately. Friendly, though.", "Every pot I make, I break one. Balance."]],
  [/weav|spin|sew|seamstress|tailor|lace|glov|shoe|saddl|dyer|tanner/, ["Needle and thread, thread and needle.", "I made the coat on that man's back. And that one's.", "Good work takes time. Bad work takes longer."]],
  [/maid|footman|manservant|nurse|valet|page|chamber|servant|cupbearer/, ["The house doesn't clean itself. Shame.", "I serve a good family. Mostly good.", "Fetch this, carry that. You get used to it."]],
  [/apprentice|journeyman/, ["I'll be a master one day. Just you watch.", "My master says I'm getting better. Slowly.", "I do all the boring bits. That's how you learn, apparently."]],
  [/retired|pension/, ["I've earned my rest. My knees agree.", "Back in my day, the bread was cheaper and the winters were worse.", "I don't work now. I supervise. From this bench."]],
  [/pilgrim|travel|peddler|tinker|minstrel|storyteller|from /, ["Long road to get here. Worth it, for the bridge alone.", "I'm only passing through. Lovely city, though. Very shiny.", "Where I'm from, nobody's ever seen a lion made of gold."]],
  [/lamplighter|sweep/, ["I've been up every chimney in this city.", "Lamps at dusk, chimneys by day. I never stop.", "Sound carries up a chimney. You'd be amazed what I hear."]],
  [/flower/, ["Roses, two a penny. Rowan, a lot more.", "Everyone wants rowan these days. Nobody wants roses."]],
  [/falcon/, ["My birds won't fly south any more. I don't blame them.", "A falcon never lies. People do."]],
  [/storekeeper|store/, ["Flour, flour, more flour. Enough for a siege.", "I count sacks. I'm very good at it."]],
];
export const WORK_ANY: readonly string[] = [
  "Work's work. Pays for bread.", "Busy, busy. Always busy.", "It's honest work, and that's enough for me.", "Some days it's fine. Today it's fine.",
];

/** About where they are. */
export const PLACE: Record<string, readonly string[]> = {
  capital: [
    "The square's lovely in the morning, before the stalls open.", "Have you seen the fountain? The stone king's nose is famous.", "Don't eat at the Bell. Eat at the Crown.",
    "Every street in this city goes uphill. Both ways.", "The guildhall clock's been wrong for three years. Nobody fixes it.", "The Wallside's crowded, but we look after each other.",
    "St Mary's bells are too loud. I love them anyway.", "There are more horseshoes on doors this year than horses in the city.",
  ],
  castle: [
    "Living this close to the castle, you hear the guards changing all night.", "The King's flags are up. Means he's home.", "Mind the moat. It's deeper than it looks, and it smells.",
    "The castle storehouse is full to the roof. Nobody says why.", "You can hear the smithy from here. Clang, clang, clang.",
  ],
  kingsroad: [
    "Look at this bridge! Real gold on every post.", "Those lions on the bridge cost more than my whole village.", "The river's very fast here. Don't fall in.",
    "I counted the banners on the bridge. Forty-two.",
  ],
};

/** About the city and the season, from anyone. */
export const CITY: readonly string[] = [
  "Founder's Night's coming. They're making the straw witches twice as big this year.", "Gilding Day was beautiful. Gold on everything. Again.",
  "Bread's gone up a penny. Again.", "The south road's still closed. Nobody will say why.", "Have you tried a three-cut loaf? Supposed to be lucky.",
  "The King's building something new, I hear. Or paying for the last thing.", "Lantern Night's my favourite. The whole city glows.",
  "Have you seen what rowan costs now? More than roses. Ridiculous.", "My cousin went south last spring and hasn't written since.", "The slimes are thick this year. Ugh.",
  "There's a sheep on the square that stares at people. Have you seen it?", "Old Mother Larke sold me some salt for my windowsills. Just in case.",
  "They say the Ranger's back. They also say he isn't.", "The Crown's pies are worth every penny.",
];

/** About the hero: a small stone figure in bark who never says a word. */
export const HERO: readonly string[] = [
  "You don't say much, do you?", "Is that bark you're wearing? Very... rustic.", "You've got lovely eyes. Very glowy.",
  "You're a quiet one. I like that. Most people won't stop talking.", "Are you lost? You can just nod. Or not.",
  "You look like you've walked a long way.", "Where did you come from? The wood? Nobody comes from the wood.",
  "Stone, are you? Me too, under all this. We all are, my gran used to say.", "You could do with a good meal, I think.",
  "I won't ask what you're doing here. You wouldn't answer anyway, would you?",
];

/** About the Edict of the Quiet Tongue, by where they stand on it. */
export const EDICT: Record<string, readonly string[]> = {
  denies: ["Witches? Dragons? Fairy tales, all of it.", "There's nothing in that wood but trees."],
  loyal: ["The King knows best. Long live the King.", "The Edict keeps people calm. Good thing too.", "Rules are rules. Even about talking."],
  quiet: ["I keep my head down and my mouth shut. Safest that way.", "Best not to talk about... you know. The weather."],
  whispering: ["They say there's red weather down south. You know what I mean.", "Mind the weather. That's all I'll say."],
  defiant: ["The Edict? Nonsense. People should be able to say what they've seen.", "They can't lock up the whole city for talking."],
  informer: ["Heard anything interesting lately? You can tell me. I won't tell a soul.", "Funny, the things people say when they think nobody's listening."],
};

/** Leading into a rumour, which follows in quotes. Rare: most people have better things to talk about. */
export const RUMOUR: readonly string[] = [
  "You didn't hear it from me, but...", "Don't repeat this, but they're saying...", "Heard this down at the Crown last night:", "My neighbour swears it's true:",
];

/** Named families talking about themselves: what the city says about them. */
export const ABOUT_US = {
  /** About the family: the rumour as the city says it. */
  lead: ["People say \"{said}.\"", "You've probably heard \"{said}.\"", "Everyone's always saying \"{said}.\""],
  /** About the speaker themself: the rumour turned round ("I'm a tattletale"), so nobody names themselves. */
  self: ["People say {said}.", "Apparently {said}.", "You've probably heard {said}.", "Word is {said}."],
  true: ["Well. It's true.", "...I won't deny it.", "Guilty."],
  false: ["Rubbish.", "Not a word of truth in it.", "As if!"],
  half: ["Sort of.", "It's more complicated than that.", "Half of it's true. I won't say which half."],
} as const;

/** Children have their own way of talking. */
export const KID = {
  /** The very little ones. */
  tiny: ["Ba!", "*stares at you*", "Hehe!", "Doggy?", "No.", "*waves*"],
  greet: ["Hi!", "Hello! Are you a knight?", "Mum says I'm not to talk to strangers. Hello though.", "Whoa. You're made of stone!", "Hi! Want to see a trick?", "Are you lost too?"],
  intro: ["I'm {name}. I'm {age}.", "My name's {name} and I'm {age}. Nearly {next}.", "I'm {name}! I'm {age}, which is very old actually."],
  talk: [
    "I can run faster than you. Probably.", "I climbed the fountain once. Nearly.", "My friend says slimes are made of jam. They're not. I checked.",
    "I'm going to be a knight. Or a baker. Or a knight who bakes.", "Do you want to see my stick? It's a good stick.", "There's a sheep on the square that looks at me funny.",
    "I'm not scared of the dark. Much.", "When I grow up I'm going to have a dragon.", "I found a shiny stone. It's mine. You can look at it.",
    "Song school's boring. We just sing the same song.", "My gran says if you pull a face the wind will change and you'll stay like that. Is that what happened to you?",
  ],
  bye: ["Bye!", "I have to go. Mum's calling.", "Race you! ...Never mind.", "Bye, stone person!"],
} as const;

/** Guards: each one their own sort, picked per conversation. */
export const GUARD = {
  greet: [
    "Hello there.", "Can I help you?", "Move along, nothing to see. Oh, you want something?", "Behave yourself. The King's law applies here.",
    "Yes? Make it quick, I'm on watch.", "Halt! Oh, you're tiny. Never mind. What is it?", "Stand still, let me look at you. Fine. What do you want?",
    "On duty. Talk while I watch.", "Oh, thank goodness. Someone to talk to. Twelve hours of nothing.",
  ],
  post: {
    kingsroad: [
      "Welcome to Kingsholm. Keep to the bridge, the Aurel is deeper than it looks.", "Every cart over this bridge pays the King's toll. Every one.",
      "Those lions are real gold, they say. Touch them and you'll find out how real my spear is.", "Best view in the kingdom, this bridge. Worst wind, too.",
      "Southgate's just up there. Wipe your feet.",
    ],
    capital: [
      "The market opens at the first bell. Pay your stall fees and nobody gets hurt.", "Keep your purse close in the square. There are pickpockets about.",
      "Castle Street runs north, up to the King's gate. They won't let just anyone in.", "No running on the high street. It's a rule. Probably.",
      "If you see a sheep on the square acting strange, leave it alone. Long story.",
    ],
    castle: [
      "This is the King's courtyard. Keep your sword put away near the keep.", "Want to hit something that can't hit back? The yard's got a training dummy and archery targets.",
      "Twelve hours on this wall and not a thing has happened. Not that I'm complaining.", "The King's in a mood today. Tread softly.",
      "The cook's making stew. I can smell it from here. It's torture.",
    ],
    any: ["Long watch today.", "Keep out of trouble and we'll get along fine."],
  } as Record<string, readonly string[]>,
  duty: [
    "My boots are wet. They're always wet.", "The sergeant says I'm doing well. He says that to everyone.", "Twenty years I've been on this post. Feels like forty.",
    "I joined up for the uniform. Don't tell anyone.", "I'm not supposed to chat on duty. So this isn't chatting.", "Watch, watch, watch. That's the job.",
    "We've had orders to double the watch. Nobody says why.", "If you see anything strange, tell a guard. Not me. Another guard.",
  ],
  bye: ["Stay out of trouble.", "Off you go, then.", "Safe travels.", "Back to work.", "Move along now.", "I'll be watching. That's my job."],
} as const;

// ---------- Talking again ----------
// The more you talk to someone, the more they change. Most warm up: they thank you for stopping and tell
// you more about their lives. The gruff and impatient get fed up, and a few of them soften in the end.
// Placeholders as above, plus {place} the part of the city they live in, {trade} what they are ("a baker"),
// and {child} the first name of one of their children. A line whose placeholders they can't fill isn't said.

/** How someone takes being talked to again. */
export type Mood = "again" | "fond" | "annoyed" | "softened";

/** Knowing you on a second visit. */
export const AGAIN: Record<Voice, readonly string[]> = {
  warm: ["Oh, it's you again! Hello, love.", "Back already? I'm glad.", "There's my favourite quiet visitor.", "Hello again! I was hoping you'd come by."],
  gruff: ["You again.", "Back, are you.", "Oh. It's the rock.", "I remember you. Unfortunately."],
  shy: ["Oh, it's you. Hello again.", "Hi... I remember you.", "You came back? Oh. That's nice.", "Hello again. You're the quiet one."],
  chatty: ["You're back! Wonderful, I've got so much to tell you.", "Oh good, you again! Where was I?", "My favourite listener returns!", "I was just thinking about you! Well, not really. But hello!"],
  dreamy: ["Oh, you again. I dreamt about you. Or someone like you.", "Hello again, glowy eyes.", "Have we met? Yes. Yes, we have.", "You're back. The stones said you would be."],
  plain: ["Hello again.", "Oh, it's you.", "Back again?", "You again. Hello."],
};

/** Warming up: glad you keep stopping by. */
export const FOND_OPEN: readonly string[] = [
  "You keep coming back to talk to me. Nobody does that. Thank you.", "I look forward to you stopping by, you know.", "It's nice, having someone who listens.",
  "Can I tell you something I don't tell many people?", "You're easy to talk to. Maybe because you don't talk back.", "I've been saving something up to tell you.",
  "Honestly, you're the best part of my day.", "Sit with me a minute. I've been thinking.",
];
/** Going deeper into their lives. */
export const DEEP: readonly string[] = [
  "I wasn't always {trade}. I wanted to be a sailor, once. Never even seen the sea.",
  "My {rel} {kin} doesn't know this, but I worry about money all the time.",
  "Some nights I sit up on the wall and just look south. I don't know what for.",
  "When I was little, my gran told me stories about dragons. I used to want one. Now I'm not so sure.",
  "I lost my best friend to the fever, three winters back. I still set a cup out for her.",
  "I'm saving up for something. A little house of my own, with a garden. Don't laugh.",
  "Sometimes I think I'd be braver if I didn't have so much to lose.",
  "My {rel} {kin} and I had a terrible row last week. Over turnips, of all things. We made up.",
  "I've lived in {place} all my life. Every stone of it. I'd miss it terribly if I had to go.",
  "I keep a little box of letters from my mother. I read one every Lantern Night.",
  "I'm frightened of what's in the wood. There, I've said it. Don't tell the Marshal.",
  "I used to sing at the Crown, before. I don't know why I stopped.",
  "I've never told anyone, but I can't read. I just nod along.",
  "I think about leaving the city sometimes. Then I smell the bakery in the morning and I stay.",
  "My hands ache most days. Too many years of this work. But they still work.",
  "I made a promise to my father that I'd look after the family. Some days it's heavy.",
  "When the bells ring at night, I count them, just in case they mean something.",
  "I'd like to see the Vael, you know. The real ones. I bet they're not so different from us.",
  "I'm happiest early in the morning, before anyone needs anything from me.",
  "The day {child} was born was the best day of my life. Don't tell {child}, it'll go to their head.",
];
/** Thanks, on the way out. */
export const FOND_BYE: readonly string[] = [
  "Thank you for listening. Really.", "Come back soon, won't you?", "I feel better for that. Thank you.", "You're a good friend, little stone.",
  "Same time tomorrow?", "Don't be a stranger. You never are.",
];

/** Fed up: worse each time, from `[0]` (mild) to `[3]` (done). */
export const ANNOYED: readonly (readonly string[])[] = [
  ["Again? I've already told you everything.", "What now?", "You know, some of us have work to do.", "Didn't we just do this?"],
  ["Please. I'm busy.", "You're starting to worry me.", "Is something wrong with you? Blink twice if yes.", "I'm not saying it again."],
  ["Go away.", "No. Whatever it is, no.", "I'm going to start charging you.", "Stop. Following. Me."],
  ["...", "*pretends not to see you*", "I'm not here.", "*sighs very loudly*"],
];
/** The gruff, after enough visits: grudgingly fond. */
export const SOFTENED: readonly string[] = [
  "Fine. You're all right, you know. For a rock.", "I suppose I'd miss you if you stopped coming. Don't tell anyone.",
  "All right. Sit. I'll tell you something, but just one thing.", "You're stubborn. I like that. Don't let it go to your head.",
];

/** Children, again and again. */
export const KID_AGAIN = {
  again: ["You came back! Want to play?", "It's the stone person! Hi again!", "I told my friends about you. They don't believe me."],
  friend: ["You're my best friend now. Don't tell anyone.", "When I grow up I'm going to be quiet like you. Mum says that'll be the day."],
} as const;

/** Guards on the same post, again. */
export const GUARD_AGAIN = {
  again: ["You again? Fine. Still on watch.", "Back to keep me company? Good.", "Ah, my little friend. Quiet watch today."],
  personal: [
    "My wife says I talk to you more than I talk to her. She's not wrong.", "I've got a little girl at home. She'd love you.",
    "Between us, I hate heights. They put me on the wall anyway.", "I was a baker before this. Better hours. Worse pay.",
  ],
  annoyed: ["Move along. Seriously.", "I'm on duty. Shoo.", "Unless you've got a message from the captain, off you go.", "Don't make me call the sergeant."],
} as const;

// ---------- Gifts ----------
// Lines that hand the hero something. Each is tagged with what it gives, and the item lands in the bag as
// the line is said (see src/game/talk.ts). Someone only says one if they haven't given the hero anything
// yet and there's room for it in the bag. No other line may offer anything (tests/gifts.test.ts checks).

/** A line that hands the hero `gives`. */
export interface GiftLine { say: string; gives: GiftKind }

export const GIFT = {
  /** From their work, by what their job contains, as WORK. The first match wins. */
  work: [
    [/bak|bread/, [
      { say: "Here, take a loaf. Still warm. Three cuts on top, for luck.", gives: "loaf" },
      { say: "Have this loaf. Go on, I baked too many again.", gives: "loaf" },
    ]],
    [/cook|kitchen|pot-boy/, [{ say: "Here, have some bread from the kitchen. Nobody will miss it.", gives: "loaf" }]],
    [/fish/, [
      { say: "Here, have a koi. Caught it this morning.", gives: "koi" },
      { say: "Take this koi. It's a small one, but it's fresh.", gives: "koi" },
    ]],
  ] as readonly (readonly [RegExp, readonly GiftLine[]])[],
  /** From the warm-hearted, once they know you. */
  fond: [
    { say: "You never eat, do you? Here, take this bread.", gives: "loaf" },
    { say: "I saved you a loaf. Here. Don't argue.", gives: "loaf" },
  ] as readonly GiftLine[],
  /** From a child who thinks you're their friend. */
  kid: [
    { say: "I saved you a shiny stone. Here, it's yours now.", gives: "stone" },
    { say: "This is my second-best stone. You can have it.", gives: "stone" },
  ] as readonly GiftLine[],
  /** From a guard who's got used to you. */
  guard: [{ say: "Here, take this bread. The cook's spare. Don't tell the sergeant.", gives: "loaf" }] as readonly GiftLine[],
};

/** What each gift line hands over, by the line itself: how a conversation knows a line is a gift. */
export const GIFT_OF: ReadonlyMap<string, GiftKind> = new Map(
  [...GIFT.work.flatMap(([, lines]) => lines), ...GIFT.fond, ...GIFT.kid, ...GIFT.guard].map(l => [l.say, l.gives]),
);
