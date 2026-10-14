// The camp at the spawn: an A-frame canvas tent with its flaps tied back, a stone-ringed campfire
// with flickering flames, a warm light and rising embers, and a log to sit on.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { CAMP } from "../data/world.ts";
import { PX_PER_TILE, toWorld, type RenderContext } from "./context.ts";
import { hash } from "./terrain.ts";

export interface Camp {
  update(t: number, dt: number): void;
}

/** A mesh from a flat list of triangles. */
function triangles(points: [number, number, number][], mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function buildTent(ctx: RenderContext): THREE.Group {
  const { lambert, basic } = ctx, tent = new THREE.Group();
  const side = { side: THREE.DoubleSide };
  const W = 0.85, H = 1.05, D = 0.75;                       // half width, height, half depth
  const FL: [number, number, number] = [-W, 0, D], FR: [number, number, number] = [W, 0, D], FA: [number, number, number] = [0, H, D];
  const BL: [number, number, number] = [-W, 0, -D], BR: [number, number, number] = [W, 0, -D], BA: [number, number, number] = [0, H, -D];
  // Roof: two slanted sides, and the back wall.
  tent.add(triangles([FL, FA, BA, FL, BA, BL, FR, BR, BA, FR, BA, FA, BL, BA, BR], lambert("#d8c8a0", side)));
  // Front: a dark doorway, with the flaps tied back to either side.
  tent.add(triangles([[-W * 0.9, 0, D - 0.04], [0, H * 0.92, D - 0.04], [W * 0.9, 0, D - 0.04]], basic(PAL.k, side)));
  tent.add(triangles([FL, [-0.32, 0, D + 0.03], FA, FR, FA, [0.32, 0, D + 0.03]], lambert("#c2ad84", side)));
  // Ridge pole and the front pole poking out the top, a hem of bark-coloured trim along the base.
  const wood = lambert(PAL.N);
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, D * 2 + 0.2, 5).rotateX(Math.PI / 2), wood);
  ridge.position.y = H;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.25, 5), wood);
  pole.position.set(0, H + 0.08, D + 0.05);
  for (const s of [-1, 1]) {
    const hem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, D * 2), lambert(PAL.n));
    hem.position.set(s * (W - 0.02), 0.03, 0);
    tent.add(hem);
  }
  // A pack leaning by the door.
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.16), lambert("#7a5a3a"));
  pack.position.set(W + 0.12, 0.13, D - 0.1);
  pack.rotation.y = 0.4;
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.06, 0.17), lambert(PAL.n));
  flap.position.set(W + 0.12, 0.27, D - 0.1);
  flap.rotation.y = 0.4;
  tent.add(ridge, pole, pack, flap);
  return tent;
}

export function buildCamp(ctx: RenderContext, parent: THREE.Group): Camp {
  const { lambert, basic, particles, tex } = ctx;

  // Tent: centred on its footprint, the doorway facing the camera (south).
  const tent = buildTent(ctx);
  tent.position.set((CAMP.tent.x + CAMP.tent.w / 2) / PX_PER_TILE, 0, (CAMP.tent.y + CAMP.tent.h / 2) / PX_PER_TILE);
  parent.add(tent);

  // Campfire: scorched ground, a ring of stones, a tipi of logs and three nested flames.
  const [fx, fz] = toWorld(CAMP.fire.x, CAMP.fire.y);
  const fire = new THREE.Group();
  fire.position.set(fx, 0, fz);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10).rotateX(-Math.PI / 2), basic("#2a1c14", { transparent: true, opacity: 0.7, depthWrite: false }));
  scorch.position.y = 0.012;
  fire.add(scorch);
  const stone = new THREE.DodecahedronGeometry(0.075, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, shade = 0.75 + hash(i, 3, 200) * 0.35;
    const m = new THREE.Mesh(stone, lambert(PAL.w, { color: new THREE.Color(PAL.w).multiplyScalar(shade) }));
    m.position.set(Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3);
    m.rotation.set(hash(i, 1, 201) * 3, hash(i, 2, 202) * 3, 0);
    m.scale.set(1.1, 0.8, 1);
    fire.add(m);
  }
  const logGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.42, 5).translate(0, 0.21, 0);
  const logMat = lambert(PAL.n);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const log = new THREE.Mesh(logGeo, logMat);
    log.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
    log.rotation.set(Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75);   // lean in to meet at the middle
    fire.add(log);
  }
  const flames = ([[0.19, 0.62, PAL.R], [0.14, 0.48, PAL.O], [0.08, 0.32, PAL.Y]] as const).map(([r, h, c], i) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5).translate(0, h / 2, 0), basic(c, { transparent: true, opacity: 0.92 }));
    m.position.y = 0.06 + i * 0.01;
    fire.add(m);
    return m;
  });
  // A soft pool of firelight on the ground (the grass texture is too dark to show the light alone).
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16).rotateX(-Math.PI / 2),
    basic(PAL.O, { transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 0.015;
  fire.add(glow);
  const light = new THREE.PointLight(0xff8a3a, 7, 5, 1.2);
  light.position.set(0, 0.55, 0);
  fire.add(light);
  parent.add(fire);

  // A log to sit on, beside the fire.
  const [sx, sz] = toWorld(CAMP.seat.x, CAMP.seat.y);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.75, 6).rotateZ(Math.PI / 2), lambert("#ffffff", { map: tex.bark }));
  seat.position.set(sx, 0.1, sz);
  seat.rotation.y = -0.5;
  parent.add(seat);

  return {
    update(t, dt) {
      // Flicker: each flame stretches and sways on its own beat; the light follows the fire.
      flames.forEach((m, i) => {
        const k = Math.sin(t * (11 + i * 3) + i * 2) * 0.12 + Math.sin(t * (23 + i * 5)) * 0.06;
        m.scale.set(1 - k * 0.4, 1 + k, 1 - k * 0.4);
        m.rotation.y = t * (1.5 + i);
        m.rotation.z = Math.sin(t * 7 + i) * 0.08;
      });
      light.intensity = 7 + Math.sin(t * 13) * 0.9 + Math.sin(t * 31) * 0.5;
      glow.material.opacity = 0.14 + Math.sin(t * 13) * 0.02 + Math.sin(t * 31) * 0.012;
      if (Math.random() < dt * 7) {                          // embers pop up out of the fire
        particles.spawn(Math.random() < 0.5 ? "fire" : "ember", fx + (Math.random() - 0.5) * 0.15, 0.35, fz + (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.5, 2.6 + Math.random() * 1.2, (Math.random() - 0.5) * 0.5, 0.55);
      }
    },
  };
}
