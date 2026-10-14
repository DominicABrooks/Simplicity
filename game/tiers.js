// Gear tiers: one source of truth for how rarity looks, shared by the 3D gear (view.js)
// and the inventory icons (main.js), so an item looks the same in the bag and when worn.
const PAL = window.SPRITES.palette;

export const TIERS = {
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
};

// Which icon pixels (palette chars in art/items/*.txt) take which tier colour.
export const ICON_SWAPS = {
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
