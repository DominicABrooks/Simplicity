// The fairy ring's spell, on screen (src/game/fairyring.ts): the view breathes and rolls, and a moonlit dusk wells up
// over the world from the edges in, veils of soft fey light drifting through it, ripples of light breathing out from
// the ring and motes of fairy light twinkling everywhere, the whole of it turning slowly round the ring. Deep enough in, it covers everything,
// and only the ring itself (drawn again on top, on its own layer) is left to see.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { smooth } from "../core/math.ts";
import { ringHere, tranceOf } from "../game/fairyring.ts";
import type { Game } from "../game/game.ts";
import { FEY_GROUND, FEY_LAYER } from "./fey.ts";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
uniform float uTime, uAmount, uAspect;
uniform vec2 uCentre;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Soft drifting veils: a few slow waves bent through each other.
float veil(vec2 q, float t) {
  float v = sin(q.x * 3.1 + sin(q.y * 2.3 + t * 0.4) * 1.6 + t * 0.3);
  v += sin(q.y * 4.2 + sin(q.x * 3.7 - t * 0.5) * 1.2 - t * 0.25) * 0.7;
  v += sin(length(q) * 5.0 - t * 0.6 + sin(q.x * 1.5) * 2.0) * 0.5;
  return v / 2.2;
}
// Twinkling motes on a grid of n cells, rising slowly: each a pin of light that swells and fades on its own beat.
float glitter(vec2 uv, float n, float t, float seed) {
  uv.y -= t * 0.035 * (1.0 + seed);
  vec2 cell = floor(uv * n), f = fract(uv * n);
  float h = hash(cell + seed), d = length(f - vec2(hash(cell + 3.1 + seed), hash(cell + 7.7 + seed)) * 0.8 - 0.1);
  float beat = pow(0.5 + 0.5 * sin(t * (1.5 + h * 3.0) + h * 40.0), 6.0);
  return step(0.55, h) * beat * (smoothstep(0.12, 0.0, d) + smoothstep(0.35, 0.0, d) * 0.3);
}
void main() {
  vec2 p = (vUv - uCentre) * vec2(uAspect, 1.0);
  float r = length(p), t = uTime;
  // The world turning slowly round the ring, more the deeper in, faster near it.
  float turn = uAmount * (0.6 / (0.4 + r)) * sin(t * 0.3) + t * 0.05 * uAmount;
  vec2 q = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * p;
  // Moonlit dusk under it all: deep violet, toward teal at the edges.
  vec3 col = mix(vec3(0.10, 0.06, 0.22), vec3(0.04, 0.20, 0.24), smoothstep(0.0, 1.2, r));
  // Veils of fey light drifting through it: lavender, mint, rose and pale gold, never harsh.
  float v = veil(q * 1.6, t);
  // One hue at a time, sliding round through them across the veils and over time, so each keeps its colour.
  float hue = v * 0.35 + r * 0.45 - t * 0.04;
  vec3 tint = vec3(0.62, 0.55, 0.72) + vec3(0.38, 0.4, 0.28) * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
  col += tint * smoothstep(-0.2, 0.9, v) * 0.6;
  // Rings of soft light breathing out from the fairy ring, like ripples on still water.
  col += mix(vec3(0.6, 1.0, 0.8), vec3(1.0, 0.75, 0.95), 0.5 + 0.5 * sin(r * 4.0 - t * 0.8)) * pow(0.5 + 0.5 * sin(r * 16.0 - t * 1.6), 10.0) * 0.3 * smoothstep(1.4, 0.1, r);
  // A soft glow round the ring itself.
  col += vec3(0.6, 1.0, 0.75) * smoothstep(0.45, 0.0, r) * 0.25;
  // Glitter: motes of fairy light twinkling everywhere, drifting up, in a few sizes.
  vec2 g = vec2(vUv.x * uAspect, vUv.y);
  float s = glitter(g, 9.0, t, 0.0) + glitter(g, 17.0, t, 1.7) * 0.8 + glitter(q + 4.0, 28.0, t, 3.3) * 0.6;
  col += mix(vec3(1.0, 0.95, 0.75), vec3(0.8, 1.0, 0.95), hash(floor(g * 9.0))) * s;
  col = floor(col * 12.0) / 12.0;                                               // banded a little, like everything else
  // Welling up from the edges, and over the middle too as it deepens, till nothing shows through; the glitter first.
  float edge = smoothstep(0.15, 1.1, r);
  float alpha = clamp(uAmount * (0.3 + edge) + smoothstep(0.7, 1.0, uAmount) + s * uAmount, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

export interface TranceView {
  /** Before the frame: how deep in he is now, and the camera breathing and rolling with it (after it's aimed). */
  pose(g: Game, camera: THREE.PerspectiveCamera, dt: number, t: number): void;
  /** After the world's drawn: the magic over it, and the ring on top. */
  draw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
}

/** The spell on screen. `lights` are lit on the ring's layer too, so it's lit the same when it's drawn again. */
export function createTrance(lights: readonly THREE.Light[]): TranceView {
  for (const l of lights) l.layers.enable(FEY_LAYER);
  const uniforms = { uTime: { value: 0 }, uAmount: { value: 0 }, uAspect: { value: 1 }, uCentre: { value: new THREE.Vector2(0.5, 0.5) } };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
  }));
  quad.frustumCulled = false;
  const overlay = new THREE.Scene(), flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  overlay.add(quad);
  const centre = new THREE.Vector3();
  /** How deep it shows (easing after the game's), and the camera's own field of view to breathe round. */
  let shown = 0, fov = 0;

  return {
    pose(g, camera, dt, t) {
      shown = smooth(shown, tranceOf(g), dt, 3);
      if (!fov) fov = camera.fov;
      const ring = ringHere(g);
      if (shown < 0.002 || !ring) {
        if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
        return;
      }
      camera.fov = fov + Math.sin(t * 1.3) * 4 * shown;
      camera.updateProjectionMatrix();
      camera.rotateZ(Math.sin(t * 0.7) * 0.07 * shown);
      camera.updateMatrixWorld();
      centre.set(ring.x / T, 0, ring.y / T).project(camera);
      uniforms.uCentre.value.set((centre.x + 1) / 2, (centre.y + 1) / 2);
      uniforms.uAspect.value = camera.aspect;
      uniforms.uTime.value = t;
      uniforms.uAmount.value = shown;
    },

    draw(renderer, scene, camera) {
      if (shown < 0.002) return;
      const autoClear = renderer.autoClear, background = scene.background;
      renderer.autoClear = false;
      renderer.render(overlay, flat);
      // The ring, again, over it all: only what's on its layer, with no sky behind. Still behind whatever stood in front
      // of it (him, in the middle of it), till so little else shows that it doesn't matter; then its grass too.
      const deep = shown > 0.85;
      if (deep) renderer.clearDepth();
      scene.background = null;
      camera.layers.set(FEY_LAYER);
      if (deep) camera.layers.enable(FEY_GROUND);
      renderer.render(scene, camera);
      camera.layers.set(0);
      scene.background = background;
      renderer.autoClear = autoClear;
    },
  };
}
