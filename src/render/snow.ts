// The snow look (a map's look "snow": the Frozen Hollow, where it's always winter): the ground under snow, the
// leaves frosted white, the mountains snow from foot to peak, and lakes frozen to ice you can walk on.
import * as THREE from "three";

/** A texture recoloured pixel by pixel (the same pattern), one copy each per recolouring. */
function recolour(copies: Map<THREE.Texture, THREE.CanvasTexture>, t: THREE.CanvasTexture, fn: (v: number) => [number, number, number]): THREE.CanvasTexture {
  const done = copies.get(t);
  if (done) return done;
  const src = t.image as HTMLCanvasElement, c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, gg, b] = fn((d[i]! * 0.3 + d[i + 1]! * 0.55 + d[i + 2]! * 0.15) / 255);
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  g.putImageData(px, 0, 0);
  const out = new THREE.CanvasTexture(c);
  out.magFilter = t.magFilter; out.minFilter = t.minFilter; out.wrapS = t.wrapS; out.wrapT = t.wrapT; out.colorSpace = t.colorSpace;
  copies.set(t, out);
  return out;
}

const snowCopies = new Map<THREE.Texture, THREE.CanvasTexture>(), frostCopies = new Map<THREE.Texture, THREE.CanvasTexture>();
/** Grass under snow: the grass's pattern kept as faint blue-grey drifts in white. */
export const snowy = (t: THREE.CanvasTexture): THREE.CanvasTexture =>
  recolour(snowCopies, t, v => { const k = 0.86 + v * 0.35; return [Math.min(255, 222 * k), Math.min(255, 230 * k), Math.min(255, 240 * k)]; });
/** Leaves with frost on them: white, the darker leaves a cold blue-grey. */
export const frosted = (t: THREE.CanvasTexture): THREE.CanvasTexture =>
  recolour(frostCopies, t, v => { const k = 0.7 + v * 0.8; return [Math.min(255, 200 * k), Math.min(255, 212 * k), Math.min(255, 226 * k)]; });

let ice: THREE.CanvasTexture | null = null;
/** Lake ice: pale blue-white, streaks of clearer ice, and fine cracks. One shared copy. */
export function iceTexture(): THREE.CanvasTexture {
  if (ice) return ice;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  let seed = 0x5eed1ce;
  const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  g.fillStyle = "#b9d9e6"; g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#a6cbdc";
  for (let i = 0; i < 10; i++) g.fillRect(Math.floor(rand() * 32), Math.floor(rand() * 32), 4 + Math.floor(rand() * 6), 2);
  g.fillStyle = "#dceff6";                                  // streaks of white, wind-polished
  for (let i = 0; i < 9; i++) g.fillRect(Math.floor(rand() * 32), Math.floor(rand() * 32), 3 + Math.floor(rand() * 7), 1);
  g.fillStyle = "#86adc1";                                  // the cracks, little zigzags
  for (let i = 0; i < 4; i++) {
    let x = Math.floor(rand() * 32), y = Math.floor(rand() * 32);
    for (let s = 0; s < 7; s++) { g.fillRect(x & 31, y & 31, 1, 1); x += 1; y += rand() < 0.5 ? 1 : -1; }
  }
  ice = new THREE.CanvasTexture(c);
  ice.magFilter = ice.minFilter = THREE.NearestFilter;
  ice.generateMipmaps = false;
  ice.colorSpace = THREE.SRGBColorSpace;
  ice.wrapS = ice.wrapT = THREE.RepeatWrapping;
  return ice;
}

/** A mountain facet's colour under snow, by its height: snow from the foothills up, blue-grey rock showing through on the steeps. */
export function snowFacet(c: THREE.Color, hAvg: number, n: number): THREE.Color {
  if (hAvg < 2.2) return c.set(n < 0.5 ? "#e6edf2" : "#d8e2ea");
  if (hAvg < 8.5) return c.set(["#e9eff4", "#7d8794", "#cfdae3", "#6b7480"][Math.floor(n * 4)]!);
  return c.set(n < 0.6 ? "#f6f9fc" : "#e1e9f0");
}

/** A leaf colour in the snow: frost-white, a little blue, some a little darker. */
export function snowLeaf(x: number, z: number, b: number, hash: (x: number, z: number, k: number) => number): THREE.Color {
  const k = hash(x, z, 13), w = Math.min(1.1, b * 1.05);
  return k < 0.2 ? new THREE.Color(w * 0.8, w * 0.86, w * 0.95) : new THREE.Color(w, w * 1.0, w * 1.04);
}
