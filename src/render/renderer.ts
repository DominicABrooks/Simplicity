// The 3D view: renders the 2D game state as a low-poly PS1-era scene. A low-res canvas scaled up
// with nearest filtering, vertex snapping, fog, flat-shaded lambert materials and blob shadows.
// Rendering reads the game and never changes it (apart from consuming the one-shot effects queue).
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { HALF, T } from "../data/world.ts";
import type { Game } from "../game/game.ts";
import { createAmbient } from "./ambient.ts";
import { createDaylight } from "./daylight.ts";
import { createWeatherView } from "./weather.ts";
import { disposeTree } from "./dispose.ts";
import { PX_PER_TILE, createContext, toWorld } from "./context.ts";
import { createFishingView } from "./fishing.ts";
import { createFxView } from "./fx.ts";
import { createHeroView } from "./hero.ts";
import { createKoiPond } from "./koi.ts";
import type { Projector } from "./projector.ts";
import { createOcclusion } from "./occlusion.ts";
import { buildProp } from "./props.ts";
import { createRenderSystem } from "./renderSystem.ts";
import { createTargetRing } from "./targetRing.ts";
import { compactScenery } from "./compact.ts";
import { buildTerrain, groundUnderBridges } from "./terrain.ts";
import { smooth } from "../core/math.ts";
import { shift } from "../world/townkit.ts";

export interface Renderer extends Projector {
  /** Match the window: render at 1/pixelSize resolution. */
  resize(pixelSize: number): void;
  render(g: Game, dt: number): void;
  /** Debug: the ambient critters. */
  critters(): unknown;
  /** Debug: live GPU resources (to check nothing leaks as you travel). */
  memory(): { geometries: number; textures: number };
}

/** The light inside a house: no sky, a dim warm fill and a low sun for shading (the hearth brings its own fire). */
const INDOORS = { sky: "#120d10", fill: 0xffd8b0, fillI: 0.85, sun: 0xffc890, sunI: 0.55 } as const;
const CAM_OFFSET = new THREE.Vector3(0, 11.5, 8.5);

export function createRenderer(canvas: HTMLCanvasElement, g: Game): Renderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const sky = new THREE.Color(PAL.k);
  scene.background = sky;
  const fog = new THREE.Fog(sky, 22, 52);
  fog.color = sky;                                           // shared (the constructor copies it), so the fog follows the sky
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  const camTarget = new THREE.Vector3();
  /** How far out the camera sits (1 the usual; a cutscene moves it in and out). */
  let camZoom = 1;
  const fill = new THREE.HemisphereLight(0xcfe3ff, new THREE.Color(PAL.v), 1.5);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(-3, 6, 2);                                // top-left of screen, as in ART_STYLE.md
  scene.add(sun);
  const daylight = createDaylight(sky, fill, sun);

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
  const occlusion = createOcclusion(scene);
  const targetRing = createTargetRing(ctx);
  const weather = createWeatherView(ctx, { sky, fog, fill, sun });

  // Arriving in an area: free the last area's scenery and build this one's, then jump the camera to
  // the hero. Only one area's scenery is ever in memory.
  let scenery = new THREE.Group();
  world.add(scenery);
  g.events.on("area", ({ def, layout }) => {
    world.remove(scenery);
    disposeTree(scenery, new Set([ctx.shadowGeo, ctx.shadowMat]));   // shared with everyone's shadows
    scenery = new THREE.Group();
    world.add(scenery);
    // Drawn: the map, or its view when it shows what lies past its edges (the next district along).
    const view = layout.view ?? { map: layout.map, x: 0, y: 0, props: [] }, props = [...layout.props, ...view.props];
    const bridges = props.filter(p => p.kind === "bridge" || p.kind === "stoneBridge" || p.kind === "drawbridge").map(p => shift(p, -view.x * T, -view.y * T));
    const terrain = buildTerrain(ctx, groundUnderBridges(view.map, bridges), view, !!def.indoors);
    scenery.add(terrain.group);
    const built = props.map(prop => buildProp(ctx, scenery, prop));
    animated = built.flatMap(b => (b.update ? [b.update] : []));
    const occluders = built.flatMap(b => b.occluders);
    compactScenery(scenery, occluders.map(o => o.object), animated, [terrain.group]);
    occlusion.set(occluders, terrain.trees);
    koi.setMap(layout.map, layout.props);
    targetRing.setProps(props);
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
      ambient.update(dt, t, px, pz, g.hour);
      for (const update of animated) update(t, dt);
      occlusion.update(px, pz, CAM_OFFSET, dt);
      targetRing.update(g, t);

      // World animation, light and camera.
      if (g.area.def.indoors) {                              // indoors: dark beyond the walls, lit warm by the fire
        sky.set(INDOORS.sky);
        fill.color.set(INDOORS.fill);
        fill.intensity = INDOORS.fillI;
        sun.color.set(INDOORS.sun);
        sun.intensity = INDOORS.sunI;
      } else daylight.update(g.hour);
      ctx.tex.water.offset.set((t * 0.06) % 1, (t * 0.03) % 1);
      // The camera follows the hero, or in a cutscene looks where the scene says, easing slowly from shot to shot.
      const shot = g.world.get(g.player, "cutscene")?.cam, ease = shot ? 2.2 : 8;
      const lookX = shot ? shot.x / PX_PER_TILE : px, lookZ = shot ? shot.y / PX_PER_TILE : pz;
      camTarget.set(smooth(camTarget.x, lookX, dt, ease), 0, smooth(camTarget.z, lookZ, dt, ease));
      camZoom = smooth(camZoom, shot?.zoom ?? 1, dt, shot ? 1.6 : 3);
      weather.update(g.area.def.indoors ? { ...g.weather, fog: 0, rain: 0 } : g.weather, dt, camTarget.x, camTarget.z);   // no rain indoors
      // How much light there is now, from the sky light and the sun as the hour and weather leave them (1 by day,
      // about a third at night): flat colours are shaded by it, and enemies glow a little more the darker it gets.
      ctx.light.value = THREE.MathUtils.clamp((fill.intensity * 0.6 + sun.intensity * 0.25) / 1.5, 0.22, 1);
      ctx.nightGlow.value = (1 - ctx.light.value) * 0.45;
      camera.position.copy(camTarget).addScaledVector(CAM_OFFSET, camZoom);
      camera.lookAt(camTarget);
      if (g.shake > 0.01) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * g.shake * 0.35, 0, (Math.random() - 0.5) * g.shake * 0.35));
      // Asleep, only the scenery, the hero and the light are drawn: nobody and nothing else moving about (and the
      // shade over the screen, src/ui/sleepShade.ts, blacks out all but his bed). Put back as they were after.
      const asleep = g.world.has(g.player, "sleeping");
      const hidden = asleep ? scene.children.filter(o => o.visible && o !== world && o !== hero.body.group && o !== hero.body.shadow && !(o instanceof THREE.Light)) : [];
      for (const o of hidden) o.visible = false;
      renderer.render(scene, camera);
      for (const o of hidden) o.visible = true;
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
