// Hand-painted textures: tiny, nearest-filtered, in palette colours. A seeded xorshift scatters the
// dots, so they look the same every run. Creation order matters (it consumes the seed in sequence).
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { TIERS, type TierName } from "../data/tiers.ts";

export interface Textures {
  grass: THREE.CanvasTexture;
  flower: THREE.CanvasTexture;
  water: THREE.CanvasTexture;
  earth: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  leaf: THREE.CanvasTexture;
  /** Gear cloth: vertical folds, trim along the hem. Tiers decide the colours. */
  cloth(tier: TierName): THREE.CanvasTexture;
  mantle(tier: TierName): THREE.CanvasTexture;
}

export function createTextures(): Textures {
  let seed = 0x9e3779b9;
  const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  function paint(w: number, h: number, fn: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    fn(c.getContext("2d")!);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const dots = (g: CanvasRenderingContext2D, x0: number, w: number, h: number, color: string, n: number, dw = 1, dh = 1) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) g.fillRect(x0 + Math.floor(rand() * w), Math.floor(rand() * h), dw, dh);
  };

  // Ground textures span several tiles so one texel is roughly one screen pixel (no moire).
  const grass = paint(32, 32, g => {
    g.fillStyle = PAL.v; g.fillRect(0, 0, 32, 32);
    dots(g, 0, 31, 31, "#285f3b", 22, 2, 2);
    dots(g, 0, 32, 31, PAL.G, 38, 1, 2);
    dots(g, 0, 32, 32, "#86c46a", 8, 1, 1);
  }, true);
  const flower = paint(8, 8, g => {
    for (const [x, y, c] of [[2, 2, PAL.Y], [5, 5, PAL.W]] as const) {
      g.fillStyle = c; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = PAL.O; g.fillRect(x, y, 1, 1);
    }
  });
  const water = paint(32, 32, g => {
    g.fillStyle = PAL.B; g.fillRect(0, 0, 32, 32);
    dots(g, 0, 30, 30, PAL.b, 10, 3, 2);
    dots(g, 0, 28, 31, PAL.C, 8, 4, 1);
  }, true);
  const earth = paint(16, 16, g => {
    g.fillStyle = PAL.N; g.fillRect(0, 0, 16, 16);
    for (let y = 3; y < 16; y += 4) { g.fillStyle = PAL.n; g.fillRect(0, y, 16, 1); }
    dots(g, 0, 15, 15, PAL.w, 5, 2, 1);
    g.fillStyle = PAL.G; g.fillRect(0, 0, 16, 2);
  }, true);
  const bark = paint(16, 16, g => {
    g.fillStyle = PAL.N; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL.n; for (let x = 2; x < 16; x += 5) g.fillRect(x, 0, 1, 16);
    dots(g, 0, 15, 15, PAL.n, 6, 1, 2);
  }, true);
  const leaf = paint(16, 16, g => {
    g.fillStyle = PAL.G; g.fillRect(0, 0, 16, 16);
    dots(g, 0, 14, 14, PAL.v, 16, 2, 2);
    dots(g, 0, 15, 15, "#8fd06e", 10, 1, 1);
  }, true);

  const cache = new Map<string, THREE.CanvasTexture>();
  const cached = (key: string, make: () => THREE.CanvasTexture) => {
    let t = cache.get(key);
    if (!t) cache.set(key, (t = make()));
    return t;
  };

  return {
    grass, flower, water, earth, bark, leaf,
    cloth: tier => cached(`cloth/${tier}`, () => paint(16, 16, g => {
      const T = TIERS[tier];
      g.fillStyle = T.cloth; g.fillRect(0, 0, 16, 16);
      g.fillStyle = T.dark; for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
      g.fillStyle = T.light; for (let x = 3; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
      g.fillStyle = T.trim; g.fillRect(0, 13, 16, 2);
    }, true)),
    mantle: tier => cached(`mantle/${tier}`, () => paint(16, 16, g => {
      const T = TIERS[tier];
      g.fillStyle = T.dark; g.fillRect(0, 0, 16, 16);
      g.fillStyle = T.trim; g.fillRect(0, 12, 16, 3);
      if (tier === "rare") { g.fillStyle = PAL.O; for (let x = 1; x < 16; x += 4) g.fillRect(x, 13, 1, 1); }
    }, true)),
  };
}
