// A cave mouth: a heap of grey boulders around a dark opening, with moss on top and rubble at its
// foot. Built facing south (the opening toward the camera); turned around to face north.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import type { Prop } from "../world/area.ts";
import { GROUND, onGround, PX_PER_TILE, type RenderContext } from "./context.ts";
import { hash } from "./terrain.ts";

const STONE = ["#8a8378", "#9d968a", "#77706a", "#6b655f"];

export function buildCave(ctx: RenderContext, parent: THREE.Group, prop: Extract<Prop, { kind: "cave" }>): void {
  const { lambert, basic } = ctx, cave = new THREE.Group();
  const rock = (x: number, y: number, z: number, r: number, i: number) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), lambert(STONE[Math.floor(hash(i, 7, 300) * STONE.length)]!));
    m.position.set(x, y, z);
    m.rotation.set(hash(i, 1, 301) * 3, hash(i, 2, 302) * 3, hash(i, 3, 303) * 3);
    m.scale.set(1, 0.85 + hash(i, 4, 304) * 0.3, 1);
    cave.add(m);
  };
  // The arch: boulders up each side and across the top, a bigger mass behind.
  let i = 0;
  for (const s of [-1, 1]) {
    rock(s * 0.95, 0.35, 0.05, 0.45, i++);
    rock(s * 0.85, 0.95, -0.05, 0.4, i++);
    rock(s * 1.35, 0.3, -0.3, 0.5, i++);
  }
  rock(-0.35, 1.45, -0.1, 0.45, i++);
  rock(0.35, 1.5, -0.12, 0.47, i++);
  rock(0, 1.15, -0.55, 0.75, i++);
  rock(-0.9, 1.4, -0.7, 0.6, i++);
  rock(0.95, 1.35, -0.7, 0.62, i);
  // The opening: a dark arch, with an even darker hollow behind it so it reads as depth.
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12, 0, Math.PI).scale(1, 1.45, 1), basic(PAL.K));
  mouth.position.set(0, 0.01, 0.12);
  const hollow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.6), basic("#08060c"));
  hollow.position.set(0, 0.5, -0.2);
  // The dark spilling out onto the ground in front, so the opening doesn't end in a hard line.
  const spill = new THREE.Mesh(new THREE.CircleGeometry(0.8, 10, Math.PI, Math.PI).rotateX(-Math.PI / 2).scale(1.1, 1, 0.7),
    basic("#000000", { transparent: true, opacity: 0.35, depthWrite: false, ...onGround(GROUND.stain) }));
  spill.position.set(0, 0.015, 0.12);
  cave.add(mouth, hollow, spill);
  // Moss on top, rubble at the foot.
  for (let k = 0; k < 4; k++) {
    const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + hash(k, 5, 305) * 0.08, 0), lambert(PAL.G));
    moss.position.set(-0.6 + k * 0.4, 1.75 + hash(k, 6, 306) * 0.15, -0.15);
    moss.scale.y = 0.6;
    cave.add(moss);
  }
  for (let k = 0; k < 5; k++) {
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + hash(k, 8, 307) * 0.05, 0), lambert(STONE[k % STONE.length]!));
    pebble.position.set((hash(k, 9, 308) - 0.5) * 2.2, 0.04, 0.35 + hash(k, 10, 309) * 0.35);
    cave.add(pebble);
  }
  cave.position.set(prop.x / PX_PER_TILE, 0, prop.y / PX_PER_TILE);
  if (prop.facing === "north") cave.rotation.y = Math.PI;
  parent.add(cave);
}
