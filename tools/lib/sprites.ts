// Sprite pipeline: parse the palette and art/**/*.txt, and render outlined previews.
// See ART_STYLE.md for the text format.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { SpriteAnim, SpriteData, SpriteDef } from "../../src/assets/types.ts";
import { Raster, type RGBA } from "./raster.ts";

export const CELL = 8;
const OUTLINE: RGBA = [0, 0, 0, 255];

export interface Palette {
  rgba: Record<string, RGBA>;
  hex: Record<string, string>;
  noOutline: Set<string>;
}

export function loadPalette(root: string): Palette {
  const rgba: Record<string, RGBA> = {}, hex: Record<string, string> = {}, noOutline = new Set<string>();
  for (const raw of readFileSync(join(root, "palette", "simplicity.txt"), "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [char, hexcode, , ...flags] = line.split(/\s+/) as [string, string, string, ...string[]];
    const h = hexcode.replace(/^#/, "");
    rgba[char] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
    hex[char] = `#${h}`;
    if (flags.includes("nooutline")) noOutline.add(char);
  }
  return { rgba, hex, noOutline };
}

/** Parse one sprite file. "!tile" marks a ground tile; "@anim ms" starts an animation; blank lines split frames. */
export function parseSprite(name: string, text: string, pal: Palette): SpriteDef {
  let kind: SpriteDef["kind"] = "sprite";
  const anims: Record<string, SpriteAnim> = {};
  let current: string | null = null;
  let frame: string[] = [];

  const flush = () => {
    if (!frame.length) return;
    if (current === null) throw new Error(`${name}: frame before any @anim line`);
    if (frame.length % CELL) throw new Error(`${name} @${current}: frame has ${frame.length} rows, needs a multiple of ${CELL}`);
    if (new Set(frame.map(r => r.length)).size !== 1 || frame[0]!.length % CELL)
      throw new Error(`${name} @${current}: rows must share a width that is a multiple of ${CELL}`);
    for (const r of frame) {
      const bad = [...r].filter(c => c !== "." && !(c in pal.rgba));
      if (bad.length) throw new Error(`${name} @${current}: unknown palette chars ${[...new Set(bad)].sort()}`);
    }
    anims[current]!.frames.push(frame);
    frame = [];
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#")) continue;
    if (line === "!tile") kind = "tile";
    else if (line.startsWith("@")) {
      flush();
      const [anim, ms] = line.slice(1).split(/\s+/) as [string, string];
      current = anim;
      anims[anim] = { ms: Number(ms), frames: [] };
    } else if (!line) flush();
    else frame.push(line);
  }
  flush();
  return { kind, anims };
}

function findText(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...findText(p));
    else if (entry.endsWith(".txt")) out.push(p);
  }
  return out;
}

/** Every sprite under art/, keyed by file name (names must be unique across folders). */
export function loadSprites(root: string, pal: Palette): Record<string, SpriteDef> {
  const sprites: Record<string, SpriteDef> = {};
  for (const path of findText(join(root, "art")).sort()) {
    const name = basename(path, ".txt");
    if (name in sprites) throw new Error(`Duplicate sprite name: ${name}`);
    sprites[name] = parseSprite(name, readFileSync(path, "utf8"), pal);
  }
  return sprites;
}

export function buildSpriteData(root: string): SpriteData {
  const pal = loadPalette(root);
  return { palette: pal.hex, noOutline: [...pal.noOutline].sort(), sprites: loadSprites(root, pal) };
}

export function rawImage(rows: string[], pal: Palette): Raster {
  const img = new Raster(rows[0]!.length, rows.length);
  rows.forEach((row, y) => [...row].forEach((c, x) => c !== "." && img.set(x, y, pal.rgba[c]!)));
  return img;
}

/** Pad 1px and outline solid pixels in black (4-neighbour), as the game renders them. */
export function outlinedImage(rows: string[], pal: Palette): Raster {
  const w = rows[0]!.length, h = rows.length;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? rows[y]![x]! : ".");
  const solid = (x: number, y: number) => at(x, y) !== "." && !pal.noOutline.has(at(x, y));
  const img = new Raster(w + 2, h + 2);
  for (let y = -1; y <= h; y++)
    for (let x = -1; x <= w; x++) {
      const c = at(x, y);
      if (c !== ".") img.set(x + 1, y + 1, pal.rgba[c]!);
      else if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) img.set(x + 1, y + 1, OUTLINE);
    }
  return img;
}
