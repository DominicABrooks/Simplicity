// 2D pixel art from art/ (via the generated sprite data), baked into canvases with the 1px ink
// outline from ART_STYLE.md. Used for the HUD hearts and the inventory icons.
import { SPRITES } from "../assets/generated/sprites.ts";
import type { ItemType, Rarity } from "../data/items.ts";
import { PAL } from "../data/palette.ts";
import { ICON_SWAPS, TIERS, type TierName } from "../data/tiers.ts";

const NO_OUTLINE = new Set(SPRITES.noOutline);
const PALETTE = SPRITES.palette;

/** Draw rows of palette characters into a canvas, optionally outlined in ink and mirrored. */
export function bake(rows: string[], outline: boolean, flip = false, colorOf = (ch: string) => PALETTE[ch]!): HTMLCanvasElement {
  const h = rows.length, w = rows[0]!.length, pad = outline ? 1 : 0;
  const c = document.createElement("canvas");
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const g = c.getContext("2d")!;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const solid = (x: number, y: number) => inside(x, y) && rows[y]![x] !== "." && !NO_OUTLINE.has(rows[y]![x]!);
  for (let y = -pad; y < h + pad; y++) {
    for (let x = -pad; x < w + pad; x++) {
      const ch = inside(x, y) ? rows[y]![x]! : ".";
      const dx = (flip ? w - 1 - x : x) + pad;
      if (ch !== ".") { g.fillStyle = colorOf(ch); g.fillRect(dx, y + pad, 1, 1); }
      else if (outline && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) {
        g.fillStyle = PAL.K; g.fillRect(dx, y + pad, 1, 1);
      }
    }
  }
  return c;
}

const frameCache = new Map<string, HTMLCanvasElement>();
/** The first frame of a sprite animation, outlined (tiles aren't). */
export function spriteFrame(name: string, anim: string): HTMLCanvasElement {
  const key = `${name}/${anim}`;
  let c = frameCache.get(key);
  if (!c) {
    const def = SPRITES.sprites[name];
    const rows = def?.anims[anim]?.frames[0];
    if (!def || !rows) throw new Error(`No sprite ${key}`);
    c = bake(rows, def.kind !== "tile");
    frameCache.set(key, c);
  }
  return c;
}

export type ItemIcons = Record<ItemType, Record<TierName, string>>;

/** Item icons as data URLs, one per tier, recoloured with the tier colours the gear uses when worn. */
export function bakeItemIcons(): ItemIcons {
  return Object.fromEntries(Object.entries(ICON_SWAPS).map(([type, swap]) => {
    const rows = SPRITES.sprites[type]!.anims.idle!.frames[0]!;
    return [type, Object.fromEntries(Object.entries(TIERS).map(([tier, colors]) => {
      const colorOf = (ch: string) => { const k = swap[ch]; return k ? String(colors[k]) : PALETTE[ch]!; };
      return [tier, bake(rows, true, false, colorOf).toDataURL()];
    }))];
  })) as ItemIcons;
}

export const iconFor = (icons: ItemIcons, type: ItemType, rarity: Rarity): string => icons[type][rarity];
