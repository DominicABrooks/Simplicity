// Little tumbling octahedron sparks: hit bursts, embers, splashes, dust. Fire and forget.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";

export type SparkColor = "hit" | "big" | "water" | "fire" | "ember" | "arcane" | "arcaneLight" | "ice" | "snow" | "spark" | "sparkLight" | "dust";

/** Two-tone spark colours for each kind of burst. */
export const SPARK_PAIRS = {
  fire: ["fire", "ember"],
  arcane: ["arcane", "arcaneLight"],
  frost: ["ice", "snow"],
  spark: ["spark", "sparkLight"],
} as const satisfies Record<string, readonly [SparkColor, SparkColor]>;
export type SparkPair = keyof typeof SPARK_PAIRS;

export interface Particles {
  /** One spark at a world position with a velocity, living `life` seconds. */
  spawn(color: SparkColor, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number): void;
  /** n sparks bursting outward from a point in random directions (alternating a pair's two colours). */
  burst(colors: SparkColor | readonly [SparkColor, SparkColor], n: number, x: number, y: number, z: number,
    speed: number, rise: () => number, life: number): void;
  update(dt: number): void;
}

export function createParticles(scene: THREE.Scene, basic: (c: string) => THREE.Material): Particles {
  const geo = new THREE.OctahedronGeometry(0.07, 0);
  const mats: Record<SparkColor, THREE.Material> = {
    hit: basic(PAL.Y), big: basic(PAL.G), water: basic(PAL.C), fire: basic(PAL.O), ember: basic(PAL.R),
    arcane: basic(PAL.P), arcaneLight: basic("#c79cf0"), ice: basic(PAL.C), snow: basic(PAL.W),
    spark: basic(PAL.Y), sparkLight: basic("#fff6c8"), dust: basic(PAL.w),
  };
  interface Spark { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }
  let sparks: Spark[] = [];

  const spawn: Particles["spawn"] = (color, x, y, z, vx, vy, vz, life) => {
    const mesh = new THREE.Mesh(geo, mats[color]);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    sparks.push({ mesh, vx, vy, vz, life });
  };

  return {
    spawn,
    burst(colors, n, x, y, z, speed, rise, life) {
      for (let i = 0; i < n; i++) {
        const color = typeof colors === "string" ? colors : colors[i % 2]!;
        const a = Math.random() * Math.PI * 2;
        spawn(color, x, y, z, Math.cos(a) * speed, rise(), Math.sin(a) * speed, life);
      }
    },
    update(dt) {
      sparks = sparks.filter(s => {
        s.life -= dt; s.vy -= 12 * dt;
        s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt;
        s.mesh.rotation.x += dt * 10; s.mesh.rotation.y += dt * 8;
        if (s.life > 0) return true;
        scene.remove(s.mesh);
        return false;
      });
    },
  };
}
