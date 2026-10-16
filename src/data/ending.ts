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
