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

/**
 * The credits: short shots of this run, in the places it happened (src/game/credits.ts), each with a line under it.
 * A shot only plays if the run got there; some lines change with what else it did.
 */
export type ShotId = "woke" | "king" | "barricade" | "yssa" | "cinder" | "rime" | "ringer" | "calder"
  | "greyed" | "slimes" | "chronicle" | "eggs" | "milk" | "fells";
export const SHOT_SAYS: Record<ShotId, string> = {
  woke: "You woke on a stone by the Ranger's fire, with nothing but a note in your hand.",
  king: "King Osric read the Ranger's note, went very red, and sent you deep into the Witchwood after Calder.",
  barricade: "The woodwardens read the watchword off your scrap of paper, and stepped aside.",
  yssa: "Yssa wouldn't let anyone by who didn't know her name. You wrote it down.",
  cinder: "Cinder fell in the Ashwild. At the last the grey went out of him, and he said he was sorry.",
  rime: "Out on the frozen lake, Rime sang a line about the river Aurel as she fell, and the ice let go.",
  ringer: "One night in St Mary's churchyard, you laid the Grey Ringer to rest.",
  calder: "At the edge of the great crack Calder looked at you and said, \"Oh. He sent you. Good.\" Then the crack ground shut.",
  // And what it meant (HERO.md, "The end"): the aftermath, after his own story's told.
  greyed: "With no one left to follow, the grey went out of the Greyed, one by one.",
  slimes: "The slimes sat still at last. Within the year they were the people of the Deep Hall again.",
  chronicle: "Next morning the King read the true chronicle at the market cross, went very red, and tore up the Edict.",
  eggs: "The Vael came north over the King's Bridge, openly, for the first time in six hundred years, and this time the King gave them back their eggs. Under the Greyspines, beside their mother, three small dragons hatched, and the valley was whole again.",
  milk: "Yssa let the frost go, set a bowl of milk at the foot of the fountain, and stayed.",
  // And last, his own ending: what the King's "anything Aurenmark can give" came to.
  fells: "You never asked the King for a thing. The Ranger came home, Meg took his cloak in, and one lantern in the window was yours.",
};
/** Said instead, or after, when the run went that way. */
export const SHOT_SAYS_TOO = {
  /** After the chronicle, by how many followed him up the hill with the head: nobody, a few, or a crowd. */
  followed: {
    none: "",
    few: "The few who'd followed you had the best places.",
    crowd: "Half the city had followed you up. The rest came to hear.",
  },
  bow: "You kept your distance with the hunter's bow. Rime sang a line about the river Aurel as she fell, and the ice let go.",
  koi: "And down under the ice, you landed the Great Koi.",
} as const;

/**
 * How the credits run (s): the dark before them, each shot's fade in and out, how long each shot is at the least, how
 * many words a second its line can be read at (a long line holds its shot longer), and The End held before the card.
 */
export const CREDITS_TIME = { dark: 1.4, fade: 0.9, shot: 7.5, read: 3, end: 3 } as const;
/** How many have to follow him up for it to be a crowd. */
export const CROWD_OF = 5;

/** Under The End: how this run went. */
export const RUN_SUMS = { level: "Level {n}", kills: "{n} foes beaten", curios: "{n} curiosities found", curio: "1 curiosity found" } as const;

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
  ],
  donate: "If you'd like to donate, 100% of anything you give goes back into improving the game.",
  donateUrl: "https://buymeacoffee.com/domab",
  donateLabel: "buymeacoffee.com/domab",
  ask: "Got feedback? I'd love to hear it.",
  webhook: "https://discord.com/api/webhooks/1560559001291464735/OIDDAJ4Z7aU-QJIDK-vXtZ3T_IVmGNyFAGX8v8b4S1ek2bZjXMkv-g0vT5-PdSHRpQIr",
  /** The most one message can say, and how many one player can send. */
  longest: 1500, most: 3,
} as const;
