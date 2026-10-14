// Paths and paving that blend into the grass. Grass covers all the ground; a path or a street is an
// overlay whose edge follows a smooth field (the tile mask, blurred, plus noise) rather than the tile
// squares, so the boundary comes out as ragged, organic curves while the tiles underneath (and so
// collision) stay on the grid.
//
// The field is worked out per pixel: the layer's tiles go into a small mask texture whose linear
// filtering does the blurring (texel centres are tile centres), the noise is computed in the shader,
// and anything under the threshold is discarded. So the edge is crisp and pixel-sharp (in keeping with
// the pixel look), with no seams or triangle steps from the mesh underneath.
import * as THREE from "three";
import { Tile } from "../data/world.ts";
import type { TileMap } from "../world/map.ts";
import { onGround, type RenderContext } from "./context.ts";

export interface LayerStyle {
  texture: THREE.Texture;
  /** World units per texture repeat. */
  repeat: number;
  /** Height above the ground (layers stack: later ones sit higher), and its layer in GROUND. */
  lift: number;
  layer: number;
  /** How far the edge wanders from the tile grid (0 = straight edges, ~0.6 = very ragged). */
  wobble: number;
  seed: number;
}

/** The field's noise, in GLSL: smooth waves plus a quarter-tile grain, around 0.5. */
const NOISE = /* glsl */ `
  float layerHash(vec2 p, float s) { return fract(sin(dot(p, vec2(127.1, 311.7)) + s * 74.7) * 43758.5453); }
  float layerNoise(vec2 p, float s) {
    return 0.5 + 0.3 * sin(p.x * 2.1 + p.y * 1.3 + s) * cos(p.x * 0.7 - p.y * 1.9 + s * 0.7) + 0.2 * (layerHash(floor(p * 4.0), s) - 0.5);
  }
`;

/** An overlay for every tile `member` accepts (and a ring round them for its edge to spill onto). Null if there are none. */
export function blendLayer(ctx: RenderContext, map: TileMap, member: (t: Tile) => boolean, style: LayerStyle): THREE.Mesh | null {
  const { width: W, height: H, tiles } = map;
  const inLayer = (x: number, y: number) => member(tiles[Math.max(0, Math.min(H - 1, y))]![Math.max(0, Math.min(W - 1, x))]!);
  // The mask: one texel per tile, white where the layer is.
  const mask = new Uint8Array(W * H * 4);
  let any = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inLayer(x, y)) { mask.fill(255, (y * W + x) * 4, (y * W + x) * 4 + 4); any = true; }
  if (!any) return null;
  const maskTex = new THREE.DataTexture(mask, W, H, THREE.RGBAFormat);
  maskTex.magFilter = maskTex.minFilter = THREE.LinearFilter;
  maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping;
  maskTex.needsUpdate = true;

  // Quads over the layer's tiles and every tile next to one (where its edge can wander), but never over
  // water: the layer lies on the ground, and a spill over a river would float on it.
  const pos: number[] = [], uv: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tiles[y]![x] === Tile.Water) continue;
    let near = false;
    for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1; i++) if (inLayer(x + i, y + j)) { near = true; break; }
    if (!near) continue;
    for (const [px, pz] of [[x, y], [x, y + 1], [x + 1, y + 1], [x, y], [x + 1, y + 1], [x + 1, y]] as const) {
      pos.push(px, style.lift, pz);
      uv.push(px / style.repeat, pz / style.repeat);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();

  const mat = ctx.lambert("#ffffff", { map: style.texture, side: THREE.DoubleSide, ...onGround(style.layer) });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, renderer) => {
    base.call(mat, sh, renderer);
    Object.assign(sh.uniforms, {
      uMask: { value: maskTex }, uMapSize: { value: new THREE.Vector2(W, H) }, uWobble: { value: style.wobble }, uSeed: { value: style.seed },
    });
    sh.vertexShader = "varying vec2 vGround;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vGround = (modelMatrix * vec4(transformed, 1.0)).xz;");
    sh.fragmentShader = "varying vec2 vGround;\nuniform sampler2D uMask;\nuniform vec2 uMapSize;\nuniform float uWobble;\nuniform float uSeed;\n" + NOISE +
      sh.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
  if (texture2D(uMask, vGround / uMapSize).r + uWobble * (layerNoise(vGround, uSeed) - 0.5) < 0.5) discard;`);
  };
  mat.customProgramCacheKey = () => "groundLayer";
  mat.userData.maskTex = maskTex;                              // freed with the layer (see dispose.ts)
  return new THREE.Mesh(geo, mat);
}
