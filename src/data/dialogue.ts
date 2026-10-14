// What people say when you talk to them. A conversation is a few lines, one after another: a greeting,
// something about where they are, a rumour from the city (see FAMILIES in src/world/people.ts), and a
// farewell. Lines are picked at random each time, so talking again gets you something new.

/** How close the hero must be to talk (px, centre to centre), and how far they can wander before it ends. */
export const TALK = { reach: 26, leave: 40, charsPerSecond: 60 } as const;

/** A guard's lines. */
export const GUARD_TALK = {
  greet: [
    "Hail, traveller.",
    "Well met.",
    "Move along, nothing to see. Oh, you want something?",
    "Mind yourself. The King's peace holds here.",
    "Aye? Make it quick, I'm on watch.",
  ],
  /** Something about their post, by area id; `any` for anywhere else. */
  post: {
    kingsroad: [
      "Welcome to Kingsholm. Keep to the bridge, the Aurel is deeper than it looks.",
      "Every cart over this bridge pays the King's toll. Every one.",
      "Those lions are real gold, they say. Touch them and you'll find out how real my spear is.",
    ],
    capital: [
      "The market opens at first bell. Pay your stall fees and nobody gets hurt.",
      "Keep your purse close in the square. Quick fingers about.",
      "Castle Street runs north, up to the King's gate. They won't let just anyone in.",
    ],
    castle: [
      "This is the King's ward. Keep your blade sheathed near the keep.",
      "Want to swing at something that can't swing back? The yard's got a dummy and the butts.",
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
    "Safe roads.",
    "Back to it.",
  ],
} as const;
