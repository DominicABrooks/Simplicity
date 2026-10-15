// Journal portraits: each enemy's real model, rendered once into a small, low-res image in the same
// PS1 style as the game (vertex snapping, flat lambert, the same lights). Uses its own little WebGL
// context, which is released as soon as the portraits are drawn.
import * as THREE from "three";
import type { BestiaryId } from "../data/bestiary.ts";
import type { BoltKind, School } from "../data/enemies.ts";
import { PAL } from "../data/palette.ts";
import { createContext, type RenderContext } from "./context.ts";
import { makeMageBody, makeSlimeModel } from "./models/enemies.ts";
import { makeGhostModel } from "./models/ghost.ts";
import { makeOrbMesh } from "./models/projectiles.ts";

/** Portrait size in pixels (shown scaled up, pixelated). */
export const PORTRAIT_SIZE = 64;

const MAGE_ORB: Record<School, BoltKind> = { ember: "fire", frost: "frost", storm: "spark" };

/** Turned three-quarters toward the camera (models face +X). */
const THREE_QUARTER = -Math.PI / 2 + 0.5;

interface Pose {
  /** Build the model into the scene; returns what to frame. */
  build(ctx: RenderContext): THREE.Object3D;
  /** Look at this height, from this far away. */
  lookY: number;
  distance: number;
}

/** A mage mid-cast: both hands forward, an orb of its school between them. */
const magePose = (school: School): Pose => ({
  build(ctx) {
    const m = makeMageBody(ctx, school);
    m.hands.forEach((h, i) => h.position.set(0.36, 0.56, (i === 0 ? 1 : -1) * 0.17));
    const orb = makeOrbMesh(ctx, MAGE_ORB[school]);
    orb.position.set(0.5, 0.62, 0);
    orb.scale.setScalar(0.9);
    m.group.add(orb);
    return m.group;
  },
  lookY: 0.62,
  distance: 2.9,
});

const POSES: Record<BestiaryId, Pose> = {
  slime: {
    build(ctx) {
      const { group, body } = makeSlimeModel(ctx);
      body.scale.set(1.06, 0.94, 1.06);                      // mid-wobble
      ctx.scene.add(group);
      return group;
    },
    lookY: 0.28,
    distance: 1.7,
  },
  ember: magePose("ember"),
  frost: magePose("frost"),
  storm: magePose("storm"),
  ghost: {
    build(ctx) {
      const m = makeGhostModel(ctx);
      m.body.position.y = 0.15;
      m.bellArm.rotation.z = 2.3;                             // her bell raised to ring
      m.reachArm.rotation.z = 1.2;
      m.bell.rotation.z = 0.4;
      ctx.scene.add(m.group);
      return m.group;
    },
    lookY: 0.9,
    distance: 4.2,
  },
};

/** Render every portrait. Returns PNG data URLs by bestiary id. */
export function renderPortraits(): Record<BestiaryId, string> {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(PORTRAIT_SIZE, PORTRAIT_SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);

  const out = {} as Record<BestiaryId, string>;
  for (const [id, pose] of Object.entries(POSES) as [BestiaryId, Pose][]) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xcfe3ff, new THREE.Color(PAL.v), 1.5));
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
    sun.position.set(-3, 6, 4);
    scene.add(sun);
    const ctx = createContext(scene);
    ctx.snap.value.set(PORTRAIT_SIZE / 2, PORTRAIT_SIZE / 2);
    const model = pose.build(ctx);
    model.rotation.y = THREE_QUARTER;
    // Slightly above, like the game camera, but closer and lower.
    camera.position.set(0, pose.lookY + pose.distance * 0.35, pose.distance);
    camera.lookAt(0, pose.lookY, 0);
    renderer.render(scene, camera);
    out[id] = canvas.toDataURL("image/png");
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
