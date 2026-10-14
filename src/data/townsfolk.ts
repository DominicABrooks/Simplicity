// The townsfolk out and about: how many of the census's common people are on the streets of each area,
// hour by hour; how they walk, how long they stay at what they're doing, and how children keep together.
// (What they wear is their own: see src/world/wardrobe.ts.)

export const TOWNSFOLK = {
  /** How many are out at once at the busiest time of day, by area id. */
  out: { capital: 30, castle: 10, kingsroad: 6 } as Record<string, number>,
  /** How busy the streets are through the day, 0-1, at each hour from midnight. */
  busy: [0.08, 0.05, 0.04, 0.04, 0.05, 0.12, 0.35, 0.65, 0.9, 1, 1, 1, 1, 1, 1, 1, 0.95, 0.9, 0.8, 0.7, 0.55, 0.4, 0.25, 0.14],
  /** Seconds between one party going in and the next coming out. */
  every: [1.5, 5] as const,
  /** Walking speed, px per second (the hero walks at 42). */
  speed: { adult: [17, 23], child: [20, 27], old: [11, 15] } as const,
  /** Seconds they stay at what they're doing. */
  stay: {
    work: [40, 90], shop: [4, 9], chat: [10, 25], drink: [20, 45], church: [6, 12], errand: [1, 3], play: [15, 30],
  } as Record<string, readonly [number, number]>,
  /** Hours of things: when work starts and stops, when the inns fill, and when everyone's in. */
  hours: { workFrom: 7, workTo: 18, innFrom: 17, bedtime: 22, kidsIn: 19 },
  /** How far behind their leader (px) a child walks, and how far beside them they stand; how far kids run about at play (tiles). */
  follow: { gap: 7, beside: 6, play: 2.5 },
  /** Knocking at a door: how close the hero must be (px), how long before someone comes (s), how long they'll stand
   *  in the doorway (s), how far off the hero can go before they go back in (px), and how likely nobody comes at night. */
  knock: { reach: 16, answer: 1.4, wait: 30, leave: 36, asleep: 0.6 },
  /** Being asked in: how long the invitation stands (s), and how likely it is, by how they took to you. */
  invite: { stands: 90, inn: 1, cheerful: 0.75, day: 0.4, nervous: 0.15 },
  /** Whoever comes to the door: how long they'll wait to be spoken to before giving up (s), and how long they take to shut it after (s). */
  doorstep: { idle: 9, shut: 0.8 },
  /**
   * What someone says at their own front door, by who they are and the hour: a word as they open it, then (if you talk to them)
   * a greeting, who's in or out ({name}, {he}/{him}, {place}), a wary word from an informer, and goodbye as they shut it.
   */
  atTheDoor: {
    peek: { day: ["Yes?", "Hello?", "Who is it?"], night: ["Who's there?", "Wha-? Who's that?"], child: ["Hello!", "Who's there?"] },
    open: {
      day: ["Yes? Can I help you?", "Hello? Oh, good day to you.", "Yes, who is it? Oh, hello."],
      cheerful: ["Oh, a visitor! Hello, hello!", "Well, good day! Come to see us?"],
      grumpy: ["What is it? I'm busy.", "Yes? What do you want?"],
      nervous: ["W-who's there? Oh. Hello.", "Oh! You gave me a fright, knocking like that."],
      night: ["Do you know what hour it is?", "Who's banging on the door at this time of night?", "Mm? Who's there? It's the middle of the night!"],
      child: ["Hello! I'm not supposed to open the door to strangers. Oops.", "Who are you? Are you a knight?"],
      servant: ["Good day. May I help you?", "Yes? I'm afraid the family isn't receiving callers today."],
      inn: ["We're open round the front! Come in, come in.", "Door's always open at the inn! Well, the front one is."],
    },
    away: ["If you're after {name}, {he}'s out. {Place}.", "{name}'s not in, I'm afraid. You'll find {him} {place}.", "Looking for {name}? Out: {place}."],
    alone: ["It's just me in, I'm afraid.", "Nobody else is home just now."],
    /** Asking you in: open the door again (knock, or E) to go in. */
    come: ["Well, don't stand out there. Come in, come in!", "Come in and warm yourself by the fire.", "Come inside, mind the step."],
    comeInn: ["Come in, there's a seat by the fire!", "Come on in, the ale's good tonight."],
    wary: ["What's your business here, then? I like to know who comes knocking.", "Don't think I've seen you about before. Who sent you?"],
    bye: {
      day: ["Well, good day to you.", "I'll get back to it, then.", "Mind how you go."], grumpy: ["Right. Is that all? Good.", "Off you go, then."],
      cheerful: ["Lovely to see you! Call again!", "Take care now! Bye!"], nervous: ["Well. Um. Goodbye.", "I'd best shut the door now. Sorry."],
      night: ["Now let a body sleep!", "Goodnight. And don't knock again."], child: ["Bye!", "I have to shut the door now. Bye!"],
    },
    idle: ["Hello? ...Nobody, then.", "Hm. Children playing knock-knock again."],
  },
  /** Talking to one of a party on the move: how likely the rest wait for them (or else go on, and they run after them),
   *  how long they take to say they've got to go (s), and how fast they run to catch up (times their pace). */
  party: { wait: 0.65, sayBye: 1.4, run: 2.2 },
  /** What someone left behind says: to a parent (as Mum or Da, or by name), or to a band of children. */
  gotToGo: {
    parent: ["Wait for me, {who}! Sorry, I've got to go!", "Oh, {who}'s leaving without me! Got to go!", "Coming, {who}! Bye!"],
    band: ["Hey, wait for me! Sorry, they're leaving me!", "They're going without me! Got to go!", "Wait up! Bye!"],
  },
  /** Said (floating up) by someone running to catch up, if you try to talk to them. */
  brushOff: ["Can't stop!", "Not now!", "Got to catch up!"],
  /** As a target: ring radius (px) and height (world units, for an adult). */
  radius: 4.5,
  height: 1.3,
  /** How close the hero can come in front of them before they stop and wait (px), and for how long. */
  personal: 8,
  patience: 1.2,
} as const;
