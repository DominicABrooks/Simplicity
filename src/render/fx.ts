// One-shot effects from gameplay (src/game/fx.ts) turned into sparks and short-lived meshes:
// hit sparks, bursts, Frost Nova's ring, lightning columns and the level-up pillar; and the city's unease after dark
// (src/game/eerie.ts): a banging shutter, footprints nobody made, breaths of mist, a far-off bell's ring.
import * as THREE from "three";
import { EERIE } from "../data/eerie.ts";
import { PAL } from "../data/palette.ts";
import type { Fx } from "../game/fx.ts";
import { GROUND, onGround, PX_PER_TILE, toWorld, type RenderContext } from "./context.ts";
import { SPARK_PAIRS } from "./particles.ts";

export interface FxView {
  /** Spawn the visuals for this frame's effects. */
  consume(fx: Fx[]): void;
  update(dt: number): void;
}

interface Transient {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  life: number;
  total: number;
  grow?: boolean;
  rise?: boolean;
  /** Its opacity at the start (fading to nothing): 0.9 unless it says. */
  peak?: number;
}

/** A shutter swinging on its hinge (src/data/eerie.ts EERIE.shutter): its hinge, its window, and how long it's been going. */
interface Swing { pivot: THREE.Group; root: THREE.Group; t: number }

/** Where a town house's ground-floor windows are, their middle (render/town.ts): low enough to be in sight from the street. */
const WINDOW_AT = 0.75;
/** How far the house fronts stand out from their plot's edge (the jetty, and a hair). */
const FRONT_OUT = 0.14;
/** Each way a house front can face, as a turn about the vertical (a house is built facing +z, south). */
const FACING_YAW = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 } as const;

/** How far open a banging shutter is (radians) this long in: swung open and slammed, a little less each time. */
export function shutterOpen(t: number): number {
  const { slams, open } = EERIE.shutter;
  let from = 0;
  for (let i = 0; i < slams.length; i++) {
    const to = slams[i]!;
    if (t < to) {
      // Out quickly, a moment hanging open, then slammed back hard.
      const u = (t - from) / (to - from), k = u < 0.4 ? Math.sin((u / 0.4) * Math.PI / 2) : u < 0.8 ? 1 : 1 - ((u - 0.8) / 0.2) ** 2;
      return open[i]! * k;
    }
    from = to;
  }
  return 0;
}

export function createFxView(ctx: RenderContext): FxView {
  const { scene, basic, particles } = ctx;
  const transients: Transient[] = [], swings: Swing[] = [];
  const add = (mesh: Transient["mesh"], x: number, y: number, z: number, life: number, extra: Partial<Transient> = {}) => {
    mesh.position.set(x, y, z);
    scene.add(mesh);
    transients.push({ mesh, life, total: life, ...extra });
  };
  const additive = (c: string, o: THREE.MeshBasicMaterialParameters = {}) =>
    basic(c, { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, ...o });

  // Sparks thrown up from where something happened.
  const rise = () => 2 + Math.random() * 2;
  return {
    consume(list) {
      for (const f of list) {
        const [x, z] = toWorld(f.x, f.y);
        switch (f.type) {
          case "hit":
            particles.burst("hit", 5, x, 0.4, z, 3.5, rise, 0.25);
            break;
          case "burst":
            if (f.palette === "slime") particles.burst("big", 10, x, 0.4, z, 2.5, rise, 0.45);
            else particles.burst(SPARK_PAIRS[f.palette], 10, x, 0.4, z, 2.5, rise, 0.25);
            break;
          case "nova": {
            const R = f.radius / PX_PER_TILE;
            add(new THREE.Mesh(new THREE.RingGeometry(R * 0.8, R, 24).rotateX(-Math.PI / 2), additive(PAL.W, onGround(GROUND.marker))), x, 0.05, z, 0.35, { grow: true });
            particles.burst(SPARK_PAIRS.frost, 10, x, 0.4, z, 2.5, rise, 0.25);
            break;
          }
          case "toll": {
            // The Grey Ringer's bell: a pale ring of sound breaking outward, and a second, fainter one behind it.
            const R = f.radius / PX_PER_TILE;
            add(new THREE.Mesh(new THREE.RingGeometry(R * 0.82, R, 28).rotateX(-Math.PI / 2), additive("#bff8ec", onGround(GROUND.marker))), x, 0.05, z, 0.45, { grow: true });
            add(new THREE.Mesh(new THREE.RingGeometry(R * 0.5, R * 0.62, 28).rotateX(-Math.PI / 2), additive("#6fd3c0", onGround(GROUND.marker))), x, 0.06, z, 0.6, { grow: true });
            particles.burst(SPARK_PAIRS.frost, 14, x, 0.6, z, 3, rise, 0.4);
            break;
          }
          case "bolt":
            add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 5, 5).translate(0, 2.5, 0), additive("#fff6c8", { opacity: 1 })), x, 0, z, 0.18);
            add(new THREE.Mesh(new THREE.CircleGeometry(0.45, 10).rotateX(-Math.PI / 2), additive("#fff6c8", onGround(GROUND.marker))), x, 0.05, z, 0.25, { grow: true });   // where it strikes, the ground flashes
            particles.burst(SPARK_PAIRS.spark, 10, x, 0.4, z, 2.5, rise, 0.25);
            break;
          case "levelUp":
            // A golden pillar of light around the hero, rising and fading, with a ring of sparks.
            add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 3, 10, 1, true).translate(0, 1.5, 0),
              additive(PAL.Y, { opacity: 0.8, side: THREE.DoubleSide })), x, 0, z, 1.2, { rise: true });
            for (let i = 0; i < 18; i++) {
              const a = (i / 18) * Math.PI * 2;
              particles.spawn(i % 2 ? "spark" : "sparkLight", x + Math.cos(a) * 0.6, 0.2, z + Math.sin(a) * 0.6, Math.cos(a) * 0.8, 3 + Math.random() * 1.5, Math.sin(a) * 0.8, 0.8);
            }
            particles.burst("hit", 5, x, 0.4, z, 3.5, rise, 0.25);
            break;
          case "shutter": {
            // A lit window with nobody at it, and its shutter, hinged at one side, swinging out over the street.
            const root = new THREE.Group(), pivot = new THREE.Group();
            const hole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.02), ctx.glow("#e8b860"));
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.05), ctx.lambert("#a07a52"));
            leaf.position.x = 0.21;
            pivot.position.set(-0.21, 0, 0.035);
            pivot.add(leaf);
            root.add(hole, pivot);
            const yaw = FACING_YAW[f.facing];
            root.rotation.y = yaw;
            root.position.set(x + Math.sin(yaw) * FRONT_OUT, WINDOW_AT, z + Math.cos(yaw) * FRONT_OUT);
            scene.add(root);
            swings.push({ pivot, root, t: 0 });
            break;
          }
          case "footprint": {
            // A pale print on the stones, rimed like a frosty morning, pointing the way the hero went: nobody's foot made it.
            const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8).scale(1.8, 1, 1).rotateX(-Math.PI / 2),
              ctx.glow("#b9c6dc", { transparent: true, depthWrite: false, ...onGround(GROUND.stain) }));
            mesh.rotation.y = -f.angle;
            add(mesh, x, 0.025, z, EERIE.footsteps.prints, { peak: 0.6 });
            break;
          }
          case "puff":
            // A pale breath drifting up: out of a well, or where something stood a moment ago.
            for (let i = 0; i < f.n; i++) {
              particles.spawn(i % 2 ? "snow" : "dust", x + (Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.4, 3.2 + Math.random() * 1.6, (Math.random() - 0.5) * 0.4, 0.55);
            }
            break;
          case "chime": {
            // A far-off bell: a faint ring of sound spreading over the street, and a fainter one behind it.
            const R = f.radius / PX_PER_TILE;
            add(new THREE.Mesh(new THREE.RingGeometry(R * 0.9, R, 32).rotateX(-Math.PI / 2), additive("#f2e6b0", onGround(GROUND.marker))), x, 0.05, z, 0.9, { grow: true, peak: 0.55 });
            add(new THREE.Mesh(new THREE.RingGeometry(R * 0.55, R * 0.62, 32).rotateX(-Math.PI / 2), additive("#c9b878", onGround(GROUND.marker))), x, 0.06, z, 1.1, { grow: true, peak: 0.35 });
            break;
          }
        }
      }
    },
    update(dt) {
      for (let i = transients.length - 1; i >= 0; i--) {
        const tr = transients[i]!, m = tr.mesh;
        tr.life -= dt;
        const k = Math.max(0, tr.life / tr.total);
        m.material.opacity = k * (tr.peak ?? 0.9);
        if (tr.grow) m.scale.setScalar(0.4 + (1 - k) * 0.6);
        if (tr.rise) m.scale.set(1 + (1 - k) * 0.3, 0.6 + (1 - k) * 0.6, 1 + (1 - k) * 0.3);
        if (tr.life <= 0) {
          scene.remove(m);
          m.geometry.dispose();
          m.material.dispose();
          transients.splice(i, 1);
        }
      }
      for (let i = swings.length - 1; i >= 0; i--) {
        const sw = swings[i]!;
        sw.t += dt;
        sw.pivot.rotation.y = -shutterOpen(sw.t);
        if (sw.t < EERIE.shutter.slams[EERIE.shutter.slams.length - 1]! + 0.4) continue;
        scene.remove(sw.root);
        sw.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
        swings.splice(i, 1);
      }
    },
  };
}
