// The end of the story path (STORY.md, "0:55 The head, the King, the credits"; HERO.md, "The end"): with Calder gone the
// rift stone glows, and touching it wakes the hero at the fountain stone at dawn. The city stops and stares at the
// little stone figure carrying a stone head up the high street, and by Castle Street a crowd is following him. On the
// keep steps he sets the head at the King's feet, the King has his say, and the credits roll over how it all ends.

/** The way home: the hour he wakes at the fountain stone (dawn, the city just waking), and what's said. */
export const HOMECOMING = {
  dawn: 6,
  glows: "The rift stone glows brighter than any stone has before",
} as const;

/**
 * The walk up: how near (px) someone has to be to stop and stare at him; how likely each grown-up who's stared is to
 * fall in behind him once he's past, and the most who follow; how they walk behind him (px: how far back the first row
 * is, row to row, side to side, and how many to a row); how often (s) one of them says something.
 */
export const CROWD = {
  stare: 64, join: 0.75, most: 15,
  back: 12, row: 8, side: 7, perRow: 3,
  /** Their pace (px/s): keeping up, and catching up when they've fallen behind. */
  pace: 40, hurry: 60,
  remark: 2.2,
  /** How busy the streets get while he carries it through them, however early it is (a share of the busiest). */
  waking: 0.75,
} as const;

/** What people say, seeing him go by with it. */
export const STARE_SAYS: readonly string[] = [
  "Is that... a head?",
  "Look what it's carrying!",
  "Mercy on us.",
  "It's going up to the castle!",
  "That's the stone child. The one that went to see the King.",
  "Fetch your father!",
  "Is it... him?",
  "It's got a face. The stone's got a face!",
  "Don't stare. ...I'm staring.",
];
/** And the children. */
export const STARE_SAYS_CHILD: readonly string[] = ["Is it a ball?", "Can I hold it?", "Mum! Mum, look!", "Ooh."];
/** The crowd behind him, now and then. */
export const CROWD_SAYS: readonly string[] = [
  "Where's it going?",
  "To the King, I'll bet.",
  "Keep up!",
  "Mind, mind, let me see!",
  "Who's that, then, the head?",
  "Somebody tell Quill.",
];

/**
 * Talking to people on his way up with the head, each as they stand on the Edict (src/world/people.ts): those who say
 * there are no witches, the King's loyal, the quiet, the whisperers, the defiant and the informers. Children have their
 * own, those already following him theirs, and the guards theirs.
 */
export const HEAD_TALK = {
  denies: [
    "That's a rock. A rock with a face. There are no witches, so that's a rock with a face.",
    "Whatever that is, it isn't what it looks like. It can't be. ...Can it?",
    "I don't know what that is and I'm not going to ask.",
  ],
  loyal: [
    "Is that for the King? Go on, then, he's up at the castle. Straight up Castle Street.",
    "Whatever it is, His Majesty will know what to make of it. Off you go.",
    "Stand up straight when you hand it over. He likes that.",
  ],
  quiet: [
    "...Is that who I think it is? No. Don't tell me. Just go on up.",
    "Oh. Oh, my. I'll walk a little way with you, if that's all right.",
    "I never said a word about him. Not once. ...Is it really over?",
  ],
  whispering: [
    "It's him, isn't it? The storm mage. I knew it. I told everyone and nobody listened.",
    "Psst. Is that HIM? It is. It's him! ...Why am I still whispering?",
    "I said there was one out there. Didn't I say? I said!",
  ],
  defiant: [
    "Ha! Look at that! Let's see Quill read THAT out at the cross!",
    "I knew someone would do it. Didn't think it'd be a little stone fellow, mind.",
    "No witches, they said. Tell that to him. Well. Tell it to his head.",
  ],
  informer: [
    "I'll be making a note of this. A full note. ...Could I have a closer look first?",
    "Carrying a head about the streets. There's probably a rule against that. There ought to be.",
    "Who do I even report this to? The King? You're going to the King. Never mind.",
  ],
  child: ["Is that a real head?", "Can I hold it? Please? I'll be careful!", "Does it bite?", "Mum! Mum, look what it's got!"],
  following: [
    "Don't mind me. I'm just walking this way. Same way as you. Coincidence.",
    "Go on, go on, we're right behind you!",
    "Half the street's following you, you know. Have you looked back?",
  ],
  guard: [
    "Is that... Right. Go on through. Straight up to the keep. Quickly.",
    "I'm not paid enough to ask what that is. Go on in.",
  ],
} as const;

/** And once the King's had his say on the keep steps, and the city knows: as they stand on it. */
export const AFTER_TALK = {
  denies: [
    "Well. I suppose I'll have to stop saying there aren't any witches. Weren't. Aren't now. You know what I mean.",
    "I was wrong. There. I've said it. Don't make me say it twice.",
  ],
  loyal: [
    "The King's to read the whole true chronicle at the cross. Takes a big man to go that red in public.",
    "Long live the King. And long live you, little stone fellow.",
  ],
  quiet: [
    "It's quiet out here now. The good kind of quiet.",
    "I slept all night last night. First time in a year.",
  ],
  whispering: [
    "We don't have to whisper any more! ...Sorry. Habit.",
    "I can say it out loud now. Witches. There were witches. And you saw them off!",
  ],
  defiant: [
    "No more Edict! I'm going to say \"witch\" all day. Witch. Witch witch witch.",
    "Told you so. Told everyone so. Feels wonderful.",
  ],
  informer: [
    "Nothing left to report. I'll have to take up a hobby.",
    "I've torn up my notes. Well. Most of my notes.",
  ],
  child: ["Did you really beat a wizard? Show me how!", "Is your arm stone all the way through?", "When I'm big I'm going to be made of stone too."],
  guard: ["Thank you. From all of us on the gate.", "Quiet watch, these days. I could get used to it."],
} as const;

/** On the keep steps: the King, out to see what all the noise is, looks at the head at his feet. */
export const KING_HOMECOMING: readonly string[] = [
  "(He looks at it for a long time.)",
  "...You did it.",
  "Then it's over. No more whispering. No more Edict. Quill can read something else at the cross on market day, for once.",
  "(He looks at the crowd that's followed you into the ward, and seems to make up his mind.)",
  "And I suppose I'd better tell them the rest.",
];

/** Talking to him afterwards. Each time the next one along. */
export const KING_AFTER: readonly string[] = [
  "Go and get some sleep. You look like you've been carrying a man's head up a mountain. Down one. You know what I mean.",
  "Anything Aurenmark can give, I said. Name it. ...Ah. Yes. Point at it, then.",
  "Eleven pages, the Founder's letter. Eleven. I'm going to go very red.",
];

/** Carrying the head into the Throne Room: not in here. */
export const KING_STEPS: readonly string[] = [
  "Is that... No. Not in here. Out on the steps, where they can all see it.",
];

/** Calder gone, but nothing to show for it: the King wants his proof. */
export const KING_NO_PROOF: readonly string[] = [
  "They say the storm's gone quiet over the Witchwood. They say a lot of things.",
  "I said bring me proof. Bring me proof.",
];

/** The credits: still pictures of how it all ends (HERO.md, "Where everyone ends up"), each with a line under it. */
export type Still = "chronicle" | "ranger" | "eggs" | "cards" | "turnip" | "lantern";
export const CREDITS: readonly { still: Still; says: string }[] = [
  { still: "chronicle", says: "King Osric reads the true chronicle at the cross, the Founder's letter and all. He goes very red." },
  { still: "ranger", says: "The Ranger walks home, to the house with the grey cloak at the window." },
  { still: "eggs", says: "The Vael come over the King's Bridge, openly and politely, and take their eggs home." },
  { still: "cards", says: "Yssa plays cards with Widow Crane every Thursday. Widow Crane cheats. Yssa lets her." },
  { still: "turnip", says: "Tam Appleby is not a sheep any more, and has been eating turnips ever since." },
  { still: "lantern", says: "And the Foreigner sleeps in the top room of the Fells' house, with a lantern of his own in the window." },
];

/** How the credits run (s): the fade to black before them, each picture's fade in and out, how long it's held. */
export const CREDITS_TIME = { dark: 1.6, fade: 1.2, hold: 5.5, end: 3 } as const;

/**
 * After "The End": who made it, a word from him, a way to chip in, and a box for feedback, sent to his Discord through
 * a webhook (src/ui/credits.ts). The webhook's URL is in the published page for anyone to read, so what's sent can't
 * ping anyone, is cut short, and each player can only send a few.
 */
export const END_CARD = {
  by: "Dominic Brooks",
  help: "with help from AI",
  note: [
    "I have no plans to ever monetize this game. It's a passion project.",
    "I've wanted to build something like this since I was a kid, and I still find it super cool that I finally have the resources to make it.",
  ],
  donate: "If you'd like to donate, 100% of anything you give goes back into improving the game.",
  donateUrl: "https://buymeacoffee.com/domab",
  donateLabel: "buymeacoffee.com/domab",
  ask: "Got feedback? I'd love to hear it.",
  webhook: "https://discord.com/api/webhooks/1560559001291464735/OIDDAJ4Z7aU-QJIDK-vXtZ3T_IVmGNyFAGX8v8b4S1ek2bZjXMkv-g0vT5-PdSHRpQIr",
  /** The most one message can say, and how many one player can send. */
  longest: 1500, most: 3,
} as const;
