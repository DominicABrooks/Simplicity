// The 3D view: renders the 2D game state as a low-poly PS1-era scene. A low-res canvas scaled up
// with nearest filtering, vertex snapping, fog, flat-shaded lambert materials and blob shadows.
// Rendering reads the game and never changes it (apart from consuming the one-shot effects queue).
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { HALF } from "../data/world.ts";
import type { Game } from "../game/game.ts";
import { createAmbient } from "./ambient.ts";
import { disposeTree } from "./dispose.ts";
import { PX_PER_TILE, createContext, toWorld } from "./context.ts";
import { createFishingView } from "./fishing.ts";
import { createFxView } from "./fx.ts";
import { createHeroView } from "./hero.ts";
import { createKoiPond } from "./koi.ts";
import type { Projector } from "./projector.ts";
import { buildProp } from "./props.ts";
import { createRenderSystem } from "./renderSystem.ts";
import { createTargetRing } from "./targetRing.ts";
import { buildTerrain } from "./terrain.ts";
import { smooth } from "../core/math.ts";

export interface Renderer extends Projector {
  /** Match the window: render at 1/pixelSize resolution. */
  resize(pixelSize: number): void;
  render(g: Game, dt: number): void;
  /** Debug: the ambient critters. */
  critters(): unknown;
  /** Debug: live GPU resources (to check nothing leaks as you travel). */
  memory(): { geometries: number; textures: number };
}

const CAM_OFFSET = new THREE.Vector3(0, 11.5, 8.5);

export function createRenderer(canvas: HTMLCanvasElement, g: Game): Renderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const sky = new THREE.Color(PAL.k);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 22, 52);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  const camTarget = new THREE.Vector3();
  scene.add(new THREE.HemisphereLight(0xcfe3ff, new THREE.Color(PAL.v), 1.5));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(-3, 6, 2);                                // top-left of screen, as in ART_STYLE.md
  scene.add(sun);

  const ctx = createContext(scene);
  const world = new THREE.Group();
  scene.add(world);
  const ambient = createAmbient(ctx);
  const koi = createKoiPond(ctx);
  const fishing = createFishingView(ctx, world);
  const fx = createFxView(ctx);
  const hero = createHeroView(ctx);
  const renderEntities = createRenderSystem(ctx);
  /** Per-frame updates of the current area's animated props (a campfire's flames, a keep's flags). */
  let animated: ((t: number, dt: number) => void)[] = [];
  const targetRing = createTargetRing(ctx);

  // Arriving in an area: free the last area's scenery and build this one's, then jump the camera to
  // the hero. Only one area's scenery is ever in memory.
  let scenery = new THREE.Group();
  world.add(scenery);
  g.events.on("area", ({ def, layout }) => {
    world.remove(scenery);
    disposeTree(scenery);
    scenery = new THREE.Group();
    world.add(scenery);
    scenery.add(buildTerrain(ctx, layout.map));
    animated = layout.props.map(prop => buildProp(ctx, scenery, prop)).filter(u => u !== null);
    koi.setMap(layout.map);
    ambient.setMap(layout.map, !!def.life?.ambient);
    const p = g.world.need(g.player, "transform");
    const [x, z] = toWorld(p.x, p.y);
    camTarget.set(x, 0, z);
  });

  const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), proj = new THREE.Vector3();

  return {
    resize(pixelSize) {
      const w = Math.ceil(innerWidth / pixelSize), h = Math.ceil(innerHeight / pixelSize);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      ctx.snap.value.set(w / 3, h / 3);
    },

    render(g, dt) {
      const t = g.clock, pos = g.world.need(g.player, "transform");
      const [px, pz] = hero.update(g, t, dt);
      renderEntities(g, { t, dt, hero: pos });
      fx.update(dt);
      fx.consume(g.fx.splice(0));
      ctx.particles.update(dt);
      hero.updateTrail(g, dt);
      const bobber = fishing.update(hero.body, pos, g.world.need(g.player, "actions"), t);
      koi.update(dt, t, px, pz, bobber);
      ambient.update(dt, t, px, pz);
      for (const update of animated) update(t, dt);
      targetRing.update(g, t);

      // World animation and camera.
      ctx.tex.water.offset.set((t * 0.06) % 1, (t * 0.03) % 1);
      camTarget.set(smooth(camTarget.x, px, dt, 8), 0, smooth(camTarget.z, pz, dt, 8));
      camera.position.copy(camTarget).add(CAM_OFFSET);
      camera.lookAt(camTarget);
      if (g.shake > 0.01) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * g.shake * 0.35, 0, (Math.random() - 0.5) * g.shake * 0.35));
      renderer.render(scene, camera);
    },

    screenToGame(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      if (!ray.ray.intersectPlane(groundPlane, hit)) return null;
      return { x: hit.x * PX_PER_TILE - HALF, y: hit.z * PX_PER_TILE - HALF };
    },

    gameToScreen(x, y, height = 0) {
      const [wx, wz] = toWorld(x, y);
      proj.set(wx, height, wz).project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((proj.x + 1) / 2) * r.width, y: r.top + ((1 - proj.y) / 2) * r.height };
    },

    critters: () => ambient.critters(),
    memory: () => ({ ...renderer.info.memory }),
  };
}
