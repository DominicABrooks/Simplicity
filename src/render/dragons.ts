// The Vael as they really are, in the credits (src/game/credits.ts): the Old Mother, enormous, sweeping low over the
// King's Bridge or curled round her eggs under the Greyspines, Ember, Frost and Storm in one (red, white and indigo),
// and her three hatchlings, one of each: one red, one white and one indigo (HERO.md, "The end").
// A dragon is boxes and cones like everything else: a deep chest, a neck and tail of segments that sway, a horned head
// with a jaw that drops when it roars, four legs and two great membrane wings that beat in flight and fold at rest. It
// breathes its order's breath (fire, frost, or sparks) out of its mouth, lighting what's round it. The eggs are smooth
// and turned, under the King's gold leaf till it flakes off in a shower of sparks, then glowing their own colour,
// rocking as they crack, and at the last lying open, the top half tipped off into the grass.
import * as THREE from "three";
import type { SparkColor } from "./particles.ts";
import { put } from "./castle.ts";
import { softDisc } from "./camp.ts";
import { GROUND, SHADOW_Y, addShadow, box, onGround, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import type { EntityView } from "./views.ts";
import type { Dragon, Egg } from "../game/components.ts";

/** Each dragon's colours: hide, belly, wings, horns and claws, eyes; and the breath it breathes. */
const HIDES: Record<Dragon["hide"], { skin: string; belly: string; wing: string; horn: string; eye: string; breath: [SparkColor, SparkColor]; light: string }> = {
  mother: { skin: "#8a2a22", belly: "#e8eef2", wing: "#3f3a92", horn: "#e9c46a", eye: "#ffe08a", breath: ["fire", "ember"], light: "#ff9a40" },
  ember: { skin: "#c8361f", belly: "#f2a05a", wing: "#e05a3a", horn: "#f6e6c8", eye: "#fff1a8", breath: ["fire", "ember"], light: "#ff8a3a" },
  frost: { skin: "#eef2f4", belly: "#cfe6f2", wing: "#b8d8ea", horn: "#9fc4dc", eye: "#5ab8f0", breath: ["ice", "snow"], light: "#cfeeff" },
  storm: { skin: "#3a368a", belly: "#8f86d8", wing: "#5a4fc0", horn: "#e8e2ff", eye: "#fff6a0", breath: ["arcane", "arcaneLight"], light: "#9a8cff" },
};

interface DragonView {
  group: THREE.Group; shadow: THREE.Mesh; chest: THREE.Mesh;
  legs: THREE.Mesh[]; neck: THREE.Group[]; head: THREE.Group; jaw: THREE.Group; mouth: THREE.Object3D; tail: THREE.Group[]; wings: [THREE.Group, THREE.Group];
  light: THREE.PointLight; k: number;
}

/** A wing, out along +z (s = 1) or -z (s = -1) from its shoulder: the arm, the finger spines, and the membrane between. */
function wing(skin: THREE.Material, membrane: THREE.Material, s: number): THREE.Group {
  const g = new THREE.Group();
  put(g, box(0.07, 0.07, 1.05), skin, 0, 0, s * 0.52);
  const tips: [number, number][] = [[0.05, 1.05], [-0.55, 0.9], [-0.72, 0.48], [-0.46, 0.12]];
  for (const [x, z] of tips.slice(1)) {                      // the fingers, from the wrist out to the trailing edge
    const dx = x - 0.02, dz = s * (z - 0.95);
    put(g, box(0.035, 0.035, Math.hypot(dx, dz)), skin, (x + 0.02) / 2, 0, s * (z + 0.95) / 2).rotation.y = Math.atan2(dx, dz);
  }
  const pts = [[0, 0], ...tips].map(([x, z]) => new THREE.Vector3(x, 0, s * z));
  const geo = new THREE.BufferGeometry().setFromPoints([0, 1, 2, 0, 2, 3, 0, 3, 4].map(i => pts[i]!));
  geo.computeVertexNormals();
  put(g, geo, membrane, 0, 0, 0);
  return g;
}

/** A dragon, a hatchling's length long, facing +x: chest, legs, spines, a neck and tail of segments, a horned head, wings. */
function makeDragon(ctx: RenderContext, hide: Dragon["hide"]): Omit<DragonView, "shadow" | "light" | "k"> {
  const h = HIDES[hide], group = new THREE.Group();
  const skin = ctx.lambert(h.skin), belly = ctx.lambert(h.belly), horn = ctx.lambert(h.horn), eye = ctx.glow(h.eye);
  const membrane = ctx.lambert(h.wing, { side: THREE.DoubleSide });
  const chest = put(group, new THREE.IcosahedronGeometry(0.4, 1), skin, 0, 0.62, 0);
  chest.scale.set(1.5, 0.85, 0.9);
  put(group, new THREE.IcosahedronGeometry(0.34, 1), belly, 0.05, 0.5, 0).scale.set(1.35, 0.7, 0.8);
  for (let i = 0; i < 5; i++) put(group, new THREE.ConeGeometry(0.06, 0.18, 4), horn, -0.4 + i * 0.2, 0.98 - Math.abs(i - 2) * 0.04, 0);
  const legs = ([[0.32, 0.22], [0.32, -0.22], [-0.34, 0.24], [-0.34, -0.24]] as const).map(([lx, lz]) => {
    const leg = put(group, box(0.14, 0.42, 0.14).translate(0, -0.21, 0), skin, lx, 0.42, lz);   // hung from the hip
    put(leg, box(0.22, 0.06, 0.17), horn, 0.05, -0.39, 0);
    return leg;
  });
  // The neck: three segments, each hung off the one before, so bending each a little curls the whole of it.
  const neck: THREE.Group[] = [];
  let parent: THREE.Object3D = group;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    seg.position.set(i ? 0.2 : 0.5, i ? 0 : 0.8, 0);
    put(seg, box(0.26, 0.21 - i * 0.02, 0.2 - i * 0.02), skin, 0.1, 0, 0);
    put(seg, new THREE.ConeGeometry(0.04, 0.12, 4), horn, 0.1, 0.13, 0);
    parent.add(seg);
    neck.push(seg);
    parent = seg;
  }
  const head = new THREE.Group();
  head.position.set(0.22, 0, 0);
  parent.add(head);
  put(head, box(0.3, 0.22, 0.25), skin, 0.1, 0.03, 0);       // the skull
  put(head, box(0.26, 0.12, 0.18), skin, 0.34, 0, 0);         // the snout
  for (const s of [-1, 1]) {
    put(head, new THREE.ConeGeometry(0.045, 0.3, 4), horn, -0.06, 0.2, s * 0.08, s * 0.25, 0, 1.0);   // horns, swept back
    put(head, box(0.06, 0.045, 0.02), eye, 0.2, 0.09, s * 0.127);
    put(head, box(0.03, 0.03, 0.02), horn, 0.46, 0.04, s * 0.06);                                     // nostrils
  }
  const jaw = new THREE.Group();
  jaw.position.set(0.05, -0.08, 0);
  put(jaw, box(0.4, 0.06, 0.16), belly, 0.2, 0, 0);
  head.add(jaw);
  const mouth = new THREE.Object3D();
  mouth.position.set(0.5, -0.04, 0);
  head.add(mouth);
  // The tail: six segments, thinning, and a spade at the end.
  const tail: THREE.Group[] = [];
  parent = group;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group(), w = 0.17 * (1 - i * 0.13);
    seg.position.set(i ? -0.22 : -0.55, i ? 0 : 0.6, 0);
    put(seg, box(0.26, w, w), skin, -0.11, 0, 0);
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }
  put(tail[5]!, new THREE.ConeGeometry(0.1, 0.22, 4), horn, -0.3, 0, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 0.3);
  const wings = ([1, -1] as const).map(s => {
    const w = wing(skin, membrane, s);
    w.position.set(0.12, 0.95, s * 0.2);
    group.add(w);
    return w;
  }) as [THREE.Group, THREE.Group];
  return { group, chest, legs, neck, head, jaw, mouth, tail, wings };
}

const forward = new THREE.Vector3(), at = new THREE.Vector3();

export const dragon: EntityView<DragonView> = {
  create(ctx, e, g) {
    const d = g.world.need(e, "dragon"), parts = makeDragon(ctx, d.hide), shadow = addShadow(ctx, 1);
    const light = new THREE.PointLight(HIDES[d.hide].light, 0, 8, 1.2);
    parts.mouth.add(light);
    ctx.scene.add(parts.group, shadow);
    return { ...parts, shadow, light, k: (e * 1.37) % 10 };
  },
  update(ctx, v, e, g, f) {
    const d = g.world.need(e, "dragon"), [x, z] = toWorld(d.x, d.y), t = f.t + v.k, grow = Math.max(0.001, d.grow);
    const size = d.size * (grow < 1 ? grow * (1 + Math.sin(grow * Math.PI) * 0.25) : 1);   // a hatchling pops out a little big
    const flying = d.pose === "fly", beat = Math.sin(d.flap);
    // Wings wide at rest, she rears up on her hind legs (rocking back about her middle, so lifted to keep them on the ground).
    const rear = flying ? 0 : d.spread * 0.42;
    v.group.position.set(x, d.height + (flying ? -beat * 0.06 * d.size : 0) + Math.sin(rear) * 0.36 * size, z);
    v.group.rotation.set(0, -d.facing, rear);
    v.group.scale.setScalar(size);
    v.chest.scale.set(1.5, 0.85 + Math.sin(t * 1.8) * 0.02, 0.9);   // breathing
    for (const leg of v.legs) leg.rotation.z = flying ? -1.3 : 0;   // tucked back under her in flight
    // Wings: beating in flight (up and down about the shoulder, swept a little back on the upstroke); folded at rest.
    v.wings.forEach((w, i) => {
      const s = i ? -1 : 1;
      if (flying) { w.rotation.set(-s * beat * 0.85, -s * (0.15 + Math.max(0, beat) * 0.2), 0); }
      else {                                                 // at rest, folded; or opened wide, rising and falling slowly
        const o = d.spread;
        w.rotation.set(-s * (1.15 * (1 - o) + (0.25 + Math.sin(t * 1.6) * 0.1) * o + Math.sin(t * 1.1) * 0.03), -s * 0.9 * (1 - o * 0.85), 0);
      }
    });
    // The neck: out straight in flight; at rest, from curled low over the ground up to stretched at the sky.
    const lift = flying ? 0.5 : d.neck, curl = [[-0.55, -0.35, 0.05], [0.42, 0.26, 0.1]] as const;
    v.neck.forEach((n, i) => {
      n.rotation.z = flying ? (i ? 0.08 : -0.12) : curl[0][i]! + (curl[1][i]! - curl[0][i]!) * lift;
      n.rotation.y = Math.sin(t * 0.9 + i * 0.7) * (flying ? 0.04 : 0.08);
    });
    v.head.rotation.z = flying ? 0.05 : -0.25 + lift * 0.6;
    v.jaw.rotation.z = -Math.min(0.7, d.fire * 0.7 + (flying ? 0 : lift * 0.1));
    // The tail: streaming behind in flight, curled round her at rest, swaying either way.
    v.tail.forEach((s, i) => {
      s.rotation.y = (flying ? 0 : 0.32) + Math.sin(t * (flying ? 2 : 1.2) - i * 0.6) * (flying ? 0.08 : 0.06);
      s.rotation.z = flying ? Math.sin(d.flap - i * 0.5) * 0.05 : -0.08;
    });
    // The shadow: under her on the ground, as wide as she is.
    v.shadow.position.set(x, SHADOW_Y, z);
    v.shadow.scale.set(size * (flying ? 1.6 : 1.1), 1, size * (flying ? 2.2 : 0.9));
    v.shadow.rotation.y = -d.facing;
    // Her breath, out of her mouth along the way her head points, lighting what's round her.
    v.light.intensity = d.fire * 6 * Math.min(2, d.size);
    if (d.fire > 0.02) {
      v.group.updateMatrixWorld(true);
      v.mouth.getWorldPosition(at);
      forward.set(1, 0, 0).transformDirection(v.head.matrixWorld);
      const big = d.size > 2 ? 2 : 1;                       // the Old Mother's is a column of it
      const [c1, c2] = HIDES[d.hide].breath, speed = 2.2 + 2.2 * Math.sqrt(d.size), n = Math.ceil(d.fire * f.dt * 90 * Math.min(3, d.size) * big);
      for (let i = 0; i < n; i++) {
        const j = () => (Math.random() - 0.5) * 0.35 * speed;
        ctx.particles.spawn(Math.random() < 0.6 ? c1 : c2, at.x, at.y, at.z, forward.x * speed + j(), forward.y * speed + j(), forward.z * speed + j(), 0.45 + Math.random() * 0.5 * Math.sqrt(d.size));
      }
    }
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group, v.shadow);
    disposeTree(v.group);
  },
};

/** An egg's profile, turned: [radius, height]. The bottom half up to the widest; the top from there. */
const EGG: [number, number][] = [[0, 0], [0.1, 0.015], [0.16, 0.07], [0.185, 0.15], [0.18, 0.22]];
const EGG_TOP: [number, number][] = [[0.18, 0.22], [0.16, 0.3], [0.12, 0.37], [0.065, 0.42], [0, 0.445]];
const GOLD = new THREE.Color("#e2b33c"), SHELLS: Record<Egg["school"], string> = { ember: "#d9472a", frost: "#f2f6f8", storm: "#4a44a8" };
const BURST: Record<Egg["school"], [SparkColor, SparkColor]> = { ember: ["fire", "ember"], frost: ["ice", "snow"], storm: ["arcane", "arcaneLight"] };

interface EggView {
  group: THREE.Group; shadow: THREE.Mesh; top: THREE.Mesh; shell: THREE.MeshLambertMaterial; pool: THREE.MeshBasicMaterial;
  light: THREE.PointLight; hue: THREE.Color; gilt: number; crack: number; open: boolean; k: number;
}

export const egg: EntityView<EggView> = {
  create(ctx, e, g) {
    const s = g.world.need(e, "egg"), hue = new THREE.Color(SHELLS[s.school]), group = new THREE.Group();
    const shell = ctx.lambert(SHELLS[s.school]), pool = ctx.glow(SHELLS[s.school], { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, ...onGround(GROUND.marker) });
    pool.map = softDisc();
    const egg = new THREE.Group();
    egg.scale.setScalar(1.35);
    group.add(egg);
    egg.add(ctx.lathe(EGG, shell));
    const top = ctx.lathe(EGG_TOP, shell);
    egg.add(top);
    put(group, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), pool, 0, 0.03, 0).scale.setScalar(0.8);
    const light = new THREE.PointLight(SHELLS[s.school], 0, 4, 1.5);
    light.position.y = 0.4;
    group.add(light);
    const shadow = addShadow(ctx, 0.45), t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    shadow.position.set(x, SHADOW_Y, z);
    ctx.scene.add(group, shadow);
    return { group, shadow, top, shell, pool, light, hue, gilt: s.gilt, crack: 0, open: false, k: (e * 0.77) % 10 };
  },
  update(ctx, v, e, g, f) {
    const s = g.world.need(e, "egg"), p = v.group.position, t = f.t + v.k, [a, b] = BURST[s.school];
    // The gilding: gold over its own colour; as it comes off, flakes of gold go up off it.
    v.shell.color.copy(v.hue).lerp(GOLD, s.gilt);
    v.shell.emissive.copy(v.hue).multiplyScalar(s.glow * 0.45);
    const flaked = v.gilt - s.gilt;
    if (flaked > 0) for (let i = 0; i < Math.ceil(flaked * 60); i++) {
      const ang = Math.random() * Math.PI * 2;
      ctx.particles.spawn(Math.random() < 0.5 ? "spark" : "sparkLight", p.x + Math.cos(ang) * 0.2, 0.15 + Math.random() * 0.45, p.z + Math.sin(ang) * 0.2, Math.cos(ang) * 0.6, 0.8 + Math.random(), Math.sin(ang) * 0.6, 0.9);
    }
    v.gilt = s.gilt;
    const pale = s.school === "frost" ? 0.4 : 1;              // white glows white-hot: less of it
    v.pool.opacity = s.glow * pale * (0.7 + Math.sin(t * 3) * 0.15);
    v.light.intensity = s.glow * pale * 2.5;
    // Near hatching: it rocks, harder the nearer, and now and then a chip of its colour flies off.
    const rock = s.open ? 0 : s.crack * (0.12 + 0.1 * Math.sin(t * 7));
    v.group.rotation.set(Math.sin(t * 23) * rock, 0, Math.cos(t * 19) * rock);
    if (!s.open && s.crack > 0.3 && Math.random() < f.dt * s.crack * 14) ctx.particles.spawn(a, p.x, 0.35, p.z, (Math.random() - 0.5) * 1.5, 1.4, (Math.random() - 0.5) * 1.5, 0.5);
    // Open: a burst of its colour, and the top half tipped off into the grass beside it.
    if (s.open && !v.open) {
      for (let i = 0; i < 70; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 2.4;
        ctx.particles.spawn(i % 2 ? a : b, p.x, 0.4, p.z, Math.cos(ang) * sp, 1 + Math.random() * 2.5, Math.sin(ang) * sp, 0.8 + Math.random() * 0.5);
      }
      v.top.position.set(0.24, -0.2, 0.08);
      v.top.rotation.set(0.3, 0, 2.0);
    }
    v.open = s.open;
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group, v.shadow);
    disposeTree(v.group);
  },
};
