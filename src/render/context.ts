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
  /** A flat colour, unlit but shaded by how much light there is (see light): it dims at night and indoors like everything else. */
  basic(c: string, o?: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial;
  /** A flat colour that gives its own light, as bright at midnight as at noon: flames, lit windows, glowing eyes, spells, markers. */
  glow(c: string, o?: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial;
  /** Make these lit materials glow faintly of themselves in the dark (see nightGlow): enemies you need to see by night. */
  glowAtNight(...mats: THREE.Material[]): void;
  /** How much light there is: 1 by day, down to about a third at night (the renderer sets it from the sky and sun each frame). */
  light: { value: number };
  /** How strongly the glowAtNight materials glow: not at all by day, more as it darkens. */
  nightGlow: { value: number };
  /** A lathe (turned) mesh from [radius, y] points. */
  lathe(pts: [number, number][], mat: THREE.Material): THREE.Mesh;
  tex: Textures;
  /** The soft round blob shadow under everything. */
  shadowGeo: THREE.BufferGeometry;
  shadowMat: THREE.Material;
  particles: Particles;
}

/**
 * The PS1 snap, after three's project_vertex. The snapped pixel's ray runs from a (near plane) to b (far
 * plane); the vertex moves along it to its own height, so it lands on the pixel at the depth a point there
 * really has. (Behind the camera, or where the ray never reaches its height, it is only moved on screen.)
 */
const SNAP_VERTEX = /* glsl */ `
  vec2 snapped = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap;
  if (gl_Position.w > 0.0) {
    mat4 unproject = inverse(projectionMatrix);
    mat3 toWorld = transpose(mat3(viewMatrix));
    vec4 a = unproject * vec4(snapped, -1.0, 1.0), b = unproject * vec4(snapped, 1.0, 1.0);
    vec3 wa = toWorld * (a.xyz / a.w) + cameraPosition, wb = toWorld * (b.xyz / b.w) + cameraPosition;
    float level = (toWorld * mvPosition.xyz + cameraPosition).y, rise = wb.y - wa.y, along = abs(rise) > 1e-6 ? (level - wa.y) / rise : -1.0;
    if (along >= 0.0 && along <= 1.0) gl_Position = projectionMatrix * viewMatrix * vec4(mix(wa, wb, along), 1.0);
  }
  gl_Position.xy = snapped * gl_Position.w;`;

export function createContext(scene: THREE.Scene): RenderContext {
  const snap = { value: new THREE.Vector2(160, 120) };
  const light = { value: 1 }, nightGlow = { value: 0 };
  // PS1 look: snap every vertex to a coarse screen grid, so geometry wobbles slightly as it moves. The vertex
  // slides level to the snapped pixel (to where that pixel's ray meets its own height) rather than just being
  // moved on screen, so its depth moves with it: flat things stay flat in the depth test, and ground layers
  // with different vertices (the plaza and its rings, a floor and its boards) don't fight. And by kind:
  // a flat colour shaded by the light ("dim"), or a lit material with a faint glow of its own in the dark. Each
  // kind is its own shader program (three.js would otherwise share one between handlers whose source reads the same).
  function ps1<M extends THREE.Material>(mat: M, kind: "lit" | "glow" | "dim" | "nightGlow" = "lit"): M {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSnap = snap;
      sh.vertexShader = "uniform vec2 uSnap;\n" + sh.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n" + SNAP_VERTEX);
      if (kind === "dim") {
        sh.uniforms.uLight = light;
        sh.fragmentShader = "uniform float uLight;\n" + sh.fragmentShader.replace("#include <opaque_fragment>", "#include <opaque_fragment>\n  gl_FragColor.rgb *= uLight;");
      }
      if (kind === "nightGlow") {
        sh.uniforms.uNightGlow = nightGlow;
        sh.fragmentShader = "uniform float uNightGlow;\n" + sh.fragmentShader.replace("#include <opaque_fragment>", "outgoingLight += diffuseColor.rgb * uNightGlow;\n#include <opaque_fragment>");
      }
    };
    mat.customProgramCacheKey = () => "ps1-" + kind;
    return mat;
  }
  const lambert = (c: string, o: THREE.MeshLambertMaterialParameters = {}) =>
    ps1(new THREE.MeshLambertMaterial({ color: col(c), flatShading: true, dithering: true, ...o }));
  const basic = (c: string, o: THREE.MeshBasicMaterialParameters = {}) => ps1(new THREE.MeshBasicMaterial({ color: col(c), ...o }), "dim");
  const glow = (c: string, o: THREE.MeshBasicMaterialParameters = {}) => ps1(new THREE.MeshBasicMaterial({ color: col(c), ...o }), "glow");
  const glowAtNight = (...mats: THREE.Material[]) => { for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) ps1(m, "nightGlow"); };
  const lathe = (pts: [number, number][], mat: THREE.Material) =>
    new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 7), mat);

  return {
    scene, snap, lambert, basic, glow, glowAtNight, light, nightGlow, lathe,
    tex: createTextures(),
    shadowGeo: new THREE.CircleGeometry(0.34, 8).rotateX(-Math.PI / 2),
    shadowMat: basic("#000000", { transparent: true, opacity: 0.35, depthWrite: false, ...onGround(GROUND.shadow) }),
    particles: createParticles(scene, glow),                 // sparks, fire and spells shine
  };
}

/**
 * Things lying flat on the ground draw in layers. Each is pulled toward the camera in the depth test a
 * little more than the one below (polygonOffset) and sits a hair higher, so none flickers against
 * another or vanishes under a road: the paving, then dirt paths, the plaza's flagstones and rings, then
 * stains (cloud shadows, scorch marks), blob shadows, and on top the markers you need to see: the aim
 * arrow, the target ring, spell circles (a rug indoors goes between the plaza's rings and the stains). Overlays stay at or
 * below y = 0.012; marks start at 0.02.
 */
export const GROUND = { paving: 1, path: 2, plaza: 3, plazaRings: 4, rug: 5, stain: 6, shadow: 7, marker: 9 } as const;
export const onGround = (layer: number) => ({ polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -4 * layer });
/**
 * Something laid on another face, a hair proud of it (a panel on a throne's back, the dragon on a tapestry,
 * glass in its frame), `layer` deep: 1 on the face, 2 on that... The PS1 vertex snap moves each vertex up to
 * most of a pixel across the screen but not in depth, which tilts a face's depth by more than that hair, and
 * which of the two wins then changes as the camera moves: whole panels flicker in and out as you walk. So
 * each layer is pulled toward the camera in the depth test by more than the snap can tilt it (two pixels of
 * the face's own depth slope).
 */
export const onFace = (layer = 1) => ({ polygonOffset: true, polygonOffsetFactor: -2 * layer, polygonOffsetUnits: -4 * layer });
/** How high blob shadows and markers sit. */
export const SHADOW_Y = 0.02, MARKER_Y = 0.03;

/** A blob shadow mesh, added to the scene. */
export function addShadow(ctx: RenderContext, scale = 1): THREE.Mesh {
  const shadow = new THREE.Mesh(ctx.shadowGeo, ctx.shadowMat);
  shadow.position.y = SHADOW_Y;
  shadow.scale.setScalar(scale);
  return shadow;
}
