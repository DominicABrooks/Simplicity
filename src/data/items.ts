// Item definitions: base types, equipment slots, affixes and naming. Pure data.

export type Rarity = "normal" | "magic" | "rare";
export type Slot = "helm" | "amulet" | "weapon" | "armor" | "ring" | "boots";
export type ItemType = "blade" | "hood" | "robe" | "boots" | "ring" | "amulet" | "bow" | "rod" | "fish" | "bread" | "stone" | "writ";
export type StatKey = "damage" | "life" | "speed" | "dash";
export type Stats = Partial<Record<StatKey, number>>;

export interface ItemBase {
  name: string;
  slot: Slot | null;
  /** Inventory size in cells. */
  w: number;
  h: number;
  base: Stats;
  /** Excluded from random loot (starter items, catches). */
  noLoot?: boolean;
  /** A line of help shown in the tooltip. */
  note?: string;
}

export const BASES: Record<ItemType, ItemBase> = {
  blade:  { name: "Blade",  slot: "weapon", w: 1, h: 3, base: { damage: 1 } },
  hood:   { name: "Hood",   slot: "helm",   w: 2, h: 2, base: { life: 1 } },
  robe:   { name: "Robe",   slot: "armor",  w: 2, h: 3, base: { life: 2 } },
  boots:  { name: "Boots",  slot: "boots",  w: 2, h: 2, base: { speed: 5 } },
  ring:   { name: "Ring",   slot: "ring",   w: 1, h: 1, base: {} },
  amulet: { name: "Amulet", slot: "amulet", w: 1, h: 1, base: {} },
  bow:    { name: "Bow",    slot: "weapon", w: 2, h: 3, base: { damage: 1 }, note: "Hold to draw, release to shoot. Full draw: +1 damage" },
  // Not in the random loot table: the pole is a starter item and fish come from fishing.
  rod:    { name: "Fishing Pole", slot: "weapon", w: 1, h: 3, base: {}, noLoot: true, note: "Aim at water and click to cast" },
  fish:   { name: "Koi", slot: null, w: 2, h: 1, base: {}, noLoot: true },
  // Gifts: only ever given, by the people you talk to (see GIFTS).
  bread:  { name: "Loaf", slot: null, w: 2, h: 1, base: {}, noLoot: true },
  stone:  { name: "Shiny Stone", slot: null, w: 1, h: 1, base: {}, noLoot: true, note: "A gift. It's yours now" },
  writ:   { name: "Writ", slot: null, w: 1, h: 2, base: {}, noLoot: true, note: "Under the King's seal. Show it to his woodwardens" },
};

/** Catches: rarity decides the koi and how much eating it heals. */
export const FISH: Record<Rarity, { name: string; heal: number }> = {
  normal: { name: "Pond Koi", heal: 1 },
  magic: { name: "Silver Koi", heal: 2 },
  rare: { name: "Golden Koi", heal: 4 },
};

/**
 * Now and then it isn't a koi on the hook at all: a smooth grey stone, cold from the water but warm in the hand, that
 * hums faintly when you hold it to your ear. Nobody in Kingsholm can say what it is. One catch in twenty.
 */
export const MYSTERIOUS_STONE = { name: "Mysterious Stone", chance: 1 / 20 } as const;

/** What people give the hero when they talk to him: the gift lines in src/data/voices.ts say which. */
export type GiftKind = "loaf" | "koi" | "stone" | "writ";
export const GIFTS: Record<GiftKind, { type: ItemType; name: string; heal?: number }> = {
  loaf: { type: "bread", name: "Three-Cut Loaf", heal: 1 },
  koi: { type: "fish", name: FISH.normal.name, heal: FISH.normal.heal },
  stone: { type: "stone", name: "Shiny Stone" },
  writ: { type: "writ", name: "The King's Writ" },
};

/** Equipment paperdoll: slot positions in cells inside a 10x7 area. */
export const SLOTS: Record<Slot, { label: string; x: number; y: number; w: number; h: number }> = {
  helm:   { label: "Helm",   x: 4, y: 0, w: 2, h: 2 },
  amulet: { label: "Amulet", x: 6, y: 1, w: 1, h: 1 },
  weapon: { label: "Weapon", x: 1, y: 2, w: 2, h: 3 },   // wide enough for a 2x3 bow
  armor:  { label: "Armor",  x: 4, y: 2, w: 2, h: 3 },
  ring:   { label: "Ring",   x: 7, y: 3, w: 1, h: 1 },
  boots:  { label: "Boots",  x: 4, y: 5, w: 2, h: 2 },
};

/** The silhouette shown in an empty slot. */
export const SLOT_ICON: Record<Slot, ItemType> = { weapon: "blade", helm: "hood", armor: "robe", boots: "boots", ring: "ring", amulet: "amulet" };

export interface Affix {
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  text: (v: number) => string;
  slots: Slot[];
}

/** Stats an item can roll. Prefixes and suffixes name magic items. */
export const AFFIXES: Record<StatKey, Affix> = {
  damage: { min: 1, max: 1, prefix: "Keen", text: v => `+${v} Damage`, slots: ["weapon", "ring", "amulet"] },
  life:   { min: 1, max: 2, prefix: "Sturdy", text: v => `+${v} Life`, slots: ["helm", "armor", "boots", "ring", "amulet"] },
  speed:  { min: 4, max: 10, suffix: "of Haste", text: v => `+${v}% Movement Speed`, slots: ["boots", "ring", "amulet", "armor"] },
  dash:   { min: 10, max: 20, suffix: "of the Wind", text: v => `${v}% Faster Dash Recovery`, slots: ["boots", "armor", "amulet", "helm"] },
};

/** How an item's built-in stat reads in the tooltip. */
export const BASE_TEXT: Partial<Record<StatKey, (v: number) => string>> = {
  damage: v => `${v} Damage`,
  life: v => `+${v} Life`,
  speed: v => `+${v}% Movement Speed`,
};

export const RARE_A = ["Gloom", "Ember", "Hollow", "Storm", "Grim", "Moss", "Dusk", "Rune"] as const;
export const RARE_B = ["Shroud", "Fang", "Ward", "Whisper", "Veil", "Bite", "Song", "Mark"] as const;

/** Loot rarity odds: 12% rare, 33% magic, the rest normal. */
export const RARITY_ODDS = { rare: 0.12, magic: 0.45 } as const;

/** What you start with, in the bag. */
export const STARTER_KIT: [ItemType, string][] = [
  ["blade", "Rusty Blade"], ["hood", "Worn Hood"], ["robe", "Worn Robe"],
  ["boots", "Worn Boots"], ["rod", "Old Fishing Pole"], ["bow", "Old Short Bow"],
];

/** Fishing catch odds: 8% golden, 25% silver, the rest pond koi. */
export const CATCH_ODDS = { rare: 0.08, magic: 0.33 } as const;

/** Slime drops: at most one, 30% potion, 40% item. Mages: always an item (magic+), 50% potion. */
export const DROPS = { slimePotion: 0.3, slimeItem: 0.7, magePotion: 0.5, potionHeal: 2 } as const;

/** Items left on the ground vanish after `after` seconds, blinking for the last `blinkFor`. */
export const LOOT_DESPAWN = { after: 20, blinkFor: 5 } as const;
