import type { Rng } from "../core/rng.ts";
import { AFFIXES, BASES, CURIOS, FISH, GIFTS, RARE_A, RARE_B, RARITY_ODDS, type CurioId, type GiftKind, type ItemType, type Rarity, type Slot, type StatKey, type Stats } from "../data/items.ts";

export interface Item {
  id: number;
  type: ItemType;
  rarity: Rarity;
  name: string;
  slot: Slot | null;
  w: number;
  h: number;
  /** The base type's built-in stats. */
  base: Stats;
  /** Rolled affixes. */
  mods: Stats;
  /** Food only: hearts restored when eaten. */
  heal?: number;
  /** A curiosity fished up (see CURIOS): which one. */
  curio?: CurioId;
}

let nextId = 1;

export function makeItem(type: ItemType, rarity: Rarity = "normal", mods: Stats = {}, name?: string): Item {
  const b = BASES[type];
  return { id: nextId++, type, rarity, name: name ?? b.name, slot: b.slot, w: b.w, h: b.h, base: { ...b.base }, mods };
}

/** A random loot item: a base type, a rarity, and affixes that suit its slot. */
export function rollItem(rng: Rng, minRarity: Rarity = "normal"): Item {
  const types = (Object.keys(BASES) as ItemType[]).filter(t => !BASES[t].noLoot);
  const type = types[Math.floor(rng.next() * types.length)]!;
  const slot = BASES[type].slot;
  const r = rng.next();
  let rarity: Rarity = r < RARITY_ODDS.rare ? "rare" : r < RARITY_ODDS.magic ? "magic" : "normal";
  if (minRarity === "magic" && rarity === "normal") rarity = "magic";
  if (minRarity === "rare") rarity = "rare";
  const pool = (Object.keys(AFFIXES) as StatKey[]).filter(k => slot && AFFIXES[k].slots.includes(slot));
  const count = rarity === "rare" ? Math.min(3, pool.length) : rarity === "magic" ? 1 + Math.floor(rng.next() * 2) : 0;
  const mods: Stats = {};
  const picks = [...pool];
  for (let i = 0; i < count && picks.length; i++) {
    const k = picks.splice(Math.floor(rng.next() * picks.length), 1)[0]!;
    const a = AFFIXES[k];
    mods[k] = a.min + Math.floor(rng.next() * (a.max - a.min + 1));
  }
  let name = BASES[type].name;
  if (rarity === "magic") {
    const keys = Object.keys(mods) as StatKey[];
    const pre = keys.find(k => AFFIXES[k].prefix), suf = keys.find(k => AFFIXES[k].suffix);
    name = [pre && AFFIXES[pre].prefix, name, suf && AFFIXES[suf].suffix].filter(Boolean).join(" ");
  } else if (rarity === "rare") {
    name = `${RARE_A[Math.floor(rng.next() * RARE_A.length)]} ${RARE_B[Math.floor(rng.next() * RARE_B.length)]}`;
  }
  return makeItem(type, rarity, mods, name);
}

/** A koi from fishing: rarity decides its name and how much it heals. */
export function makeFish(rarity: Rarity): Item {
  const item = makeItem("fish", rarity, {}, FISH[rarity].name);
  item.heal = FISH[rarity].heal;
  return item;
}

/** A curiosity that sometimes comes up on the line instead of a koi. */
export function makeCurio(id: CurioId): Item {
  const item = makeItem(CURIOS[id].type, "rare", {}, CURIOS[id].name);
  item.curio = id;
  return item;
}

/** Something someone hands the hero as they talk: a loaf, a koi, a shiny stone. */
export function makeGift(kind: GiftKind): Item {
  const gift = GIFTS[kind], item = makeItem(gift.type, "normal", {}, gift.name);
  if (gift.heal) item.heal = gift.heal;
  return item;
}
