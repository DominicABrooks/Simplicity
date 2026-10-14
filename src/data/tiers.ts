// Gear tiers: one source of truth for how rarity looks, shared by the 3D gear and the inventory icons,
// so an item looks the same in the bag and when worn. The enemy tiers (ember, frost, storm) dress the
// mages, and the guard tier the kingdom's guards; none of them roll as loot.
import type { ItemType, Rarity } from "./items.ts";
import { PAL } from "./palette.ts";
import type { School } from "./enemies.ts";

export interface TierColors {
  cloth: string; dark: string; light: string; trim: string; accent: string;
  metal: string; metalDark: string; gem: string;
  blade: string; bladeDark: string; guard: string; guardDark: string;
  boot: string; bootDark: string; glow: number;
  fishMain: string; fishAccent: string;
}

export type TierName = Rarity | School | "guard";

export const TIERS: Record<TierName, TierColors> = {
  normal: {
    cloth: PAL.N, dark: PAL.n, light: "#a8774a", trim: PAL.n, accent: PAL.n,
    metal: PAL.w, metalDark: "#8f8578", gem: PAL.w,
    blade: PAL.w, bladeDark: "#8f8578", guard: PAL.n, guardDark: "#3a2418",
    boot: PAL.N, bootDark: PAL.n, glow: 0,
    fishMain: PAL.O, fishAccent: PAL.W,
  },
  magic: {
    cloth: PAL.B, dark: PAL.b, light: "#5d8ae0", trim: PAL.w, accent: PAL.w,
    metal: PAL.W, metalDark: PAL.w, gem: "#7fa6ff",
    blade: PAL.W, bladeDark: PAL.w, guard: PAL.W, guardDark: PAL.w,
    boot: PAL.b, bootDark: "#1b2852", glow: 0.35,
    fishMain: "#d6dde8", fishAccent: PAL.C,
  },
  rare: {
    cloth: PAL.P, dark: "#5a2f86", light: "#a874d8", trim: PAL.Y, accent: PAL.O,
    metal: PAL.Y, metalDark: PAL.O, gem: PAL.Y,
    blade: PAL.W, bladeDark: PAL.w, guard: PAL.Y, guardDark: PAL.O,
    boot: "#5a2f86", bootDark: "#3d1f5c", glow: 0.6,
    fishMain: PAL.Y, fishAccent: PAL.O,
  },
  // Enemy-only tier: the Ember Mage's red robes.
  ember: {
    cloth: PAL.R, dark: PAL.r, light: "#e0705f", trim: PAL.O, accent: PAL.Y,
    metal: PAL.O, metalDark: PAL.r, gem: PAL.O,
    blade: PAL.W, bladeDark: PAL.w, guard: PAL.O, guardDark: PAL.r,
    boot: PAL.r, bootDark: "#4a1620", glow: 0.4,
    fishMain: PAL.R, fishAccent: PAL.O,
  },
  // Frost Mage: icy white-blue robes with mana trim.
  frost: {
    cloth: "#dfeaf2", dark: "#8fb3cc", light: "#ffffff", trim: PAL.C, accent: PAL.W,
    metal: PAL.C, metalDark: "#5a8fb0", gem: PAL.C,
    blade: PAL.W, bladeDark: "#a9d6e8", guard: PAL.C, guardDark: "#5a8fb0",
    boot: "#8fb3cc", bootDark: "#4f6f86", glow: 0.4,
    fishMain: PAL.W, fishAccent: PAL.C,
  },
  // The kingdom's livery, on its soldiers' surcoats, plumes and shields: deep crimson (the banners' red,
  // darker than the Ember Mage's) with gold trim, and dark boots.
  guard: {
    cloth: "#7a1f2b", dark: "#4a1219", light: "#a8473a", trim: PAL.Y, accent: PAL.Y,
    metal: PAL.Y, metalDark: PAL.O, gem: PAL.Y,
    blade: "#c8d0d8", bladeDark: "#8a929c", guard: PAL.Y, guardDark: PAL.O,
    boot: "#5a5f6a", bootDark: "#3a3e46", glow: 0,
    fishMain: PAL.R, fishAccent: PAL.Y,
  },
  // Storm Mage: dark indigo robes with gold trim.
  storm: {
    cloth: "#3b3f7a", dark: "#24264f", light: "#5a5fb0", trim: PAL.Y, accent: PAL.W,
    metal: PAL.Y, metalDark: PAL.O, gem: PAL.Y,
    blade: PAL.W, bladeDark: PAL.w, guard: PAL.Y, guardDark: PAL.O,
    boot: "#24264f", bootDark: "#16173a", glow: 0.5,
    fishMain: PAL.Y, fishAccent: PAL.W,
  },
};

/** Which icon pixels (palette chars in art/items/*.txt) take which tier colour. */
export const ICON_SWAPS: Record<ItemType, Partial<Record<string, keyof TierColors>>> = {
  hood:   { B: "cloth", b: "dark", Y: "trim", O: "accent" },
  robe:   { B: "cloth", b: "dark", Y: "trim", O: "accent" },
  boots:  { N: "boot", n: "bootDark", Y: "trim" },
  blade:  { W: "blade", w: "bladeDark", Y: "guard", O: "guardDark" },
  ring:   { Y: "metal", C: "gem" },
  amulet: { Y: "metal", R: "gem", n: "metalDark" },
  rod:    {},
  bow:    { B: "cloth", b: "dark", Y: "metal" },
  fish:   { O: "fishMain", W: "fishAccent" },
};

/** Rarity colours for ground loot, labels and tooltips. */
export const RARITY_COLOR: Record<Rarity, string> = { normal: PAL.w, magic: "#7fa6ff", rare: PAL.Y };
