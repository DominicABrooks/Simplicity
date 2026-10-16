// Drawing the weather. Rain: one-pixel streaks slanting down round the camera, plinking little splashes
// on the ground. Snow (where it's always winter): flakes drifting down and swaying as they fall. Fog: the distance fog closes in and goes grey, and soft wisps drift low over the
// ground. Both dim the sun (an overcast sky), on top of whatever the hour's light is. Runs after the
// daylight each frame, so it only ever adjusts that frame's light, never compounds.
import * as THREE from "three";
import type { Weather } from "../data/weather.ts";
import type { RenderContext } from "./context.ts";

export interface Lights {
  sky: THREE.Color;
  fog: THREE.Fog;
  fill: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
}

export interface WeatherView {
  /** snow: how hard it's snowing, 0-1 (the weather itself only rains; an area's look decides it's snow). */
  update(w: Weather, dt: number, cx: number, cz: number, snow?: number): void;
}

const DROPS = 700, SPLASHES = 64, WISPS = 14, FLAKES = 900;
/** How fast snow falls (world units/s), and how far flakes sway as they fall. */
const FLAKE_FALL = 1.4, FLAKE_SWAY = 0.35;
/** Where drops fall, round the camera's target: wide enough to fill the view. */
const RAIN_X = 17, RAIN_Z0 = -14, RAIN_Z1 = 11, RAIN_TOP = 10;
const FALL = 15, SLANT = 2.2, DROP_LEN = 0.55;
/** The clear-weather fog distances (the renderer's), and how far they close in. */
const FOG_NEAR = 22, FOG_FAR = 52;

export function createWeatherView(ctx: RenderContext, lights: Lights): WeatherView {
  const { scene } = ctx;

  // Rain: line segments, each drop a head and a tail; only the first n are drawn as it gets heavier.
  const drops = new Float32Array(DROPS * 3);                 // head positions, relative to the camera target
  const pos = new Float32Array(DROPS * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xbfd4f0, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);
  const scatter = (i: number, y: number) => {
    drops[i * 3] = (Math.random() * 2 - 1) * RAIN_X;
    drops[i * 3 + 1] = y;
    drops[i * 3 + 2] = RAIN_Z0 + Math.random() * (RAIN_Z1 - RAIN_Z0);
  };
  for (let i = 0; i < DROPS; i++) scatter(i, Math.random() * RAIN_TOP);

  // Splashes: a pool of tiny flat diamonds that spread and fade where drops land.
  const splashMat = ctx.basic("#cfe2f5", { transparent: true, opacity: 0.8, depthWrite: false });
  const splashes = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07, 0).scale(1, 0.2, 1), splashMat, SPLASHES);
  splashes.frustumCulled = false;
  scene.add(splashes);
  const splashAge = new Float32Array(SPLASHES).fill(1), splashAt = new Float32Array(SPLASHES * 2);
  let nextSplash = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const SPLASH_LIFE = 0.22;

  // Fog wisps: big soft blobs lying low over the ground, drifting and wrapping round the camera.
  const wispTex = new THREE.CanvasTexture(softBlob());
  const wispMat = new THREE.MeshBasicMaterial({ map: wispTex, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const wispGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const wisps = Array.from({ length: WISPS }, () => {
    const mesh = new THREE.Mesh(wispGeo, wispMat);
    const size = 6 + Math.random() * 6;
    mesh.scale.set(size * 1.6, 1, size);
    mesh.position.set((Math.random() * 2 - 1) * 18, 0.4 + Math.random() * 0.9, -14 + Math.random() * 26);
    scene.add(mesh);
    return { mesh, drift: 0.3 + Math.random() * 0.4 };
  });

  // Snow: square points round the camera, each falling at its own pace and swaying on its own phase.
  const flakeAt = new Float32Array(FLAKES * 3), flakePhase = new Float32Array(FLAKES), flakePos = new Float32Array(FLAKES * 3);
  for (let i = 0; i < FLAKES; i++) {
    flakeAt[i * 3] = (Math.random() * 2 - 1) * RAIN_X;
    flakeAt[i * 3 + 1] = Math.random() * RAIN_TOP;
    flakeAt[i * 3 + 2] = RAIN_Z0 + Math.random() * (RAIN_Z1 - RAIN_Z0);
    flakePhase[i] = Math.random() * Math.PI * 2;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(flakePos, 3).setUsage(THREE.DynamicDrawUsage));
  const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false });
  const snowfall = new THREE.Points(snowGeo, snowMat);
  snowfall.frustumCulled = false;
  scene.add(snowfall);
  let snowT = 0;

  const mist = new THREE.Color();

  return {
    update(w, dt, cx, cz, snow = 0) {
      // Light: overcast dims the sun; rain dims the sky light a little too.
      const { sky, fog, fill, sun } = lights;
      const overcast = Math.max(w.rain, w.fog * 0.7);
      mist.copy(fill.color).multiplyScalar(Math.min(1, fill.intensity / 1.5) * (0.55 - w.rain * 0.2));
      sky.lerp(mist, Math.min(1, w.fog * 0.85 + w.rain * 0.45));
      fog.near = THREE.MathUtils.lerp(FOG_NEAR, 9, w.fog) - w.rain * 6;
      fog.far = THREE.MathUtils.lerp(FOG_FAR, 24, w.fog) - w.rain * 12;
      sun.intensity *= 1 - 0.75 * overcast;
      fill.intensity *= 1 - 0.45 * w.rain;

      // Rain.
      const n = Math.round(DROPS * w.rain);
      rain.visible = n > 0;
      rainMat.opacity = 0.35 + 0.3 * w.rain;
      rainMat.color.setHex(0xbfd4f0).multiplyScalar(0.3 + 0.7 * ctx.light.value);   // unlit, so dim it by night ourselves, as the flat colours are
      splashMat.color.copy(rainMat.color);
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        drops[k] += SLANT * dt;
        drops[k + 1] -= FALL * dt;
        if (drops[k + 1]! <= 0) {
          const x = drops[k]!, z = drops[k + 2]!;
          if (Math.abs(x) < 10 && z > -8 && z < 7 && Math.random() < 0.5) {
            splashAge[nextSplash] = 0;
            splashAt[nextSplash * 2] = cx + x; splashAt[nextSplash * 2 + 1] = cz + z;
            nextSplash = (nextSplash + 1) % SPLASHES;
          }
          scatter(i, RAIN_TOP * (0.7 + Math.random() * 0.3));
        }
        const p = i * 6, hx = cx + drops[k]!, hy = drops[k + 1]!, hz = cz + drops[k + 2]!;
        pos[p] = hx; pos[p + 1] = hy; pos[p + 2] = hz;
        pos[p + 3] = hx - (SLANT / FALL) * DROP_LEN; pos[p + 4] = hy + DROP_LEN; pos[p + 5] = hz;
      }
      rainGeo.setDrawRange(0, n * 2);
      rainGeo.attributes.position!.needsUpdate = true;

      for (let i = 0; i < SPLASHES; i++) {
        splashAge[i] = Math.min(1, splashAge[i]! + dt / SPLASH_LIFE);
        const a = splashAge[i]!, size = a >= 1 ? 0 : 0.6 + a * 1.4;
        m.compose(v.set(splashAt[i * 2]!, 0.03 + a * 0.05, splashAt[i * 2 + 1]!), q, s.set(size, size, size));
        splashes.setMatrixAt(i, m);
      }
      splashes.instanceMatrix.needsUpdate = true;
      splashes.visible = w.rain > 0;

      // Snow.
      const nf = Math.round(FLAKES * snow);
      snowfall.visible = nf > 0;
      snowT += dt;
      snowMat.color.setHex(0xffffff).multiplyScalar(0.35 + 0.65 * ctx.light.value);
      for (let i = 0; i < nf; i++) {
        const k = i * 3, ph = flakePhase[i]!;
        flakeAt[k + 1] -= FLAKE_FALL * (0.7 + (ph % 1) * 0.6) * dt;
        flakeAt[k] += 0.25 * dt;                                // a light wind from the west
        if (flakeAt[k + 1]! <= 0) { flakeAt[k + 1] = RAIN_TOP; flakeAt[k] = (Math.random() * 2 - 1) * RAIN_X; }
        if (flakeAt[k]! > RAIN_X) flakeAt[k] -= 2 * RAIN_X;
        flakePos[k] = cx + flakeAt[k]! + Math.sin(snowT * 1.3 + ph) * FLAKE_SWAY;
        flakePos[k + 1] = flakeAt[k + 1]!;
        flakePos[k + 2] = cz + flakeAt[k + 2]! + Math.cos(snowT * 0.9 + ph) * FLAKE_SWAY * 0.5;
      }
      snowGeo.setDrawRange(0, nf);
      snowGeo.attributes.position!.needsUpdate = true;

      // Fog wisps follow the camera: drift east, and wrap round when they fall out of view.
      wispMat.opacity = 0.32 * w.fog;
      wispMat.color.copy(mist).multiplyScalar(1.6);
      for (const wisp of wisps) {
        const p = wisp.mesh.position;
        wisp.mesh.visible = w.fog > 0;
        p.x += wisp.drift * dt;
        if (p.x - cx > 20) p.x -= 40; else if (p.x - cx < -20) p.x += 40;
        if (p.z - cz > 13) p.z -= 27; else if (p.z - cz < -14) p.z += 27;
      }
    },
  };
}

/** A soft round blob for the fog wisps, white fading to clear. */
function softBlob(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
