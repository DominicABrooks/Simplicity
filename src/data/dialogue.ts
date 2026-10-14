// What people say when you talk to them. A conversation is a few lines, one after another: a greeting,
// something about where they are, a rumour from the city (see FAMILIES in src/world/people.ts), and a
// farewell. Lines are picked at random each time, so talking again gets you something new.

/** How close the hero must be to talk (px, centre to centre), and how far they can wander before it ends. */
export const TALK = { reach: 26, leave: 40, charsPerSecond: 60 } as const;

/** A guard's lines. */
export const GUARD_TALK = {
  greet: [
    "Hello there.",
    "Can I help you?",
    "Move along, nothing to see. Oh, you want something?",
    "Behave yourself. The King's law applies here.",
    "Yes? Make it quick, I'm on watch.",
  ],
  /** Something about their post, by area id; `any` for anywhere else. */
  post: {
    kingsroad: [
      "Welcome to Kingsholm. Keep to the bridge, the Aurel is deeper than it looks.",
      "Every cart over this bridge pays the King's toll. Every one.",
      "Those lions are real gold, they say. Touch them and you'll find out how real my spear is.",
    ],
    capital: [
      "The market opens at the first bell. Pay your stall fees and nobody gets hurt.",
      "Keep your purse close in the square. There are pickpockets about.",
      "Castle Street runs north, up to the King's gate. They won't let just anyone in.",
    ],
    castle: [
      "This is the King's courtyard. Keep your sword put away near the keep.",
      "Want to hit something that can't hit back? The yard's got a training dummy and archery targets.",
      "Twelve hours on this wall and not a thing has happened. Not that I'm complaining.",
    ],
    any: [
      "Long watch today.",
      "Keep out of trouble and we'll get along fine.",
    ],
  } as Record<string, readonly string[]>,
  /** Leading into a rumour, which follows in quotes. */
  rumour: [
    "You didn't hear it from me, but...",
    "Word in the barracks is...",
    "Heard this down at the Crown last night:",
    "Don't repeat this, but they're saying...",
  ],
  bye: [
    "Stay out of trouble.",
    "Off you go, then.",
    "Safe travels.",
    "Back to work.",
  ],
} as const;

/** The townsfolk's lines: a greeting (they say who they are and what they do), their quirk, and the Edict. */
export const FOLK_TALK = {
  greet: ["Morning!", "Hello there.", "Oh! You gave me a start.", "Nice to meet you.", "Mind the puddles.", "Can't stop long, but hello."],
  child: ["Mum says I'm not to talk to strangers.", "Are you a knight? You look like a knight.", "I can run faster than you. Probably."],
  /** Before their quirk, said about themselves by name. */
  quirk: ["Ask anyone round here:", "My neighbours will tell you", "Everyone knows"],
  quirkAfter: ["It's true.", "Can't help it.", "Don't laugh.", "There are worse things."],
  /** What they'll say about the Edict of the Quiet Tongue (no talk of witches, sorcerers or dragons), by where they stand on it. */
  edict: {
    denies: ["Witches? Dragons? Fairy tales, all of it."],
    loyal: ["The King knows best. Long live the King.", "The Edict keeps people calm. Good thing too."],
    quiet: ["I keep my head down and my mouth shut. Safest that way.", "Best not to talk about... you know. The Edict."],
    whispering: [],
    defiant: ["The Edict? Nonsense. People should be able to say what they've seen.", "They can't lock up the whole city for talking."],
    informer: ["Heard anything interesting lately? You can tell me. I won't tell a soul.", "Funny, the things people say when they think nobody's listening."],
  } as Record<string, readonly string[]>,
  bye: ["Well, I'd better go.", "Take care.", "Nice talking to you.", "Back to work, then."],
} as const;
