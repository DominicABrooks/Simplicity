// One-shot effects from gameplay (src/game/fx.ts) turned into sparks and short-lived meshes:
// hit sparks, bursts, Frost Nova's ring, lightning columns and the level-up pillar.
import * as THREE from "three";
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
}

export function createFxView(ctx: RenderContext): FxView {
  const { scene, basic, particles } = ctx;
  const transients: Transient[] = [];
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
        }
      }
    },
    update(dt) {
      for (let i = transients.length - 1; i >= 0; i--) {
        const tr = transients[i]!, m = tr.mesh;
        tr.life -= dt;
        const k = Math.max(0, tr.life / tr.total);
        m.material.opacity = k * 0.9;
        if (tr.grow) m.scale.setScalar(0.4 + (1 - k) * 0.6);
        if (tr.rise) m.scale.set(1 + (1 - k) * 0.3, 0.6 + (1 - k) * 0.6, 1 + (1 - k) * 0.3);
        if (tr.life <= 0) {
          scene.remove(m);
          m.geometry.dispose();
          m.material.dispose();
          transients.splice(i, 1);
        }
      }
    },
  };
}
