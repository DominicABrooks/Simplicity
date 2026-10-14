// The people of Kingsholm, the capital of Aurenmark (see LORE.md): the named families, the city's
// institutions, and the ordinary households that fill every other house the town kit builds. Each named
// family asks for a kind of house (a shop of its trade, a tall stone house, a poor timber one, or one
// exact house) and gets the best one free in its district, so the families stay put as long as the
// streets do, and follow sensibly when they change.
import { T } from "../data/world.ts";
import type { Goods, Prop } from "./area.ts";
import { hash } from "./townkit.ts";

export type District = "capital" | "castle";
/** Where an institution is: a district with houses, or the King's Bridge, which has none. */
export type Where = District | "kingsroad";
export type Rank = "royal" | "noble" | "clergy" | "merchant" | "craft" | "labouring" | "poor";
/** Where a family stands on the Edict of the Quiet Tongue. */
export type Stance = "denies" | "loyal" | "quiet" | "whispering" | "defiant" | "informer";
type HouseProp = Extract<Prop, { kind: "house" }>;

export interface Person {
  name: string;
  age: number;
  role: string;
  note?: string;
  /** How many this entry stands for (brothers and sisters listed together; their age is the eldest's). */
  count?: number;
  /** Not under the roof any more: locked in the dungeon, or turned into a sheep. */
  gone?: true;
}

/** The house a family wants: an exact house (its top-left tile), or the best match on the rest. */
export interface Seat {
  district: District;
  tile?: readonly [number, number];
  shop?: Goods;
  storeys?: number;
  stone?: boolean;
}

export interface Family {
  id: string;
  name: string;
  rank: Rank;
  trade: string;
  /** Their house in the town, or none if they live in a castle, palace or hall (see `home`). */
  seat?: Seat;
  home: string;
  members: Person[];
  /** Servants, apprentices, journeymen and lodgers under the same roof. */
  household: number;
  story: string;
  customs: string[];
  stance: Stance;
  /** What they say under their breath. */
  mutter: string;
  secret?: string;
  /** Who they love, owe, feud with or keep secrets with (other families' ids). See FAMILIES.md. */
  ties: Tie[];
  /** What the city says about them, and whether it's so. */
  rumours: Rumour[];
}

export interface Tie {
  to: string;
  how: string;
}

export interface Rumour {
  says: string;
  truth: "true" | "false" | "half";
}

export const KINGDOM = {
  name: "Aurenmark",
  city: "Kingsholm",
  river: "Aurel",
  king: "Osric IV, the Gilded",
  arms: "Crimson, a gold chevron and a gold crown",
  /** The folk beyond the Witchwood, and their three orders (the Ember, Frost and Storm mages). */
  enemy: { name: "the Vael", orders: ["Ember", "Frost", "Storm"] },
  edict: "The Edict of the Quiet Tongue: whoever speaks of witches, sorcerers or dragons shall have their head chopped off (in practice, the dungeon).",
} as const;

// ---------- The named families ----------
export const FAMILIES: readonly Family[] = [
  // ---- The castle ----
  {
    id: "aurel", name: "House Aurel", rank: "royal", trade: "Kings of Aurenmark",
    home: "The keep, on its crag in the inner ward", household: 60,
    members: [
      { name: "Osric IV", age: 61, role: "King", note: "Called the Gilded. Laughs loudest at the rumours and sleeps with a lamp lit." },
      { name: "Isolde", age: 49, role: "Queen", note: "From the eastern coast. Prays at night and secretly pays the Dean for iron grilles on St Mary's windows." },
      { name: "Edmund", age: 26, role: "Prince, heir, captain of the Royal Guard", note: "Held the Ranger's orb, felt the cold and believes every word. He hasn't told his father so." },
      { name: "Rosamund", age: 17, role: "Princess", note: "Slips out to the Crown in a laundress's hood to hear what the city really says." },
      { name: "Hild", age: 84, role: "Dowager Queen", note: "Half blind. Says aloud at supper that \"they've come back for what we took\". No one dares tell the King's mother to hush." },
      { name: "Aldric", age: 6, role: "Prince Edmund's son", note: "Named for the Founder. Has nightmares of a great bird." },
    ],
    story: "Six hundred years from Aldric the Founder, who took the valley. Osric has read the true chronicle in St Mary's library. He knows the Vael are real and knows Aldric pinched their eggs at a party, so he made talking about either against the law.",
    customs: ["Regilds the crown every Gilding Day", "Swears the Founder's Oath at the fountain on every royal birthday", "Leads the straw witch parade on Founder's Night"],
    stance: "denies",
    mutter: "\"There is nothing beyond the wood but trees and peasants' tales.\" (the King, too often and too loud)",
    secret: "Wystan Fell is in the dungeon under the keep, and the King sneaks down at night with cake to ask him about the Vael.",
    ties: [
      { to: "grison", how: "Owes them for the King's Bridge; Prince Edmund goes over the debts with Lucia" },
      { to: "harrow", how: "Commands the Marshal" },
      { to: "fitzwaren", how: "Princess Rosamund and Blanche are best friends" },
      { to: "crane", how: "Dowager Hild plays cards with the Widow every Thursday" },
      { to: "fell", how: "The King keeps the Ranger in the dungeon; the Prince visits Meg" },
    ],
    rumours: [
      { says: "The King goes down to the dungeon at night with cake", truth: "true" },
      { says: "The Queen is a Vael spy", truth: "false" },
      { says: "Prince Edmund is planning to free the Ranger", truth: "half" },
      { says: "Little Prince Aldric talks in his sleep in a language nobody knows", truth: "true" },
    ],
  },
  {
    id: "harrow", name: "The Harrows", rank: "noble", trade: "Marshal of Aurenmark",
    seat: { district: "castle", storeys: 4, stone: true },
    home: "The tallest stone house on the lane under the castle, with the crimson door", household: 9,
    members: [
      { name: "Lord Gerard Harrow", age: 54, role: "Marshal of the Kingdom", note: "Enforces the Edict. Has sent two people to the dungeon and keeps a list of who's next. The list is mostly people who were rude to him." },
      { name: "Lady Ysolde Harrow", age: 47, role: "His wife", note: "Collects gossip at the Fitzwarens' table for her husband." },
      { name: "Bran Harrow", age: 24, role: "Sergeant of the bridge watch", note: "Saw a robed figure on the King's Bridge at midnight and reported it as a pilgrim." },
      { name: "Piers Harrow", age: 19, role: "Squire", note: "Engaged to Joan Leafwright. Thinks his father is a coward." },
    ],
    story: "Soldiers since Sergeant Gerald Harrow held the old bridge in the Salt War with a pushcart and was made a lord for it. The Marshal believes the Edict keeps the city from panic, and that a panicking city is worse than any witch.",
    customs: ["Hangs a captured enemy banner in the hall each Founder's Night", "The sons stand vigil in the castle chapel the night before they take arms"],
    stance: "loyal",
    mutter: "\"A rumour is a fire in a hayloft. You don't argue with it. You put it out.\"",
    secret: "The Marshal pays Gilbert Pike of the Bell for names, and the Harrows' own steward is one of them.",
    ties: [
      { to: "pike", how: "Pays Gilbert Pike for names" },
      { to: "gale", how: "Father Gale tells him things" },
      { to: "leafwright", how: "Piers is engaged to Joan" },
      { to: "bowyer", how: "Commands Tom; Will Bowyer serves under Bran" },
      { to: "larke", how: "He's sure she's a witch; Lady Harrow buys her tea" },
    ],
    rumours: [
      { says: "The Marshal's list has the whole Crown on it", truth: "half" },
      { says: "The golden pushcart is cursed", truth: "false" },
      { says: "Bran Harrow has seen a witch on the bridge", truth: "true" },
    ],
  },
  {
    id: "fitzwaren", name: "The Fitzwarens", rank: "noble", trade: "Courtiers, holders of the southern manors",
    seat: { district: "castle", storeys: 4, stone: true },
    home: "A stone house with a walled garden by the castle ditch", household: 8,
    members: [
      { name: "Lady Cecily Fitzwaren", age: 44, role: "Widow, head of the house", note: "Keeps the best table in the city, where courtiers drink and talk too much." },
      { name: "Hugh Fitzwaren", age: 21, role: "Her son", note: "Plays dice at the Crown and owes the Grisons more than the manors bring in." },
      { name: "Blanche Fitzwaren", age: 16, role: "Her daughter", note: "Princess Rosamund's friend and her alibi." },
    ],
    story: "Their manors lie on the Witchwood's edge. No rents have come from them since spring, and nobody comes to explain why.",
    customs: ["A supper on the first day of every month", "Wears the family's green on Gilding Day, against court custom"],
    stance: "quiet",
    mutter: "\"My reeves write that the harvest is fine. My reeves have stopped writing.\"",
    ties: [
      { to: "ashcombe", how: "Lady Cecily wants Hugh to marry Alys Ashcombe" },
      { to: "grison", how: "Hugh owes them 900 crowns" },
      { to: "aurel", how: "Blanche is Princess Rosamund's alibi" },
      { to: "tansy", how: "Daisy sells posies at their gate" },
    ],
    rumours: [
      { says: "The southern manors have been taken by witches", truth: "half" },
      { says: "Lady Cecily has sold the family silver", truth: "true" },
    ],
  },
  {
    id: "hammond", name: "The Hammonds", rank: "craft", trade: "Royal armourers",
    seat: { district: "castle", storeys: 3, stone: true },
    home: "A soot-black stone house near the castle smithy, with the forge glow in its back windows", household: 7,
    members: [
      { name: "Walter Hammond", age: 50, role: "Master armourer", note: "Has had orders for twelve thousand arrowheads \"for a war that isn't coming\"." },
      { name: "Agnes Hammond", age: 46, role: "His wife, keeps the accounts" },
      { name: "Kit Hammond", age: 22, role: "Journeyman" },
      { name: "Nell Hammond", age: 15, role: "Daughter", note: "Better at the forge than Kit. Nobody may say so." },
    ],
    story: "Armourers to the crown since the Founder's grandson. Business has never been better, and that frightens Walter more than anything.",
    customs: ["Quenches the first blade of the year in water from the fountain", "Hangs a horseshoe over every door, iron side out"],
    stance: "quiet",
    mutter: "\"Twelve thousand arrowheads. Against the weather, I suppose.\"",
    ties: [
      { to: "harrow", how: "Makes the Marshal's arrowheads" },
      { to: "aurel", how: "Nell is making Prince Edmund a cold sword" },
      { to: "grubb", how: "Buys their charcoal" },
    ],
    rumours: [
      { says: "The arrowheads are for a war with the coast", truth: "false" },
      { says: "Nell Hammond can forge with her bare hands", truth: "half" },
    ],
  },
  {
    id: "hawke", name: "The Hawkes", rank: "craft", trade: "Royal falconers",
    seat: { district: "castle", storeys: 4, stone: false },
    home: "A tall timber house under the castle wall, its loft full of falcons", household: 3,
    members: [
      { name: "Osmund Hawke", age: 58, role: "Master falconer" },
      { name: "Elinor Hawke", age: 33, role: "His daughter, falconer", note: "Her best peregrine came back from the south with singed primaries and won't fly that way again." },
      { name: "Robin Hawke", age: 11, role: "Elinor's son" },
    ],
    story: "Their birds go out over the Witchwood to hunt, and lately they come back frightened or not at all.",
    customs: ["Names every eyass after a king", "Flies a falcon over the castle for every new Hawke baby"],
    stance: "whispering",
    mutter: "\"A falcon doesn't lie and doesn't listen to edicts. Mine won't fly south.\"",
    ties: [
      { to: "fell", how: "Their goshawk carries notes between Meg and the Ranger's cell" },
      { to: "aurel", how: "Flew every falcon for Prince Edmund's birth" },
    ],
    rumours: [
      { says: "A Hawke falcon has seen the dragon", truth: "true" },
      { says: "Elinor Hawke's birds talk back", truth: "false" },
    ],
  },
  {
    id: "garth", name: "The Garths", rank: "labouring", trade: "Keepers of the castle storehouse",
    seat: { district: "castle", storeys: 3, stone: false },
    home: "A crowded timber house by the castle lane, sacks of flour in the hall", household: 2,
    members: [
      { name: "Daw Garth", age: 41, role: "Storekeeper", note: "Knows exactly how much flour the castle has: enough for a siege, which is new." },
      { name: "Moll Garth", age: 38, role: "Laundress to the castle", note: "Knows whose sheets have frost on them in the morning." },
      { name: "Sim, Tib and Little Daw", age: 12, count: 3, role: "Their sons (12, 9 and 5)", note: "Sim looks after Biscuit, the mule the Vael lent the Ranger, kept on the Prince's orders. Biscuit eats turnips, snow and, once, a guard's hat." },
    ],
    story: "Grooms and porters all the way back. The stable came down this year for a stone storehouse, so the Garths went from mucking out horses to counting sacks. They see the castle from below, which is to say everything.",
    customs: ["Has tied a rowan twig to every sack in the storehouse since the spring"],
    stance: "whispering",
    mutter: "\"Why would you keep a missing man's mule?\"",
    ties: [
      { to: "aurel", how: "Sim keeps the Ranger's mule for Prince Edmund" },
      { to: "hollin", how: "Orders the castle's flour" },
      { to: "appleby", how: "Moll and Sarra Appleby are cousins" },
    ],
    rumours: [
      { says: "The storehouse is full of weapons", truth: "false" },
      { says: "Biscuit the mule understands Vael", truth: "true" },
    ],
  },

  // ---- The Market Quarter ----
  {
    id: "maddox", name: "The Maddoxes", rank: "craft", trade: "Keepers of the Crown inn",
    seat: { district: "capital", tile: [40, 24] },
    home: "The Crown, on the square by Castle Street, under its red sign", household: 6,
    members: [
      { name: "Bethan Maddox", age: 52, role: "Landlady, a widow", note: "Decides who sits in the back room after curfew. No one has ever been taken from it." },
      { name: "Owain Maddox", age: 28, role: "Her son, behind the bar" },
      { name: "Gwen Maddox", age: 24, role: "Her daughter, the cook" },
      { name: "Lew Maddox", age: 19, role: "Her son, pot-boy", note: "Knows Jack Linnet's song by heart." },
    ],
    story: "Morwen Maddox opened the Crown in 352 AF, and every landlord since has been a Maddox woman. Its back room after curfew is where the city says what it thinks.",
    customs: ["Closes the shutters at the curfew bell, and that's when the real talk starts", "Pours the first cider of Founder's Night onto the floor \"for the old owners\""],
    stance: "whispering",
    mutter: "\"What's said under the Crown stays under the Crown.\"",
    secret: "The Crown's cellar runs under the guildhall, and the Ranger's wife has a key.",
    ties: [
      { to: "pike", how: "The Crown and the Bell have feuded since 355 AF" },
      { to: "fell", how: "Meg Fell has a key to the cellar" },
      { to: "quill", how: "Simon Quill keeps his private record in the cellar" },
      { to: "grubb", how: "Dick told Bethan where the Ranger is" },
    ],
    rumours: [
      { says: "The Crown's cellar connects to the castle", truth: "false" },
      { says: "Bethan Maddox knows where the Ranger is", truth: "true" },
      { says: "The Crown's cider is watered", truth: "false" },
    ],
  },
  {
    id: "pike", name: "The Pikes", rank: "craft", trade: "Keepers of the Bell inn",
    seat: { district: "capital", tile: [51, 24] },
    home: "The Bell, on the square across Castle Street from the Crown, under its blue sign", household: 5,
    members: [
      { name: "Gilbert Pike", age: 49, role: "Landlord", note: "Tattles everything he overhears to the Marshal, at a shilling a name." },
      { name: "Maud Pike", age: 45, role: "His wife", note: "Knows, and puts the coins in the poor box at St Giles'." },
      { name: "Cuthbert Pike", age: 17, role: "Their son", note: "Drinks at the Crown, where it's warm." },
    ],
    story: "The Bell keeps the castle's custom: guardsmen, clerks and courtiers' men. It's prospered since the Edict.",
    customs: ["Toasts the King at every hour bell", "Shows a portrait of the King over the hearth, freshly gilded"],
    stance: "informer",
    mutter: "\"Long live the King, and fair weather to him.\" (loudly)",
    ties: [
      { to: "harrow", how: "Gilbert tattles to the Marshal" },
      { to: "maddox", how: "Cuthbert is sweet on Gwen Maddox" },
      { to: "dunn", how: "The Dunns glazed the Bell's blue sign" },
    ],
    rumours: [
      { says: "Gilbert Pike is a tattletale", truth: "true" },
      { says: "Cuthbert Pike warns people when his father's listening", truth: "true" },
    ],
  },
  {
    id: "ashcombe", name: "The Ashcombes", rank: "merchant", trade: "Mercers: cloth from the south",
    seat: { district: "capital", shop: "cloth" },
    home: "The cloth shop on the square, its shutters hung with southern dyes", household: 8,
    members: [
      { name: "Aldous Ashcombe", age: 55, role: "Master of the Mercers' Guild", note: "The richest commoner in the city, on paper." },
      { name: "Philippa Ashcombe", age: 50, role: "His wife", note: "Has quietly sewn the family's rings into the hems of her winter cloaks." },
      { name: "Thomas Ashcombe", age: 27, role: "Eldest son", note: "Sent \"to the cousins in the north\" with the family silver in spring." },
      { name: "Alys, Margery and Kate", age: 20, count: 3, role: "Daughters (20, 17 and 13)" },
    ],
    story: "Three generations of fortune on the southern trade road through the Witchwood. The road has been closed since spring, and the Ashcombes are ruined unless the king is right.",
    customs: ["Hosts the Mercers' Gilding Day feast", "Shakes every bargain at the market cross at dawn"],
    stance: "loyal",
    mutter: "\"The King says the road is safe, so the road is safe. Pass the gravy.\"",
    secret: "Aldous owes the Grisons four thousand crowns and the crown owes Aldous six. Neither debt will be paid.",
    ties: [
      { to: "grison", how: "Owes them 4,000 crowns" },
      { to: "aurel", how: "The crown owes them 6,000" },
      { to: "fitzwaren", how: "Philippa wants Alys to marry Hugh Fitzwaren" },
      { to: "quill", how: "The Quills drew up the Mercers' Charter" },
    ],
    rumours: [
      { says: "The Ashcombes are ruined", truth: "half" },
      { says: "Their southern dyes are made by witches", truth: "true" },
    ],
  },
  {
    id: "hollin", name: "The Hollins", rank: "craft", trade: "Bakers",
    seat: { district: "capital", shop: "bread" },
    home: "The bakery on the high street, its oven never cold", household: 4,
    members: [
      { name: "Joan Hollin", age: 43, role: "Mistress baker", note: "Cut the first three-cut loaf. Swears it's only a pattern." },
      { name: "Wat Hollin", age: 45, role: "Her husband, at the oven" },
      { name: "Peg, Ned and Bess", age: 14, count: 3, role: "Their children (14, 11 and 7)" },
    ],
    story: "Bakers to the square since the Bakers' Guild was founded, famous for the gold-flaked crown loaves on Gilding Day.",
    customs: ["Three cuts in every loaf, one for each kind of weather", "The first loaf of the day goes to the almshouse"],
    stance: "whispering",
    mutter: "\"Three cuts, love. It helps it rise.\"",
    ties: [
      { to: "crane", how: "The first loaf of the day goes to the almshouse" },
      { to: "linnet", how: "The Wallside's bread goes in a book marked paid" },
      { to: "leafwright", how: "Buys the gold for crown loaves" },
    ],
    rumours: [
      { says: "The three cuts are a witch-mark", truth: "half" },
      { says: "The Hollins started the Great Pie Fire", truth: "true" },
    ],
  },
  {
    id: "stott", name: "The Stotts", rank: "craft", trade: "Butchers",
    seat: { district: "capital", shop: "meat" },
    home: "A butcher's shop on the high street, carcasses hung under the jetty", household: 4,
    members: [
      { name: "Roger Stott", age: 48, role: "Master butcher" },
      { name: "Annis Stott", age: 46, role: "His wife" },
      { name: "Hal Stott", age: 20, role: "Son", note: "In love with Marian Cleave, which is a scandal." },
    ],
    story: "The Stotts and the Cleaves were one family until a grandfather's will split the shop and the family in two. They've feuded for forty years.",
    customs: ["Gives the Shambles' best cut to the Marshal on Founder's Night", "Never sells to a Cleave"],
    stance: "loyal",
    mutter: "\"If there's witches, it's the Cleaves' doing.\"",
    ties: [
      { to: "cleave", how: "Feud since 560 AF; Hal loves Marian" },
      { to: "harrow", how: "Gives the Marshal the best cut" },
    ],
    rumours: [
      { says: "Roger Stott would rather close than sell to a Cleave", truth: "true" },
      { says: "Hal Stott is courting someone", truth: "true" },
    ],
  },
  {
    id: "cleave", name: "The Cleaves", rank: "craft", trade: "Butchers",
    seat: { district: "capital", shop: "meat" },
    home: "The other butcher's shop, deliberately three doors from the Stotts'", household: 3,
    members: [
      { name: "Abel Cleave", age: 51, role: "Master butcher" },
      { name: "Marian Cleave", age: 19, role: "His daughter", note: "Meets Hal Stott behind St Giles'." },
      { name: "Old Ursula Cleave", age: 77, role: "Abel's mother", note: "Started the feud. Has outlived everyone who remembers why." },
    ],
    story: "The other half of the Stott feud. They buy their beasts from the south farms, so they hear the farmers' stories first.",
    customs: ["Sells Founder's Night sausage at a loss to spite the Stotts"],
    stance: "whispering",
    mutter: "\"The drovers won't take the south road now, not for double pay.\"",
    ties: [
      { to: "stott", how: "Feud since 560 AF; Marian loves Hal" },
      { to: "appleby", how: "Buy from the same south farmers" },
    ],
    rumours: [
      { says: "Old Ursula started the feud over a sausage", truth: "true" },
      { says: "The drovers won't take the south road", truth: "true" },
    ],
  },
  {
    id: "appleby", name: "The Applebys", rank: "craft", trade: "Greengrocers",
    seat: { district: "capital", shop: "produce" },
    home: "A produce shop on the square, with a yard behind where a sheep lives", household: 3,
    members: [
      { name: "Hob Appleby", age: 39, role: "Greengrocer, buys from the south farms" },
      { name: "Sarra Appleby", age: 36, role: "His wife" },
      { name: "\"Uncle\"", age: 19, role: "A sheep (once Tam Appleby, Hob's nephew?)", note: "Turned up the day Hob's nephew Tam went into the Witchwood after a strayed cow. It stares, follows Sarra to church and won't eat grass." },
    ],
    story: "Turnip farmers who came into the city after the hard winter of 512 AF. Their wagons still go down to the farms at the Witchwood's edge.",
    customs: ["Sets a place at the table for Tam", "Brings the first apples of the year to the fountain king"],
    stance: "defiant",
    mutter: "\"Tam always did like a turnip. Didn't you, Tam?\"",
    secret: "Hob is sure the sheep is Tam, turned by a red-robed one in the wood, and he's asked Old Mother Larke to turn him back.",
    ties: [
      { to: "larke", how: "Asked Old Mother Larke to turn Uncle back" },
      { to: "garth", how: "Sarra and Moll Garth are cousins" },
      { to: "grison", how: "Rent the Grisons a turnip cart" },
    ],
    rumours: [
      { says: "The sheep is Tam", truth: "true" },
      { says: "The Applebys have gone soft in the head", truth: "false" },
    ],
  },
  {
    id: "dunn", name: "The Dunns", rank: "craft", trade: "Potters",
    seat: { district: "capital", shop: "pottery" },
    home: "A pottery shop on the square, with the kiln behind", household: 4,
    members: [
      { name: "Gil Dunn", age: 60, role: "Master potter" },
      { name: "Edith Dunn", age: 58, role: "His wife, glazes" },
      { name: "Aud Dunn", age: 31, role: "Their daughter, potter" },
    ],
    story: "Potters since the clay pits were opened by the river. Their glaze is the blue of the Bell's sign.",
    customs: ["Fires a crock for every baby born on the street", "Breaks a pot at the cross for a broken bargain"],
    stance: "quiet",
    mutter: "\"The kiln wouldn't light the morning after the storm. Then it lit itself.\"",
    ties: [
      { to: "pike", how: "Glazed the Bell's sign" },
      { to: "larke", how: "Sell Old Mother Larke her jars" },
    ],
    rumours: [
      { says: "The Dunns' kiln is haunted", truth: "half" },
      { says: "The blue glaze is made of sapphires", truth: "false" },
    ],
  },
  {
    id: "leafwright", name: "The Leafwrights", rank: "merchant", trade: "Goldbeaters to the crown",
    seat: { district: "capital", storeys: 4, stone: true },
    home: "A tall stone house on the high street with gilded window frames", household: 10,
    members: [
      { name: "Ambrose Leafwright", age: 57, role: "Master goldbeater", note: "Has beaten every leaf on the King's Bridge." },
      { name: "Helewise Leafwright", age: 52, role: "His wife" },
      { name: "Joan Leafwright", age: 18, role: "Daughter", note: "Engaged to Piers Harrow." },
      { name: "Jasper Leafwright", age: 14, role: "Son, apprentice" },
    ],
    story: "The Gilding made them. Every flake of gold on the city came through their hammers, and they're the most loyal family in the city because the crown is their only customer.",
    customs: ["Gilds the fountain king's crown on Gilding Day, by royal warrant", "Wears a gold leaf pressed into the wax of every letter"],
    stance: "loyal",
    mutter: "\"Gold doesn't rust and kings don't lie.\"",
    ties: [
      { to: "harrow", how: "Joan is engaged to Piers" },
      { to: "quill", how: "Joan admires Benet's handwriting" },
      { to: "aurel", how: "The crown is their only customer, and owes them" },
    ],
    rumours: [
      { says: "The Leafwrights are the richest family in the city", truth: "false" },
      { says: "The gold leaf on the bridge is fake", truth: "half" },
    ],
  },
  {
    id: "grison", name: "The Grisons", rank: "merchant", trade: "Moneylenders",
    seat: { district: "capital", storeys: 4, stone: true },
    home: "A stone house off the square with iron-bound shutters and no sign", household: 6,
    members: [
      { name: "Benedict Grison", age: 63, role: "Moneylender", note: "Holds the Crown's notes for the bridge." },
      { name: "Lucia Grison", age: 35, role: "His daughter and partner", note: "The cleverest person on the square." },
    ],
    story: "Came from over the sea in 436 AF with three chests of coin, and have lent to five kings. They trust no edict.",
    customs: ["Counts the strongbox at every curfew bell", "Lends nothing on Founder's Night"],
    stance: "quiet",
    mutter: "\"We're calling in the bridge loans. For no reason at all.\"",
    secret: "They've bought a house in a northern port and are moving their coin there one cart a week.",
    ties: [
      { to: "aurel", how: "Hold the crown's bridge notes; Lucia meets Prince Edmund" },
      { to: "ashcombe", how: "Owed 4,000 crowns" },
      { to: "fitzwaren", how: "Owed 900 crowns by Hugh" },
      { to: "appleby", how: "Move their coin north under the Applebys' turnips" },
    ],
    rumours: [
      { says: "The Grisons are leaving", truth: "true" },
      { says: "Lucia Grison is sweet on the Prince", truth: "true" },
      { says: "The Grisons have a vault under the square", truth: "false" },
    ],
  },
  {
    id: "quill", name: "The Quills", rank: "craft", trade: "Town clerk and scriveners",
    seat: { district: "capital", storeys: 3, stone: true },
    home: "A narrow stone house by the guildhall, ink stains on the step", household: 3,
    members: [
      { name: "Master Simon Quill", age: 44, role: "Town clerk", note: "Reads the Edict at the cross every market day, a little quieter each time." },
      { name: "Alice Quill", age: 40, role: "His wife, a scrivener" },
      { name: "Benet Quill", age: 16, role: "Son, apprentice scrivener", note: "Copies Jack Linnet's song by night and slips it under doors." },
    ],
    story: "Clerks to the guildhall since the first Quill lent the first Ashcombe his quill in 226 AF. They've written down every law of the city, and Simon has begun to keep a second, private record.",
    customs: ["Records every birth, wedding and arrest in the city book", "Burns the year's spoiled pages on Founder's Night"],
    stance: "quiet",
    mutter: "\"I only read it out. I didn't write it.\"",
    ties: [
      { to: "maddox", how: "Keeps a private record in the Crown's cellar" },
      { to: "linnet", how: "Benet copies Jack's song" },
      { to: "leafwright", how: "Benet and Joan Leafwright" },
    ],
    rumours: [
      { says: "Someone's posting Jack Linnet's song under doors", truth: "true" },
      { says: "Master Quill wrote the Edict", truth: "false" },
    ],
  },
  {
    id: "fell", name: "The Fells", rank: "labouring", trade: "The Ranger's family; laundress",
    seat: { district: "capital", storeys: 3, stone: false },
    home: "A timber house in the Wallside lanes, a grey cloak at the window every evening", household: 0,
    members: [
      { name: "Wystan Fell", age: 40, gone: true, role: "The King's Ranger", note: "Taken into the keep and not seen since." },
      { name: "Meg Fell", age: 38, role: "His wife, a laundress", note: "Hangs his grey cloak from the window every evening." },
      { name: "Hob Fell", age: 14, role: "Son", note: "Means to go south through the Witchwood to find out what his father saw." },
      { name: "Wren Fell", age: 9, role: "Daughter", note: "Swears she hears her father whistle from the keep at night." },
    ],
    story: "Foresters and trackers who served the crown for generations. Now the neighbours cross the lane to avoid them, and leave bread on the step after dark.",
    customs: ["The grey cloak at the window", "Whistles the Ranger's call across the lanes at dusk"],
    stance: "defiant",
    mutter: "\"He said they were kind. He said that was the frightening part.\"",
    ties: [
      { to: "hawke", how: "Notes to and from Wystan by goshawk" },
      { to: "maddox", how: "Meg has a key to the Crown's cellar" },
      { to: "linnet", how: "Wren and Robin Linnet are best friends" },
      { to: "rudd", how: "Hob and Jory Rudd are going south" },
      { to: "pryce", how: "Father Pryce has hidden a copy of the chronicle for them" },
    ],
    rumours: [
      { says: "The Ranger is dead", truth: "false" },
      { says: "The Ranger is a Vael spy", truth: "false" },
      { says: "Hob Fell is going to run off south", truth: "true" },
    ],
  },
  {
    id: "larke", name: "The Larkes", rank: "poor", trade: "Herbwife and wise-woman",
    seat: { district: "capital", storeys: 3, stone: false },
    home: "A leaning timber house against the west wall, bundles of herbs hung from every beam", household: 0,
    members: [
      { name: "Old Mother Ivy Larke", age: 70, role: "Herbwife", note: "Sells salt and rowan against the weather. The city's nearest thing to a witch, and she knows the Marshal knows it." },
      { name: "Tamsin Larke", age: 22, role: "Her granddaughter", note: "Learning the herbs and the old words." },
    ],
    story: "Midwives and herbwives as far back as anyone remembers, and some say further: the Larkes may be the last drop of Vael blood that stayed in the valley.",
    customs: ["Hangs rowan over every door she visits", "Leaves milk at the edge of the Witchwood each new moon"],
    stance: "defiant",
    mutter: "\"Sand by the fire is backwards, dearie. It's the fire you want on your side.\"",
    secret: "Ivy can light a candle without a flint, and Tamsin has seen her do it.",
    ties: [
      { to: "harrow", how: "Feud with the Marshal; Lady Harrow buys her tea" },
      { to: "appleby", how: "Trying to turn Uncle back" },
      { to: "crane", how: "Old friends" },
      { to: "waxley", how: "Buys beeswax for salves" },
    ],
    rumours: [
      { says: "Old Mother Larke is a witch", truth: "half" },
      { says: "Tamsin talks to a robed woman at the Witchwood's edge", truth: "true" },
    ],
  },
  {
    id: "linnet", name: "The Linnets", rank: "poor", trade: "A jailed singer's family",
    seat: { district: "capital", storeys: 3, stone: false },
    home: "Two rooms in a Wallside tenement by the south wall", household: 0,
    members: [
      { name: "Jack Linnet", age: 31, gone: true, role: "Ballad singer", note: "In the castle dungeon for his song about the Ranger's orb. Still singing it. The jailer joins in on the chorus." },
      { name: "Kat Linnet", age: 29, role: "His wife, a spinner" },
      { name: "Robin and Wenna", age: 8, count: 2, role: "Their children (8 and 6)", note: "Taught the Wallside children the song as nonsense words." },
    ],
    story: "Players and singers who came to the city for Gilding Day and stayed. Since Jack was locked up, the whole Wallside has quietly made sure they never go hungry.",
    customs: ["Sings at the cross on Lantern Night, without the words"],
    stance: "defiant",
    mutter: "\"Hum it. They can't arrest a hum.\"",
    ties: [
      { to: "hollin", how: "Fed from the Hollins' paid book" },
      { to: "quill", how: "Benet copies the song" },
      { to: "fell", how: "Robin and Wren Fell are best friends" },
      { to: "tansy", how: "Daisy leaves the day's last flower on their step" },
    ],
    rumours: [
      { says: "Jack Linnet is in the cell next to the Ranger", truth: "true" },
      { says: "The song has a secret verse about the eggs", truth: "false" },
    ],
  },
  {
    id: "rudd", name: "The Rudds", rank: "labouring", trade: "River fishers",
    seat: { district: "capital", storeys: 3, stone: false },
    home: "A tenement by the south wall, nets drying on the lane", household: 4,
    members: [
      { name: "Silas Rudd", age: 46, role: "Fisherman", note: "Saw blue fire walking on the water under the bridge." },
      { name: "Hester Rudd", age: 44, role: "His wife, sells the catch in the square" },
      { name: "Jory Rudd", age: 17, role: "Son", note: "Dives for the Dean's coins at the Bridge Blessing every spring and has never missed one." },
    ],
    story: "Fishers on the Aurel since before the bridge. The fish have been running north early this year, which the Rudds have never seen.",
    customs: ["Throws back the first fish of the year for the river", "Never fishes on Founder's Night"],
    stance: "whispering",
    mutter: "\"The fish know before we do. They're all swimming north.\"",
    ties: [
      { to: "fell", how: "Jory will row Hob Fell upriver" },
      { to: "maddox", how: "Sell fish to the Crown's kitchen" },
    ],
    rumours: [
      { says: "The Rudds have a hoard of Bridge Blessing coins", truth: "true" },
      { says: "The blue fire on the river was a Frost mage", truth: "true" },
    ],
  },
  {
    id: "grubb", name: "The Grubbs", rank: "labouring", trade: "Lamplighters and chimney sweeps",
    seat: { district: "capital", storeys: 3, stone: false },
    home: "A sooty tenement by the west wall, ladders stacked against the front", household: 2,
    members: [
      { name: "Dick Grubb", age: 39, role: "Lamplighter and sweep", note: "Lights the street lamps at dusk and sweeps chimneys by day, so he's been on every roof and under every window in the city." },
      { name: "Nan Grubb", age: 37, role: "His wife" },
    ],
    story: "Sweeps and lamplighters, father to son. Sound carries up a chimney beautifully, and nobody ever thinks to lower their voice for the sweep.",
    customs: ["Is allowed out after curfew by ancient right", "Gets the first round free at the Crown, by custom"],
    stance: "whispering",
    mutter: "\"The Marshal's own cook said it. Up his own chimney.\"",
    secret: "Dick knows who Gilbert Pike reports to, and when.",
    ties: [
      { to: "maddox", how: "Drink free at the Crown; Dick told Bethan about the Ranger" },
      { to: "hammond", how: "Sell charcoal" },
      { to: "pike", how: "Know who Gilbert reports to, and when" },
    ],
    rumours: [
      { says: "Dick Grubb knows everyone's secrets", truth: "true" },
      { says: "The Grubbs may go out after curfew", truth: "true" },
    ],
  },
  {
    id: "bowyer", name: "The Bowyers", rank: "craft", trade: "Sergeant of Southgate",
    seat: { district: "capital", storeys: 4, stone: false },
    home: "A tall timber house on the high street, near enough to hear the gate", household: 2,
    members: [
      { name: "Tom Bowyer", age: 43, role: "Sergeant of Southgate", note: "Marched both of them to the dungeon on the Marshal's orders, and felt rotten about it." },
      { name: "Elsa Bowyer", age: 41, role: "His wife" },
      { name: "Will and Ruth", age: 16, count: 2, role: "Their children (16 and 12)", note: "Will is in the bridge watch now." },
    ],
    story: "Bowyers who became gate guards. Tom has kept the gate for twenty years and has never had so many people ask to be let out.",
    customs: ["Locks the gate himself at the curfew bell", "Keeps a tally on the gatepost of every soul who goes south and doesn't come back"],
    stance: "quiet",
    mutter: "\"Eleven marks on the post this year. Eleven.\"",
    ties: [
      { to: "harrow", how: "Serve the Marshal; Will is in Bran's bridge watch" },
      { to: "linnet", how: "Tom brings Kat a basket every week, out of guilt" },
    ],
    rumours: [
      { says: "The eleven who went south are dead", truth: "false" },
      { says: "Tom Bowyer let a witch through the gate", truth: "true" },
    ],
  },
  {
    id: "tansy", name: "The Tansys", rank: "poor", trade: "Flower sellers",
    seat: { district: "capital", storeys: 3, stone: false },
    home: "A garret room high in a Wallside tenement", household: 0,
    members: [
      { name: "Daisy Tansy", age: 15, role: "Flower seller in the square", note: "Sells posies to the courtiers and hears everything at the Fitzwarens' gate." },
      { name: "Pip Tansy", age: 10, role: "Her brother, a link-boy at night" },
      { name: "Gran Tansy", age: 68, role: "Their grandmother" },
    ],
    story: "Orphans of the Fever of 597 AF, raised by their grandmother on what the flowers bring in.",
    customs: ["Puts the day's last flower on the Linnets' step"],
    stance: "whispering",
    mutter: "\"Rowan's dearer than roses now.\"",
    ties: [
      { to: "aurel", how: "Pip lights Princess Rosamund's way home" },
      { to: "fitzwaren", how: "Daisy hears the gossip at their gate" },
      { to: "linnet", how: "The day's last flower goes on their step" },
    ],
    rumours: [
      { says: "Pip Tansy knows the Princess", truth: "true" },
      { says: "Rowan's dearer than roses now", truth: "true" },
    ],
  },

  // ---- St Mary's, on East Street ----
  {
    id: "thorne", name: "Dean Anselm Thorne", rank: "clergy", trade: "Dean of St Mary's",
    home: "The clergy house beside St Mary's", household: 6,
    members: [
      { name: "Anselm Thorne", age: 66, role: "Dean", note: "Preaches the Founder's Victory every autumn, and has ordered iron grilles for every window of St Mary's." },
    ],
    story: "Third son of a southern lord, Dean for twenty years. He crowned Osric and will not see him called a liar.",
    customs: ["Walks the King's Bridge at the spring Blessing", "Keeps the treasury key on his person"],
    stance: "loyal",
    mutter: "\"Pray, and don't speculate.\"",
    secret: "The Ranger's orb is in the treasury beside the three gilded \"altar stones\". The orb is still cold and the stones have begun to grow warm.",
    ties: [
      { to: "gale", how: "Rival: Gale wants his job" },
      { to: "aurel", how: "Crowned Osric; the Queen pays for his grilles" },
    ],
    rumours: [
      { says: "The Dean sleeps in the treasury", truth: "true" },
      { says: "The Dean believes in dragons", truth: "half" },
    ],
  },
  {
    id: "pryce", name: "The Pryces", rank: "clergy", trade: "Librarian of St Mary's",
    seat: { district: "capital", storeys: 3, stone: true },
    home: "A narrow stone house on East Street, books stacked on the stairs", household: 2,
    members: [
      { name: "Father Elias Pryce", age: 71, role: "Priest and librarian", note: "The only man living who has read the true chronicle besides the King." },
      { name: "Mistress Joan Pryce", age: 68, role: "His sister and housekeeper" },
    ],
    story: "The Pryces have given St Mary's a priest in every generation. Elias found the chronicle behind a false shelf thirty years ago and has wished ever since that he hadn't.",
    customs: ["Reads a psalm for the Founder on Founder's Night, and another, privately, for the Vael"],
    stance: "quiet",
    mutter: "\"It was their temple. We're living in their house, and they want it back.\"",
    secret: "He has copied the chronicle and hidden the copy where the Fells can find it if he dies.",
    ties: [
      { to: "aurel", how: "Shares the chronicle's secret with the King" },
      { to: "kellet", how: "Told Hugh Kellet the truth in 598 AF" },
      { to: "fell", how: "Hid a copy of the chronicle for them" },
      { to: "crane", how: "Checks the chronicle against her grandmother's stories" },
    ],
    rumours: [
      { says: "There's a forbidden book in St Mary's library", truth: "true" },
      { says: "Father Pryce prays for the witches on Founder's Night", truth: "true" },
    ],
  },
  {
    id: "gale", name: "The Gales", rank: "clergy", trade: "Treasurer of St Mary's",
    seat: { district: "capital", storeys: 4, stone: true },
    home: "The grandest house on East Street, facing the churchyard", household: 5,
    members: [
      { name: "Father Matthias Gale", age: 52, role: "Priest and treasurer", note: "Keeps the treasury's books and counts its coins every night, twice. Has two cats, Tithe and Offering, who sleep on the gilded \"altar stones\" because they're warm." },
          ],
    story: "Worldly, rich and well connected. Gale would very much like to be Dean, and tells the Marshal things to help it along.",
    customs: ["Hosts the clergy's Gilding Day dinner"],
    stance: "informer",
    mutter: "\"The Dean is getting old, and the Marshal is a good friend to have.\"",
    ties: [
      { to: "harrow", how: "Tells the Marshal things" },
      { to: "thorne", how: "Wants to be Dean" },
    ],
    rumours: [
      { says: "Father Gale is the Marshal's man", truth: "true" },
      { says: "The treasury cats can see ghosts", truth: "half" },
    ],
  },
  {
    id: "kellet", name: "The Kellets", rank: "craft", trade: "Master masons of St Mary's",
    seat: { district: "capital", storeys: 4, stone: false },
    home: "A tall timber house by the masons' lodge, stone dust on everything", household: 9,
    members: [
      { name: "Master Hugh Kellet", age: 59, role: "Master mason", note: "Has finished the crossing spire, the tallest in the kingdom." },
      { name: "Mary Kellet", age: 55, role: "His wife" },
      { name: "Ralph Kellet", age: 31, role: "Son, carver", note: "Carves the new gargoyles as robed figures with fire in their hands." },
      { name: "Isabel Kellet", age: 8, role: "Ralph's daughter" },
    ],
    story: "Masons of St Mary's since Ulf Kellet laid its first stone in 88 AF. They know its foundations better than anyone, and know the oldest stones aren't the Founder's work.",
    customs: ["Sets a mason's mark into every stone they lay", "Pours cider on the foundation stone each Founder's Night"],
    stance: "defiant",
    mutter: "\"Devils, Your Grace. Just devils.\"",
    secret: "Under the crypt there's a door older than the church, carved with three flames, a snowflake and a lightning bolt. Hugh has sealed it twice and both times it was open by morning.",
    ties: [
      { to: "pryce", how: "Knows the chronicle through Father Pryce" },
      { to: "waxley", how: "Isabel and Tibby Waxley explore the crypt" },
    ],
    rumours: [
      { says: "The new gargoyles are a message to the witches", truth: "true" },
      { says: "Something lives under St Mary's", truth: "true" },
    ],
  },
  {
    id: "waxley", name: "The Waxleys", rank: "craft", trade: "Chandlers to St Mary's",
    seat: { district: "capital", storeys: 3, stone: false },
    home: "A chandlery on East Street by St Mary's, smelling of tallow and beeswax", household: 3,
    members: [
      { name: "Agatha Waxley", age: 48, role: "Chandler" },
      { name: "Piers Waxley", age: 50, role: "Her husband, keeps bees outside the walls" },
      { name: "Tibby Waxley", age: 12, role: "Their daughter" },
    ],
    story: "They make every candle St Mary's burns. Sales of votive candles have tripled since the Edict.",
    customs: ["Gives a candle to every pilgrim who asks for one in the Founder's name"],
    stance: "whispering",
    mutter: "\"Three times the candles. Everyone's praying about the weather.\"",
    ties: [
      { to: "kellet", how: "Tibby and Isabel Kellet explore the crypt" },
      { to: "larke", how: "Sell Old Mother Larke beeswax" },
    ],
    rumours: [
      { says: "The Waxleys' bees make magic honey", truth: "half" },
    ],
  },

  // ---- The almshouse ----
  {
    id: "crane", name: "The Widow Crane", rank: "poor", trade: "Almswoman",
    home: "The almshouse of St Giles, by the west wall", household: 0,
    members: [
      { name: "Widow Agnes Crane", age: 91, role: "The oldest soul in Kingsholm", note: "Remembers her grandmother's stories of \"the summer the sky went pink\" and tells them to anyone who brings her bread." },
    ],
    story: "Outlived three husbands and nine children. The almshouse lets her talk because nobody believes the very old.",
    customs: ["Sits at the almshouse door every evening, facing south"],
    stance: "defiant",
    mutter: "\"Mother sleeps a long time, dearie. But she always wakes up hungry.\"",
    ties: [
      { to: "aurel", how: "Plays cards with Dowager Hild every Thursday, and cheats" },
      { to: "larke", how: "Ivy's grandmother delivered her first baby" },
      { to: "pryce", how: "Father Pryce checks the chronicle against her stories" },
    ],
    rumours: [
      { says: "Widow Crane cheats at cards", truth: "true" },
      { says: "Widow Crane has met the Old Mother", truth: "half" },
    ],
  },
];

/** People who live in halls, the castle and the clergy house rather than in the houses (beyond the named families). */
export const INSTITUTIONS = [
  { name: "The Royal Guard and the garrison", district: "castle", people: 90, home: "The barracks by the castle gate" },
  { name: "The bridge watch", district: "kingsroad", people: 12, home: "The gate tower on the King's Bridge" },
  { name: "The court and the castle servants", district: "castle", people: 50, home: "The lodgings, the great hall and the kitchens" },
  { name: "The priests and choir of St Mary's", district: "capital", people: 18, home: "The clergy house and the song school" },
  { name: "The masons' lodge", district: "capital", people: 15, home: "Journeymen and labourers on St Mary's new spire" },
  { name: "The almshouse of St Giles", district: "capital", people: 14, home: "Old widows and the sick, by the west wall" },
  { name: "Guests at the Crown and the Bell", district: "capital", people: 25, home: "Pilgrims, carters and petitioners" },
] as const satisfies readonly { name: string; district: Where; people: number; home: string }[];

// ---------- Everyone else ----------
/** A family under a roof: one per house, or two or three in a poor tenement. */
export interface Folk {
  surname: string;
  trade: string;
  rank: Rank;
  size: number;
  custom: string;
  mutter: string;
}

export interface Household {
  district: District;
  house: HouseProp;
  /** The named family living here, if any. */
  family?: Family;
  folk: Folk[];
  people: number;
}

const SURNAMES = [
  "Ashby", "Barrow", "Brook", "Carver", "Cooper", "Crow", "Draper", "Dyer", "Fenn", "Fletcher", "Glover", "Haddon", "Hayward", "Holt",
  "Kemp", "Lyle", "Marsh", "Mercer", "Morrow", "Nash", "Oakes", "Pell", "Quarles", "Reeve", "Riggs", "Rook", "Sallow", "Sawyer",
  "Sparrow", "Tanner", "Thatcher", "Tull", "Turner", "Underhill", "Vane", "Ward", "Webb", "Wick", "Wold", "Yates", "Brewer", "Cordner",
] as const;

/** Trades by district and by how well the house says they live. */
const TRADES: Record<District, Record<"merchant" | "craft" | "labouring", readonly string[]>> = {
  capital: {
    merchant: ["wine merchant", "wool merchant", "spice merchant", "goldsmith", "draper", "lawyer", "physician", "guild alderman"],
    craft: ["cooper", "glover", "saddler", "cordwainer", "tailor", "brewer", "carpenter", "dyer", "pewterer", "ironmonger", "barber-surgeon", "tanner"],
    labouring: ["carter", "porter", "laundress", "water-carrier", "rag-picker", "day labourer", "rat-catcher", "spinner", "sweep"],
  },
  castle: {
    merchant: ["courtier's steward", "royal clerk", "knight of the household", "royal physician", "keeper of the wardrobe"],
    craft: ["fletcher", "bowyer", "farrier", "royal cook", "saddler", "harness-maker", "kennelman", "huntsman", "castle carpenter"],
    labouring: ["soldier's wife", "groom", "scullion", "washerwoman", "wood-carrier", "dung-carter"],
  },
};

const CUSTOMS = [
  "Keeps a nail over the door, iron side out",
  "Salts the windowsills every Sunday",
  "Keeps a bucket of sand by the hearth, \"for red weather\"",
  "Buys only three-cut bread",
  "Hangs a grey rag at the window at dusk, for the Ranger",
  "Has rowan over the hearth, bought from Old Mother Larke",
  "Never says the word \"south\" after dark",
  "Keeps the shutters shut on the south side of the house",
  "Lights a lantern every night, not just on Lantern Night",
  "Has started going to church twice a day",
  "Drinks the King's health loudly at the Bell",
  "Leaves a crust on the sill for \"the visitors\"",
  "Has sewn a little iron bell into the children's collars",
  "Climbs the fountain on Gilding Day, as the family always has",
  "Brings a straw witch to Founder's Night, and this year made it smaller",
] as const;

const MUTTERS = [
  "\"Mind the weather.\"",
  "\"Has your aunt from the south visited?\" \"Not yet, thank God.\"",
  "\"My cousin's cousin saw a man walk out of the Witchwood made all of frost.\"",
  "\"Loud weather on a clear night. Explain that.\"",
  "\"The King's right. There's nothing out there. Now pass the salt.\"",
  "\"Gone to see the Ranger, poor soul.\"",
  "\"The bird was bigger than St Mary's. Or so they said, and they're in the dungeon now.\"",
  "\"Hush. The Bell's ringing.\"",
  "\"Why's the King making arrows, if there's nobody to shoot?\"",
  "\"Old Widow Crane says she's seen it before. Says Mother always wakes up hungry.\"",
  "\"It's only slimes in the wood. Slimes and nothing.\"",
  "\"I don't believe a word of it, and I've moved my savings north.\"",
] as const;

const pick = <V>(list: readonly V[], k: number): V => list[Math.floor(k * list.length) % list.length]!;

/** What a house says about how well its people live: tall and stone is rich, low and timber is a tenement. */
const rankOf = (h: HouseProp): "merchant" | "craft" | "labouring" =>
  h.stone && h.storeys >= 4 ? "merchant" : !h.stone && h.storeys <= 3 ? "labouring" : "craft";

function folkFor(district: District, h: HouseProp, n: number): Folk {
  const x = h.rect.x / T, y = h.rect.y / T, k = (i: number) => hash(x, y, 900 + n * 10 + i);
  const rank = rankOf(h);
  // Household sizes: a merchant's family with servants, a craftsman's with apprentices, a tenement family on its own.
  const size = rank === "merchant" ? 6 + Math.floor(k(1) * 4) : rank === "craft" ? 5 + Math.floor(k(1) * 4) : 3 + Math.floor(k(1) * 3);
  return {
    surname: pick(SURNAMES, k(2)), trade: pick(TRADES[district][rank], k(3)), rank, size,
    custom: pick(CUSTOMS, k(4)), mutter: pick(MUTTERS, k(5)),
  };
}

/** How well a house suits a family's seat (higher is better). */
function fit(seat: Seat, h: HouseProp): number {
  const x = h.rect.x / T, y = h.rect.y / T;
  if (seat.tile) return seat.tile[0] === x && seat.tile[1] === y ? 100 : -1;
  return (seat.shop ? (h.shop === seat.shop ? 10 : h.shop ? -5 : 0) : (h.shop ? -5 : 0))
    + (seat.storeys === undefined || seat.storeys === h.storeys ? 3 : 0)
    + (seat.stone === undefined || seat.stone === !!h.stone ? 3 : 0);
}

/** How many live under a family's roof: its members still there, and its household. */
export const sizeOf = (f: Family): number => f.members.reduce((s, m) => s + (m.gone ? 0 : m.count ?? 1), 0) + f.household;

const folkOf = (f: Family): Folk => ({
  surname: f.name, trade: f.trade, rank: f.rank, size: sizeOf(f), custom: f.customs[0] ?? "", mutter: f.mutter,
});

/** Who lives in each house of a district: the named families in the houses that suit them best, ordinary folk in the rest. */
export function householdsOf(district: District, props: readonly Prop[]): Household[] {
  const houses = props.filter((p): p is HouseProp => p.kind === "house");
  const named = new Map<number, Family>();
  for (const f of FAMILIES) {
    if (f.seat?.district !== district) continue;
    let best = -1, score = -Infinity;
    houses.forEach((h, i) => { const s = named.has(i) ? -Infinity : fit(f.seat!, h); if (s > score) { best = i; score = s; } });
    if (best >= 0 && score >= 0) named.set(best, f);
  }
  return houses.map((house, i) => {
    const family = named.get(i);
    // Poor timber houses are tenements: two or three families to a house.
    const many = rankOf(house) === "labouring" ? 2 + Math.floor(hash(house.rect.x, house.rect.y, 950) * 2) : 1;
    const folk = family ? [folkOf(family)] : Array.from({ length: many }, (_, n) => folkFor(district, house, n));
    return { district, house, ...(family ? { family } : {}), folk, people: folk.reduce((s, f) => s + f.size, 0) };
  });
}

/** Everyone who doesn't live in a house: the named families in the keep, palace and almshouse, and the institutions. */
export const BEYOND_HOUSES = FAMILIES.filter(f => !f.seat).reduce((s, f) => s + sizeOf(f), 0)
  + INSTITUTIONS.reduce((s, i) => s + i.people, 0);
