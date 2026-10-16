// Yssa of the Frost (src/game/yssa.ts): not a Greyed mage in a school's robes, but someone older than any of them, and
// the only robed one who doesn't fight. Taller than anyone in the wood; a floor-length gown of frost-white banded in
// ice-blue under a pale mantle; long silver-white hair, bare-headed but for a thin silver diadem with a snowflake at the
// brow; clear pale eyes (not the Greyed's glow); a staff of ice with a crystal at its head. Three motes of frost turn
// slowly round her, a ring of rime spreads on the ground at her feet, and frost drifts off her as she stands in the
// track west out of the Ashwild, turning to watch whoever comes.
import * as THREE from "three";
import type { Dress } from "../world/wardrobe.ts";
import { GROUND, SHADOW_Y, onGround, toWorld } from "./context.ts";
import { dressCommoner, makeBody, removeBody, type Body } from "./models/body.ts";
import type { EntityView } from "./views.ts";

const DRESS: Dress = {
  garment: "gown", pattern: "banded", cloth: "#eef5fa", second: "#9fd0e6", trim: "#d6ecf6", over: "cloak", head: "bare",
  hair: "#e6edf2", longHair: true, hose: "#eef5fa", feather: false, pouch: false, brooch: true, shoes: "#b8d2de", carry: "none",
};
/** How much taller than anyone else she stands. */
const TALL = 1.14;

interface YssaView extends Body { k: number; motes: THREE.Group; crystal: THREE.Mesh; halo: THREE.MeshBasicMaterial; rime: THREE.MeshBasicMaterial }
export const yssa: EntityView<YssaView> = {
  create(ctx, e, g) {
    const { lambert, glow } = ctx, b = makeBody(ctx);
    dressCommoner(ctx, b, DRESS);
    b.ripple.visible = false;
    b.sword.visible = false;
    b.feet.forEach(f => { f.position.x = b.footX; });
    const eyes = glow("#cdeeff");
    b.eyes.forEach(eye => { eye.material = eyes; });
    b.group.scale.setScalar(TALL);

    // The diadem: a thin silver band, and a six-armed snowflake at the brow.
    const silver = lambert("#dfe7ee", { emissive: new THREE.Color("#3a4a58") }), flake = glow("#e8f8ff");
    const diadem = new THREE.Group();
    diadem.add(new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.012, 4, 18).rotateX(Math.PI / 2), silver));
    const star = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.018), flake);
      arm.rotation.x = (i / 3) * Math.PI;
      star.add(arm);
    }
    star.position.set(0.21, 0.035, 0);
    diadem.add(star);
    diadem.position.y = 1.0;
    b.gear.add(diadem);

    // The staff of ice in her front hand, a crystal at its head in a cold halo.
    const staff = new THREE.Group();
    staff.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.55, 6), lambert("#cfe6f2", { emissive: new THREE.Color("#2a4a5a") })));
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0).scale(1, 1.6, 1), glow("#bfeaff"));
    crystal.position.y = 0.88;
    const halo = glow("#9fe3ff", { transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), halo);
    shell.position.y = 0.88;
    staff.add(crystal, shell);
    staff.position.set(0.02, 0.32, 0.02);
    b.hands[0]!.add(staff);

    // Motes of frost turning round her, and a ring of rime on the ground at her feet.
    const motes = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2, mote = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), flake);
      mote.position.set(Math.cos(a) * 0.55, 0.55 + i * 0.12, Math.sin(a) * 0.55);
      motes.add(mote);
    }
    b.group.add(motes);
    const rime = glow("#cfefff", { transparent: true, opacity: 0.3, depthWrite: false, ...onGround(GROUND.stain) });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28).rotateX(-Math.PI / 2), rime);
    ring.position.y = 0.015;
    b.group.add(ring);

    const t = g.world.need(e, "transform");
    return Object.assign(b, { k: (t.x * 3 + t.y * 7) % 10, motes, crystal, halo, rime });
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), s = g.world.need(e, "sentry"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    v.group.position.set(x, 0, z);
    v.group.rotation.y = -s.look;
    v.shadow.position.set(x, SHADOW_Y, z);
    v.body.scale.y = 1 + Math.sin(t * 1.4) * 0.02;            // breathing, slow and very old
    v.eyes.forEach(eye => { eye.scale.y = t % 5.3 < 0.15 ? 0.15 : 1; });
    v.motes.rotation.y = t * 0.6;                             // the frost turning round her, rising and falling a little
    v.motes.children.forEach((m, i) => { m.position.y = 0.55 + i * 0.12 + Math.sin(t * 1.3 + i * 2) * 0.06; m.rotation.y = t * 2; });
    v.crystal.rotation.y = t * 0.8;
    v.halo.opacity = 0.28 + Math.sin(t * 1.1) * 0.1;
    v.rime.opacity = 0.25 + Math.sin(t * 0.7) * 0.07;
    if (Math.random() < f.dt * 4) {                           // frost drifting off her, falling
      ctx.particles.spawn(Math.random() < 0.5 ? "ice" : "snow", x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 1.2, z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.15, -0.2 - Math.random() * 0.2, (Math.random() - 0.5) * 0.15, 1.4);
    }
  },
  remove: removeBody,
};
