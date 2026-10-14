// Townsfolk talking to each other: when two people who know each other pass in the street, now and then
// they stop and have a word (see src/game/chatter.ts). An exchange is a few lines, taking turns, the
// first person first. {a} is the first speaker's first name and {b} the second's; each only ever says the
// other's name, never their own.

/** How they meet: how close, how often they stop, how long each line hangs, and how long before the same two chat again. */
export const CHATTER = {
  /** Px between them for a word (a tile is 8). */
  near: 14,
  /** Seconds between looking for people who might stop and chat. */
  every: 0.5,
  /** Chance, each look, that two people who know each other stop. */
  chance: 0.35,
  /** At most this many little chats going on in an area at once. */
  most: 3,
  /** Seconds each line floats above whoever said it, and between one line and the next. */
  line: 2.6,
  gap: 2.2,
  /** Seconds before the same two will stop to chat again. */
  again: 150,
  /** Of every hundred pairs of grown-ups in a district, about how many are friends. */
  friends: 6,
  /** The colour of what people say to each other. */
  color: "#e8dcc4",
} as const;

export type Bond = "family" | "friends" | "workmates" | "neighbours" | "kids";

export const EXCHANGES: Record<Bond, readonly (readonly string[])[]> = {
  family: [
    ["Did you lock the door?", "Yes, {a}. Twice."],
    ["Don't forget the bread on the way home.", "I never forget the bread.", "You forgot the bread yesterday."],
    ["There you are! I've been looking everywhere.", "I was right here, {a}."],
    ["Your mother's coming for supper.", "Oh no. I mean, oh, lovely."],
    ["Did you eat?", "Yes. Mostly.", "Mostly isn't eating, {b}."],
    ["Home before the curfew bell, {b}.", "I know, I know."],
    ["Have you seen my good hat?", "On your head, {a}."],
    ["Mind you don't get wet.", "It's not even raining.", "Not yet, it isn't."],
    ["{b}! You left the fire going.", "It's meant to be going. It's a fire."],
    ["I'll be late tonight.", "Again? I'll keep it warm."],
  ],
  friends: [
    ["{b}! Fancy a pie at the Crown later?", "Go on, then. Your turn to pay."],
    ["Morning, {b}!", "Morning! How's the knee?", "Creaky. Like me."],
    ["Did you hear about the sheep on the square?", "Hear about it? It followed me home."],
    ["{b}, you look tired.", "Thanks. You look old.", "Fair."],
    ["Coming to the fountain race this year?", "Only to watch you lose again, {a}."],
    ["I had the strangest dream last night.", "Not the one with the geese again?", "The one with the geese again."],
    ["Lovely day for it.", "For what?", "Anything, really."],
    ["You still owe me a penny, {b}.", "And you still owe me two."],
    ["Have you tried the new loaves?", "Three cuts on top? Twice. They're good.", "Lucky, they say."],
    ["Long time no see, {b}!", "It's been a day, {a}.", "A long day."],
    ["Are you going to Lantern Night?", "Wouldn't miss it."],
    ["What are you smiling about?", "Nothing. Mind your own business.", "So something, then."],
  ],
  workmates: [
    ["Busy day?", "Is there any other kind?"],
    ["Has the boss been round yet?", "Twice. In a mood, both times."],
    ["I'm taking a break.", "You just had a break, {a}.", "That was a pause. This is a break."],
    ["Did you finish the order?", "Nearly. Ish.", "That's a no."],
    ["Same again tomorrow?", "Same again forever, {a}."],
    ["My back's killing me.", "Mine too. Must be the weather."],
    ["Want to swap jobs for the afternoon?", "Not a chance, {a}."],
    ["Payday soon.", "Not soon enough."],
  ],
  neighbours: [
    ["Morning, {b}. Your cat was in my garden again.", "Not my cat.", "It sleeps on your step."],
    ["Lovely flowers on your sill, {b}.", "Thank you! Rowan's in fashion this year."],
    ["Did you hear the bells last night?", "Couldn't sleep a wink."],
    ["Your chimney's smoking again, {b}.", "That's what chimneys do, {a}."],
    ["Off to market?", "Where else? Want anything?", "Eggs, if you're passing."],
    ["How's the family, {b}?", "Loud. Yours?", "Louder."],
    ["New hat?", "Old hat. New feather.", "Very smart."],
    ["Mind the puddle by your door.", "I know. I've stepped in it three times today."],
    ["Have you seen the King's new flags?", "Can't miss them, {a}. They're everywhere."],
    ["Is that a horseshoe on your door?", "Same as yours, {a}.", "Fair enough."],
  ],
  kids: [
    ["Race you to the fountain!", "You always cheat!", "I don't! Go!"],
    ["Want to see my stick?", "That's just a stick.", "It's the best stick."],
    ["Tag! You're it!", "Not fair, I wasn't ready!"],
    ["I saw a slime today.", "You did not.", "I nearly did."],
    ["My mum says I can't play till later.", "Mine too. Let's play anyway."],
    ["Do you think the stone person is a knight?", "Knights don't wear bark, {a}."],
    ["I'm going to be a dragon when I grow up.", "You can't be a dragon.", "Watch me."],
    ["Shh! The guards are looking.", "We're not doing anything!", "That's what looks suspicious."],
  ],
};

/** For anyone who knows each other: the city, the weather, the hero. */
export const SMALL_TALK: readonly (readonly string[])[] = [
  ["See that little stone fellow?", "Don't stare, {a}. It's rude."],
  ["Bread's gone up again.", "Everything's gone up again."],
  ["They're making the straw witches bigger this year.", "Bigger? Whatever for?", "Don't ask me."],
  ["Mind the weather, {b}.", "And you, {a}. And you."],
  ["Heard the Marshal's in a mood.", "When isn't he?"],
  ["Lovely morning.", "It's afternoon, {a}.", "Lovely afternoon, then."],
  ["Did the stone king's nose always look like that?", "Since Hereward, they say."],
  ["Any news from the south?", "Nothing good. Nothing at all, really."],
];
