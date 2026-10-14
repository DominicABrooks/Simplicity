// Talking to people: how close you must be, and how fast their lines type out. What they say is in
// src/data/voices.ts, put together in src/game/conversation.ts.

/** How close the hero must be to talk (px, centre to centre), and how far they can wander before it ends. */
export const TALK = { reach: 26, leave: 40, charsPerSecond: 60 } as const;
