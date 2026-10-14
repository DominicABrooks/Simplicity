// Shared rendering setup: PS1-style materials, hand-painted textures, shared geometry and the
// particle pool. One RenderContext is created by the renderer and handed to every builder, so
// nothing touches WebGL or the DOM at import time.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { HALF } from "../data/world.ts";
import { createParticles, type Particles } from "./particles.ts";
import { createTextures, type Textures } from "./textures.ts";

/** One tile is one world unit. Game x -> world X, game y -> world Z. */
export const PX_PER_TILE = 8;
export const WATER_Y = -0.15;
export const BED_Y = -0.6;

/** A game position (cell top-left, px) -> world X/Z of the cell's centre. */
export const toWorld = (x: number, y: number): [number, number] => [(x + HALF) / PX_PER_TILE, (y + HALF) / PX_PER_TILE];

export const box = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d);

/** A palette key ("R") or any CSS colour -> a THREE colour. */
export const col = (c: string): THREE.Color => new THREE.Color((PAL as Record<string, string>)[c] ?? c);

export interface RenderContext {
  scene: THREE.Scene;
  /** PS1 vertex snapping grid, in screen pixels (set on resize). */
  snap: { value: THREE.Vector2 };
  lambert(c: string, o?: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial;
  basic(c: string, o?: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial;
  /** A lathe (turned) mesh from [radius, y] points. */
  lathe(pts: [number, number][], mat: THREE.Material): THREE.Mesh;
  tex: Textures;
  /** The soft round blob shadow under everything. */
  shadowGeo: THREE.BufferGeometry;
  shadowMat: THREE.Material;
  particles: Particles;
}

export function createContext(scene: THREE.Scene): RenderContext {
  const snap = { value: new THREE.Vector2(160, 120) };
  // PS1 look: snap every vertex to a coarse screen grid, so geometry wobbles slightly as it moves.
  function ps1<M extends THREE.Material>(mat: M): M {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSnap = snap;
      sh.vertexShader = "uniform vec2 uSnap;\n" + sh.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;");
    };
    return mat;
  }
  const lambert = (c: string, o: THREE.MeshLambertMaterialParameters = {}) =>
    ps1(new THREE.MeshLambertMaterial({ color: col(c), flatShading: true, dithering: true, ...o }));
  const basic = (c: string, o: THREE.MeshBasicMaterialParameters = {}) => ps1(new THREE.MeshBasicMaterial({ color: col(c), ...o }));
  const lathe = (pts: [number, number][], mat: THREE.Material) =>
    new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 7), mat);

  return {
    scene, snap, lambert, basic, lathe,
    tex: createTextures(),
    shadowGeo: new THREE.CircleGeometry(0.34, 8).rotateX(-Math.PI / 2),
    shadowMat: basic("#000000", { transparent: true, opacity: 0.35, depthWrite: false, ...onGround(GROUND.shadow) }),
    particles: createParticles(scene, basic),
  };
}

/**
 * Things lying flat on the ground draw in layers. Each is pulled toward the camera in the depth test a
 * little more than the one below (polygonOffset) and sits a hair higher, so none flickers against
 * another or vanishes under a road: the paving, then dirt paths, the plaza's flagstones and rings, then
 * stains (cloud shadows, scorch marks), blob shadows, and on top the markers you need to see: the aim
 * arrow, the target ring, spell circles. Overlays stay at or below y = 0.012; marks start at 0.02.
 */
export const GROUND = { paving: 1, path: 2, plaza: 3, plazaRings: 4, stain: 6, shadow: 7, marker: 9 } as const;
export const onGround = (layer: number) => ({ polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -4 * layer });
/** How high blob shadows and markers sit. */
export const SHADOW_Y = 0.02, MARKER_Y = 0.03;

/** A blob shadow mesh, added to the scene. */
export function addShadow(ctx: RenderContext, scale = 1): THREE.Mesh {
  const shadow = new THREE.Mesh(ctx.shadowGeo, ctx.shadowMat);
  shadow.position.y = SHADOW_Y;
  shadow.scale.setScalar(scale);
  return shadow;
}
