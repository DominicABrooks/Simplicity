// The work townsfolk do with their hands out in the open, besides the smith's hammer and the minstrel's lute
// (src/render/views.ts): a sweeper's broom swishing across the square, kicking up dust at each end of the
// stroke; a laundress bent over her tub, scrubbing, the suds splashing; someone at a well's crank, winding
// up the bucket; a fisherman's long rod out over the bridge's parapet, the line down to the river and the
// float bobbing, now and then a bite; and a falconer's hawk on the fist, rousing its feathers, that every so
// often goes up and wheels round overhead and comes back; and in a smithy's yard, a bowyer drawing his knife
// down a bow stave, a fletcher binding the feathers on an arrow and sighting along it, a harness-maker
// stitching a strap, and a journeyman at the grindstone, sparks flying; on the square, the travellers: a
// knife-grinder at his wheel, a tinker tapping out a pot, a storyteller waving his arms through his tale;
// and a mason with mallet and chisel at a block outside St Mary's; and by their own front doors, the
// trades worked at home: a cooper driving the hoops down a barrel, a tailor sewing, a carpenter sawing a
// plank on a trestle, a dyer and a brewer stirring their vats, a spinner letting her spindle drop. Each is
// made the first time it's needed and hidden when they stop. And at dusk, the lamplighter, his long pole up to
// each street lamp in turn till it catches.
import * as THREE from "three";
import { CRAFTS } from "../data/crafts.ts";
import type { Task } from "../game/components.ts";
import type { Load } from "../world/workplaces.ts";
import { WATER_Y, box, type RenderContext } from "./context.ts";
import { LAMP_HEAD } from "./lamp.ts";

/** The body parts a pose moves (the townsperson's own: see models/body.ts). */
export interface Worker {
  group: THREE.Group;
  body: THREE.Group;
  /** [0] the front hand (camera side), [1] the back. */
  hands: THREE.Mesh[];
  shadow: THREE.Mesh;
  size: number;
  /** How far they've stepped in from where they stand, toward their work (a well's crank is out of reach). */
  reach: number;
  /** Their tools, made as needed; and the stroke last made (so each one throws its dust or suds once). */
  tools: Partial<Record<Task, THREE.Group>>;
  beat: number;
  /** What they carry about on the job (by their trade: loadOf), and its model once made. */
  load: Load | null;
  carried: THREE.Group | null;
}

/** The tasks drawn here (the others are views.ts's own). */
export const HANDWORK: readonly Task[] = [
  "broom", "wash", "crank", "fish", "hawk", "stave", "fletch", "stitch", "grind", "tinker", "tell", "chisel", "hoop", "sew", "saw", "stir", "dye", "spin", "pewter", "lamp",
];

/** A besom: a long handle, a bundle of twigs bound at the foot. Pivots at the top hand; points down. */
function makeBroom(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), stick = new THREE.Mesh(box(0.055, 0.8, 0.055), ctx.lambert("#b08850"));
  stick.position.y = -0.4;
  const twigs = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 6, 1, true), ctx.lambert("#d8bc72", { side: THREE.DoubleSide }));
  twigs.position.y = -0.86;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6), ctx.lambert("#5a3a22"));
  band.position.y = -0.7;
  g.add(stick, twigs, band);
  return g;
}

/** A washtub on the ground in front of her: staves and hoops, grey water, and the wash in it. */
function makeTub(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group();
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.24, 9, 1, true), ctx.lambert("#9a7448", { side: THREE.DoubleSide }));
  tub.position.y = 0.12;
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.015, 4, 9), ctx.lambert("#4a4a52"));
  hoop.position.y = 0.19; hoop.rotation.x = Math.PI / 2;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.25, 9), ctx.lambert("#9fb8c4"));
  water.position.y = 0.2; water.rotation.x = -Math.PI / 2;
  const wash = new THREE.Mesh(box(0.22, 0.05, 0.16), ctx.lambert("#ece4d2"));
  wash.position.set(0.02, 0.215, 0.03); wash.rotation.y = 0.4;
  const board = new THREE.Mesh(box(0.03, 0.34, 0.2), ctx.lambert("#b08a5a"));   // a washboard leant in it, against her side
  board.position.set(-0.16, 0.26, 0); board.rotation.z = -0.35;
  g.add(tub, hoop, water, wash, board);
  return g;
}

/** How long a fishing rod is, from the hand to its tip. */
const ROD = 2.1;
/**
 * A long fishing rod, from the hand along +y, and its line hanging from the tip (`line`, a unit length that
 * the pose stretches down to the water) with a red-and-white float at its foot.
 */
function makeRod(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), rod = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.032, ROD, 4).translate(0, ROD / 2, 0), ctx.lambert("#7a5a36"));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 5), ctx.lambert("#4a3222"));
  rod.add(pole, grip);
  rod.name = "rod";
  const line = new THREE.Mesh(box(0.016, 1, 0.016).translate(0, -0.5, 0), ctx.basic("#e8e2d0"));
  line.name = "line";
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), ctx.lambert("#c8382c"));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), ctx.lambert("#f0ece0"));
  cap.position.y = 0.03;
  const bob = new THREE.Group();
  bob.add(float, cap);
  bob.name = "float";
  g.add(rod, line, bob);
  return g;
}

/** A peregrine, beak along +x: slate back, pale breast, head and hooked beak, tail, and two wings that flap (`wings`). */
function makeHawk(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), slate = ctx.lambert("#5e6672"), pale = ctx.lambert("#ece4d0");
  const body = new THREE.Mesh(box(0.2, 0.13, 0.12), slate); body.rotation.z = 0.35;
  const breast = new THREE.Mesh(box(0.06, 0.11, 0.1), pale); breast.position.set(0.07, -0.01, 0); breast.rotation.z = 0.35;
  const head = new THREE.Mesh(box(0.08, 0.08, 0.08), slate); head.position.set(0.1, 0.09, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 4).rotateZ(-Math.PI / 2 - 0.4), ctx.lambert("#e0b030")); beak.position.set(0.16, 0.08, 0);
  const tail = new THREE.Mesh(box(0.16, 0.02, 0.08), slate); tail.position.set(-0.15, -0.06, 0); tail.rotation.z = 0.5;
  const wings = new THREE.Group(); wings.name = "wings";
  for (const s of [1, -1]) {
    const pivot = new THREE.Group(), wing = new THREE.Mesh(box(0.15, 0.015, 0.26), slate);
    wing.position.set(-0.02, 0, s * 0.13);
    pivot.position.set(0, 0.03, s * 0.05);
    pivot.add(wing);
    pivot.userData.side = s;
    wings.add(pivot);
  }
  g.add(body, breast, head, beak, tail, wings);
  g.scale.setScalar(1.6);                                    // bigger than life: it has to read from up where the camera is
  return g;
}

/** A bow stave standing on the ground, and a drawknife (`knife`) for the front hand. */
function makeStave(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), wood = ctx.lambert("#d4a862");
  for (const s of [1, -1]) {                                 // two limbs, bent back a little from the grip
    const limb = new THREE.Mesh(box(0.05, 0.6, 0.04), wood);
    limb.position.set(-0.03, 0.58 + s * 0.29, 0); limb.rotation.z = s * 0.06;
    g.add(limb);
  }
  const knife = new THREE.Mesh(box(0.05, 0.03, 0.22), ctx.lambert("#4a4a52"));
  knife.name = "knife";
  g.add(knife);
  return g;
}

/** An arrow being fletched (along z): shaft, iron head, three grey-goose feathers at the nock. */
function makeArrow(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), arrow = new THREE.Group();
  arrow.add(new THREE.Mesh(box(0.025, 0.025, 0.62), ctx.lambert("#c8a46a")));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4).rotateX(Math.PI / 2), ctx.lambert("#5a5a62"));
  head.position.z = 0.35;
  arrow.add(head);
  for (let i = 0; i < 3; i++) {
    const vane = new THREE.Mesh(box(0.006, 0.06, 0.16), ctx.lambert("#e8e4dc")), a = (i / 3) * Math.PI * 2;
    vane.position.set(Math.sin(a) * 0.035, Math.cos(a) * 0.035, -0.2); vane.rotation.z = -a;
    arrow.add(vane);
  }
  arrow.name = "arrow";
  g.add(arrow);
  return g;
}

/** A strap of leather being stitched (or, `cloth`, a length of cloth being sewn), and the thread drawn out of it to the front hand (`thread`, unit long). */
function makeStrap(ctx: RenderContext, cloth = false): THREE.Group {
  const g = new THREE.Group(), strap = new THREE.Mesh(cloth ? box(0.26, 0.02, 0.42) : box(0.07, 0.03, 0.55), ctx.lambert(cloth ? "#4e6a9a" : "#8a5432"));
  strap.name = "strap";
  const thread = new THREE.Mesh(box(0.012, 1, 0.012).translate(0, 0.5, 0), ctx.basic("#efe6c8"));
  thread.name = "thread";
  g.add(strap, thread);
  return g;
}

/** A grindstone in its frame, out in front, with its trough of water under it; the wheel (`wheel`) turns about z. */
function makeGrindstone(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), wood = ctx.lambert("#6b4a2e");
  for (const s of [1, -1]) { const post = new THREE.Mesh(box(0.06, 0.5, 0.06), wood); post.position.set(0.58, 0.25, s * 0.11); g.add(post); }
  const trough = new THREE.Mesh(box(0.5, 0.12, 0.2), wood); trough.position.set(0.58, 0.06, 0);
  const water = new THREE.Mesh(box(0.44, 0.01, 0.15), ctx.lambert("#7a98a8")); water.position.set(0.58, 0.125, 0);
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 10).rotateX(Math.PI / 2), ctx.lambert("#9a958c")));
  wheel.add(new THREE.Mesh(box(0.08, 0.3, 0.105), ctx.lambert("#7a756c")));   // a darker band, to see it turn
  wheel.position.set(0.58, 0.48, 0);
  wheel.name = "wheel";
  const blade = new THREE.Mesh(box(0.03, 0.015, 0.34), ctx.lambert("#c8ccd4"));
  blade.position.set(0.33, 0.72, 0); blade.rotation.z = -0.5;
  g.add(trough, water, wheel, blade);
  return g;
}

/** A small hammer for the front hand (`hammer`, its head at the top), and the copper pot being mended (`pot`). */
function makePot(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), copper = ctx.lambert("#c07a40");
  const pot = new THREE.Group();
  pot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.16, 8, 1, true), ctx.lambert("#c07a40", { side: THREE.DoubleSide })));
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.11, 8).rotateX(-Math.PI / 2), copper); bottom.position.y = -0.08;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 3, 8, Math.PI), ctx.lambert("#5a5a62")); handle.position.y = 0.08;
  pot.add(bottom, handle);
  pot.name = "pot";
  const hammer = new THREE.Group();
  const shaft = new THREE.Mesh(box(0.03, 0.2, 0.03), ctx.lambert("#6b4a2e")); shaft.position.y = 0.06;
  const head = new THREE.Mesh(box(0.09, 0.045, 0.045), ctx.lambert("#4a4a52")); head.position.set(0.02, 0.16, 0);
  hammer.add(shaft, head);
  hammer.name = "hammer";
  g.add(pot, hammer);
  return g;
}

/** A block of stone on the ground in front, roughed out at the top, and a mallet (`mallet`) and chisel (`chisel`) for the hands. */
function makeBlock(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), stone = ctx.lambert("#b8b0a2"), worked = ctx.lambert("#d4cec2");
  const block = new THREE.Mesh(box(0.44, 0.36, 0.38), stone); block.position.set(0.6, 0.18, 0);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 5), worked); top.position.set(0.6, 0.46, 0);
  const mallet = new THREE.Group(); mallet.name = "mallet";
  const handle = new THREE.Mesh(box(0.03, 0.18, 0.03), ctx.lambert("#6b4a2e")); handle.position.y = 0.05;
  const head = new THREE.Mesh(box(0.1, 0.09, 0.09), ctx.lambert("#9a7448")); head.position.y = 0.17;
  mallet.add(handle, head);
  const chisel = new THREE.Mesh(box(0.025, 0.16, 0.025), ctx.lambert("#5a5a62")); chisel.name = "chisel";
  g.add(block, top, mallet, chisel);
  return g;
}

/** A barrel on end in front, its hoops dark, and a hammer (`hammer`) and hoop-driver (`driver`) for the hands. */
function makeBarrel(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 9), ctx.lambert("#a07448"));
  barrel.position.set(0.6, 0.25, 0);
  g.add(barrel);
  for (const y of [0.08, 0.42]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.018, 3, 9).rotateX(Math.PI / 2), ctx.lambert("#3a3a40")); hoop.position.set(0.6, y, 0); g.add(hoop); }
  const hammer = new THREE.Group(), shaft = new THREE.Mesh(box(0.03, 0.2, 0.03), ctx.lambert("#6b4a2e")), head = new THREE.Mesh(box(0.1, 0.05, 0.05), ctx.lambert("#4a4a52"));
  shaft.position.y = 0.06; head.position.set(0.02, 0.16, 0);
  hammer.add(shaft, head); hammer.name = "hammer";
  const driver = new THREE.Mesh(box(0.04, 0.16, 0.04), ctx.lambert("#5a5a62")); driver.name = "driver";
  g.add(hammer, driver);
  return g;
}

/** A trestle in front with a plank across it (along z), and a saw (`saw`) for the front hand. */
function makeTrestle(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), wood = ctx.lambert("#8a6a44");
  for (const s of [1, -1]) { const leg = new THREE.Mesh(box(0.04, 0.4, 0.04), wood); leg.position.set(0.55 + s * 0.12, 0.18, 0); leg.rotation.z = s * 0.3; g.add(leg); }
  const bar = new THREE.Mesh(box(0.06, 0.05, 0.5), wood); bar.position.set(0.55, 0.36, 0);
  const plank = new THREE.Mesh(box(0.24, 0.05, 0.8), ctx.lambert("#d0aa70")); plank.position.set(0.55, 0.41, 0.08);
  const saw = new THREE.Group(), blade = new THREE.Mesh(box(0.4, 0.09, 0.01), ctx.lambert("#b8bcc4")), grip = new THREE.Mesh(box(0.08, 0.1, 0.04), ctx.lambert("#6b4a2e"));
  blade.position.x = 0.2; grip.position.x = -0.02;
  saw.add(blade, grip); saw.name = "saw";
  g.add(bar, plank, saw);
  return g;
}

/** A vat in front, of `liquor` (woad blue for a dyer, brown wort for a brewer), and a long paddle (`paddle`) to stir it. */
function makeVat(ctx: RenderContext, liquor: string): THREE.Group {
  const g = new THREE.Group();
  const vat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.4, 10, 1, true), ctx.lambert("#8a6440", { side: THREE.DoubleSide }));
  vat.position.set(0.62, 0.2, 0);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.018, 3, 10).rotateX(Math.PI / 2), ctx.lambert("#3a3a40")); hoop.position.set(0.62, 0.32, 0);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10).rotateX(-Math.PI / 2), ctx.lambert(liquor)); top.position.set(0.62, 0.34, 0);
  const paddle = new THREE.Group(), pole = new THREE.Mesh(box(0.035, 0.85, 0.035), ctx.lambert("#a07a4a")), blade = new THREE.Mesh(box(0.1, 0.16, 0.03), ctx.lambert("#a07a4a"));
  pole.position.y = -0.42; blade.position.y = -0.82;
  paddle.add(pole, blade); paddle.name = "paddle";
  g.add(vat, hoop, top, paddle);
  return g;
}

/** A distaff with its wool (`distaff`), the drop spindle (`spindle`: shaft and whorl) and the yarn from the hand down to it (`yarn`, unit long). */
function makeSpindle(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), wood = ctx.lambert("#a07a4a");
  const distaff = new THREE.Group(), stick = new THREE.Mesh(box(0.025, 0.55, 0.025), wood), wool = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4).scale(1, 1.4, 1), ctx.lambert("#f0ebe0"));
  stick.position.y = -0.1; wool.position.y = 0.2;
  distaff.add(stick, wool); distaff.name = "distaff";
  const spindle = new THREE.Group(), shaft = new THREE.Mesh(box(0.02, 0.22, 0.02), wood), whorl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 6), ctx.lambert("#6b4a2e"));
  whorl.position.y = -0.06;
  spindle.add(shaft, whorl); spindle.name = "spindle";
  const yarn = new THREE.Mesh(box(0.01, 1, 0.01).translate(0, -0.5, 0), ctx.basic("#f0ebe0")); yarn.name = "yarn";
  g.add(distaff, spindle, yarn);
  return g;
}

/** How long a lamplighter's pole is, and the colour of the wick burning at its top. */
const POLE = 1.75, WICK = "#e8963a";
/** A lamplighter's pole, from its foot along +y: a long staff, a brass hook at the top and the lit wick beside it. */
function makePole(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), pole = new THREE.Group();
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, POLE, 5).translate(0, POLE / 2, 0), ctx.lambert("#7a5a36"));
  const hook = new THREE.Mesh(box(0.025, 0.12, 0.025), ctx.lambert("#c8a040"));
  hook.position.set(0.04, POLE - 0.02, 0); hook.rotation.z = -0.5;
  const wick = new THREE.Mesh(box(0.04, 0.06, 0.04), ctx.glow(WICK));
  wick.position.set(-0.03, POLE - 0.04, 0);
  pole.add(staff, hook, wick);
  pole.name = "pole";
  g.add(pole);
  return g;
}

const TOOLS: Partial<Record<Task, (ctx: RenderContext) => THREE.Group>> = {
  broom: makeBroom, wash: makeTub, fish: makeRod, hawk: makeHawk, stave: makeStave, fletch: makeArrow, stitch: makeStrap, grind: makeGrindstone,
  tinker: makePot, pewter: makePot, chisel: makeBlock, hoop: makeBarrel, sew: ctx => makeStrap(ctx, true), saw: makeTrestle,
  stir: ctx => makeVat(ctx, "#6a4a2a"), dye: ctx => makeVat(ctx, "#2e4a8a"), spin: makeSpindle, lamp: makePole,
};
const up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0), along = new THREE.Vector3();
const scratch = new THREE.Vector3();
/** How far someone steps in from their tile to their work: to a well's crank (two out from its middle), to a bridge's parapet. */
const REACH: Partial<Record<Task, number>> = { crank: 0.95, fish: 0.45 };

/** Where a hawk is in its flight, `u` from 0 (leaving the fist) to 1 (back on it): rings widening and closing up overhead, about the fist. */
function flight(u: number, fist: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const a = u * Math.PI * 2 * CRAFTS.hawkLaps, r = 1.5 * Math.sin(Math.PI * u);
  return out.set(fist.x + r * (Math.cos(a) - 1), fist.y + 1.5 * Math.sin(Math.PI * u), fist.z + r * Math.sin(a));
}
const fistAt = new THREE.Vector3(), ahead = new THREE.Vector3();
/** Flap a hawk's wings: `k` how far through a beat, `spread` how wide (0 folded, 1 out). */
function flap(hawk: THREE.Group, k: number, spread: number): void {
  for (const w of hawk.getObjectByName("wings")!.children) {
    const s = w.userData.side as number;
    w.rotation.x = s * (spread * (0.2 + Math.sin(k * Math.PI * 2) * 0.9) - (1 - spread) * 0.15);
    w.scale.z = 0.35 + spread * 0.65;
  }
}

// ---------- Loads carried about on the job ----------
/** A load, on the body (so it bobs as they walk); positions in the body's own frame, +x ahead, +z the front hand's side. */
function makeLoad(ctx: RenderContext, load: Load): THREE.Group {
  const g = new THREE.Group(), wood = ctx.lambert("#8a6a44");
  if (load === "sack") {                                     // a sack of meal over the shoulder, on the back-hand side
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5).scale(1.1, 0.8, 1.5), ctx.lambert("#c8b080"));
    sack.position.set(-0.04, 0.82, -0.2);
    g.add(sack);
  } else if (load === "yoke") {                              // a yoke across the shoulders, a bucket hung from either end
    const yoke = new THREE.Mesh(box(0.06, 0.05, 1.1), wood); yoke.position.set(-0.02, 0.8, 0);
    g.add(yoke);
    for (const s of [1, -1]) {
      const rope = new THREE.Mesh(box(0.012, 0.42, 0.012), ctx.basic("#c9b48a")); rope.position.set(-0.02, 0.58, s * 0.52);
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.18, 8), ctx.lambert("#9a7448")); bucket.position.set(-0.02, 0.3, s * 0.52);
      const water = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8).rotateX(-Math.PI / 2), ctx.lambert("#7a98a8")); water.position.set(-0.02, 0.385, s * 0.52);
      g.add(rope, bucket, water);
    }
  } else if (load === "sticks") {                            // a bundle of firewood on the back, bound with cord
    for (let i = 0; i < 5; i++) {
      const stick = new THREE.Mesh(box(0.05, 0.62, 0.05), wood);
      stick.position.set(-0.24 - (i % 2) * 0.05, 0.62, (i - 2) * 0.06); stick.rotation.x = (i - 2) * 0.06;
      g.add(stick);
    }
    const cord = new THREE.Mesh(box(0.14, 0.04, 0.34), ctx.lambert("#5a3a22")); cord.position.set(-0.26, 0.66, 0);
    g.add(cord);
  } else if (load === "washing") {                           // a basket of washing on the hip
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.16, 8, 1, true), ctx.lambert("#b0905a", { side: THREE.DoubleSide }));
    basket.position.set(0.06, 0.46, 0.3);
    const wash = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), ctx.lambert("#ece4d2"));
    wash.position.set(0.06, 0.5, 0.3);
    g.add(basket, wash);
  } else {                                                   // a flat basket of loaves carried on the head
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.06, 9), ctx.lambert("#b0905a"));
    tray.position.set(0, 1.16, 0);
    g.add(tray);
    for (let i = 0; i < 4; i++) {
      const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4).scale(1.3, 0.8, 1), ctx.lambert("#c88a40"));
      const a = (i / 4) * Math.PI * 2 + 0.4;
      loaf.position.set(Math.cos(a) * 0.1, 1.22, Math.sin(a) * 0.1);
      g.add(loaf);
    }
  }
  return g;
}

/**
 * Show what they carry (their `load`) while they're about on the job and their hands aren't at other work,
 * and set their hands to it: steadying the sack on the shoulder, holding the yoke's ropes, the cord of the
 * sticks, the basket at the hip, the loaves on the head (one hand up to it, the other swinging as they walk).
 */
export function poseLoad(ctx: RenderContext, v: Worker, carrying: boolean): void {
  if (!v.load) return;
  if (carrying && !v.carried) { v.carried = makeLoad(ctx, v.load); v.body.add(v.carried); }
  if (v.carried) v.carried.visible = carrying;
  if (!carrying) return;
  const [front, back] = v.hands as [THREE.Mesh, THREE.Mesh];
  if (v.load === "sack") back.position.set(0.02, 0.9, -0.3);
  else if (v.load === "yoke") { front.position.set(0.02, 0.62, 0.46); back.position.set(0.02, 0.62, -0.46); }
  else if (v.load === "sticks") { front.position.set(0.1, 0.72, 0.16); back.position.set(0.1, 0.72, -0.16); }
  else if (v.load === "washing") front.position.set(0.12, 0.5, 0.42);
  else back.position.set(0.02, 1.12, -0.2);
}

/** Pose a townsperson at their work (one of HANDWORK), and show their tool; `t` is the game clock. */
export function poseWork(ctx: RenderContext, v: Worker, at: string | null, t: number, dt: number): void {
  for (const [k, tool] of Object.entries(v.tools)) tool.visible = k === at;
  const task = HANDWORK.find(h => h === at);
  v.reach += (((task && REACH[task]) ?? 0) - v.reach) * Math.min(1, dt * 3);
  if (v.reach > 0.005) {                                     // stepped in (or stepping back): forward is their facing, -rotation.y
    const a = -v.group.rotation.y, dx = Math.cos(a) * v.reach, dz = Math.sin(a) * v.reach;
    v.group.position.x += dx; v.group.position.z += dz;
    v.shadow.position.x += dx; v.shadow.position.z += dz;
  }
  if (!task) return;
  const make = TOOLS[task];
  const tool = make ? (v.tools[task] ??= (() => { const m = make(ctx); v.group.add(m); return m; })()) : null;
  const [front, back] = v.hands as [THREE.Mesh, THREE.Mesh], b = v.body;
  if (task === "broom" && tool) {
    // Leaning on it, the head swung from side to side across the ground ahead; dust off the stones at each end.
    const k = t / CRAFTS.sweep, swing = Math.sin(k * Math.PI * 2), lean = 0.55;
    tool.position.set(0.24, 0.66, 0.04);
    tool.rotation.set(swing * 0.6, 0, lean);
    const along = (d: number): [number, number, number] => [0.24 + d * Math.sin(lean), 0.66 - d * Math.cos(lean) * Math.cos(swing * 0.6), 0.04 - d * Math.cos(lean) * Math.sin(swing * 0.6)];
    front.position.set(...along(0.38));
    back.position.set(...along(0.04));
    b.rotation.z -= 0.1;
    const stroke = Math.floor(k * 2);
    if (stroke !== v.beat) {
      v.beat = stroke;
      scratch.set(...along(0.85)).applyMatrix4(v.group.matrixWorld);
      for (let i = 0; i < 3; i++) ctx.particles.spawn("dust", scratch.x, 0.06, scratch.z, (Math.random() - 0.5) * 0.6, 0.25 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6, 0.6);
    }
  } else if (task === "wash" && tool) {
    // Bent over the tub at her feet, scrubbing the wash down the board and back, a hand after the other.
    tool.position.set(0.5, 0, 0);
    const k = t / CRAFTS.scrub, rub = Math.sin(k * Math.PI * 2) * 0.07;
    front.position.set(0.44 + rub, 0.3, 0.09);
    back.position.set(0.44 - rub, 0.3, -0.09);
    b.rotation.z -= 0.38;
    b.position.y = -0.04;
    const stroke = Math.floor(k / 3);
    if (stroke !== v.beat) {
      v.beat = stroke;
      scratch.set(0.5, 0.22, 0).applyMatrix4(v.group.matrixWorld);
      for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; ctx.particles.spawn("water", scratch.x, scratch.y, scratch.z, Math.cos(a) * 0.4, 0.7 + Math.random() * 0.5, Math.sin(a) * 0.4, 0.35); }
    }
  } else if (task === "crank") {
    // Winding the well's crank round, the handle in the front hand, the back one steadying on the rim.
    const a = (t / CRAFTS.crank) * Math.PI * 2;
    front.position.set(0.3, 0.98 + Math.sin(a) * 0.12, 0.14 + Math.cos(a) * 0.12);
    back.position.set(0.36, 0.62, -0.18);
    b.rotation.z -= 0.06 + Math.max(0, Math.sin(a)) * 0.05;
  } else if (task === "fish" && tool) {
    // Both hands on the rod, its tip out over the parapet, the float bobbing on the river below; every so
    // often a bite pulls the tip down, and he strikes, lifting it sharply, the water splashing.
    const k = (t % CRAFTS.bite) / CRAFTS.bite, dip = k > 0.84 && k < 0.92 ? Math.sin(((k - 0.84) / 0.08) * Math.PI) : 0;
    const strike = k >= 0.92 ? Math.sin(((k - 0.92) / 0.08) * Math.PI) : 0;
    const tilt = 0.87 + Math.sin(t * 0.9) * 0.03 + dip * 0.12 - strike * 0.3, hx = 0.26, hy = 0.72, hz = 0.12;
    const rod = tool.getObjectByName("rod")!, line = tool.getObjectByName("line")!, bob = tool.getObjectByName("float")!;
    rod.position.set(hx, hy, hz);
    rod.rotation.set(0, 0, -tilt);
    const tx = hx + ROD * Math.sin(tilt), ty = hy + ROD * Math.cos(tilt), surface = WATER_Y + 0.03 + Math.sin(t * 2.1) * 0.015 - dip * 0.07;
    line.position.set(tx, ty, hz);
    line.scale.y = Math.max(0.05, ty - surface);
    bob.position.set(tx, surface, hz);
    front.position.set(hx + 0.08 * Math.sin(tilt), hy + 0.08 * Math.cos(tilt), hz + 0.05);
    back.position.set(hx - 0.1 * Math.sin(tilt), hy - 0.1 * Math.cos(tilt), hz - 0.06);
    const bite = Math.floor(t / CRAFTS.bite);
    if (strike > 0 && bite !== v.beat) {
      v.beat = bite;
      bob.getWorldPosition(scratch);
      for (let i = 0; i < 5; i++) { const a = Math.random() * Math.PI * 2; ctx.particles.spawn("water", scratch.x, scratch.y, scratch.z, Math.cos(a) * 0.5, 1 + Math.random() * 0.8, Math.sin(a) * 0.5, 0.4); }
    }
  } else if (task === "hawk" && tool) {
    // The hawk on the raised fist, rousing its feathers now and then; every so often it's off, wheeling up
    // round overhead, and back down to the fist.
    const P = CRAFTS.hawk, F = CRAFTS.hawkFlight, ph = t % P, u = (ph - (P - F)) / F;
    fistAt.set(0.26, 0.86, -0.26);
    back.position.set(0.26, 0.76, -0.26);
    if (u > 0) {
      flight(u, fistAt, tool.position);
      flight(Math.min(1, u + 0.01), fistAt, ahead);
      const dx = ahead.x - tool.position.x, dz = ahead.z - tool.position.z;
      if (dx * dx + dz * dz > 1e-8) tool.rotation.set(0, Math.atan2(-dz, dx), 0);
      flap(tool, t * 3, u < 0.2 || u > 0.85 ? 1 : 0.6);
    } else {
      tool.position.copy(fistAt);
      tool.rotation.set(0, 0.3, 0);
      flap(tool, t * 4, ph % 5.3 < 0.6 ? 0.8 : 0);
    }
  } else if (task === "stave" && tool) {
    // The stave stood in front, held at the top; the drawknife pulled down it, slow, and back up quick; a shaving off it each time.
    tool.position.set(0.36, 0, -0.02);
    const k = (t / CRAFTS.shave) % 1, down = k < 0.75 ? k / 0.75 : 1 - (k - 0.75) / 0.25, y = 0.92 - down * 0.5;
    back.position.set(0.32, 1.02, -0.08);
    front.position.set(0.3, y, 0.1);
    tool.getObjectByName("knife")!.position.set(-0.04, y, 0.04);
    b.rotation.z -= 0.06 + down * 0.08;
    const stroke = Math.floor(t / CRAFTS.shave);
    if (k > 0.72 && stroke !== v.beat) {
      v.beat = stroke;
      scratch.set(0.36, y, 0.08).applyMatrix4(v.group.matrixWorld);
      for (let i = 0; i < 2; i++) ctx.particles.spawn("dust", scratch.x, scratch.y, scratch.z, (Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4, 0.5);
    }
  } else if (task === "fletch" && tool) {
    // An arrow across in front of him, turning in his fingers as he binds on the feathers; done, he holds it up and sights along it.
    const k = (t % CRAFTS.fletch) / CRAFTS.fletch, sight = k > 0.82 ? Math.sin(((k - 0.82) / 0.18) * Math.PI) : 0, arrow = tool.getObjectByName("arrow")!;
    arrow.position.set(0.3 + sight * 0.05, 0.6 + sight * 0.32, 0);
    arrow.rotation.set(0, sight * 0.25, sight ? 0 : t * 1.5);
    back.position.set(0.3, 0.6 + sight * 0.32, 0.24);
    const wind = t * 9;
    front.position.set(sight ? 0.34 : 0.3 + Math.cos(wind) * 0.05, 0.6 + sight * 0.32 + (sight ? 0 : Math.sin(wind) * 0.05), -0.18);
    b.rotation.z -= 0.05 - sight * 0.12;
  } else if ((task === "stitch" || task === "sew") && tool) {
    // A strap held across in front; the front hand pushes the awl through and draws the thread out long, again and again.
    const strap = tool.getObjectByName("strap")!, thread = tool.getObjectByName("thread")!;
    strap.position.set(0.32, 0.56, 0); strap.rotation.set(0.45, 0, 0);
    back.position.set(0.32, 0.47, -0.22);
    const k = (t / CRAFTS.stitch) % 1, pull = k < 0.3 ? 0 : k < 0.75 ? (k - 0.3) / 0.45 : 1 - (k - 0.75) / 0.25;
    front.position.set(0.34 + pull * 0.12, 0.62 + pull * 0.26, 0.04 + pull * 0.3);
    thread.position.set(0.32, 0.6, 0.04);                     // from the hole in the strap to the hand
    along.set(front.position.x - 0.32, front.position.y - 0.6, front.position.z - 0.04);
    thread.scale.y = Math.max(0.01, along.length());
    thread.quaternion.setFromUnitVectors(up, along.normalize());
    thread.visible = pull > 0.05;
    b.rotation.z -= 0.08;
  } else if (task === "grind" && tool) {
    // Bent to the grindstone, the blade laid on the turning wheel in both hands, sparks flying off it; treading the wheel round.
    tool.getObjectByName("wheel")!.rotation.z = -t * 7;
    front.position.set(0.3, 0.72, 0.15);
    back.position.set(0.3, 0.72, -0.15);
    b.rotation.z -= 0.22;
    b.position.y = -0.03 + Math.abs(Math.sin(t * 3.5)) * 0.03;
    const spark = Math.floor(t / CRAFTS.sparks);
    if (spark !== v.beat) {
      v.beat = spark;
      const a = -v.group.rotation.y, fx = Math.cos(a), fz = Math.sin(a);
      scratch.set(0.38, 0.7, 0).applyMatrix4(v.group.matrixWorld);
      ctx.particles.spawn("spark", scratch.x, scratch.y, scratch.z, fx * (0.8 + Math.random()) + (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.6, fz * (0.8 + Math.random()) + (Math.random() - 0.5) * 0.6, 0.3);
    }
  } else if ((task === "tinker" || task === "pewter") && tool) {
    // The pot held up in the back hand, turned a little now and then, the front hand tapping out its dents with a little hammer.
    const k = (t / CRAFTS.tap) % 1, lift = k < 0.7 ? k / 0.7 : 1 - (k - 0.7) / 0.3, pot = tool.getObjectByName("pot")!, hammer = tool.getObjectByName("hammer")!;
    pot.position.set(0.36, 0.56, -0.06); pot.rotation.set(0.5, t * 0.3, 0);
    back.position.set(0.3, 0.5, -0.16);
    front.position.set(0.32, 0.66 + lift * 0.14, 0.1);
    hammer.position.copy(front.position); hammer.rotation.set(0, 0, -0.9 + lift * 0.9);
    b.rotation.z -= 0.12;
    const tap = Math.floor(t / CRAFTS.tap);
    if (tap !== v.beat) {
      v.beat = tap;
      scratch.set(0.38, 0.62, -0.02).applyMatrix4(v.group.matrixWorld);
      ctx.particles.spawn("sparkLight", scratch.x, scratch.y, scratch.z, (Math.random() - 0.5) * 0.5, 0.5, (Math.random() - 0.5) * 0.5, 0.18);
    }
  } else if (task === "tell") {
    // Telling his tale: both arms going, wide and high, leaning in for the good bits and back again.
    front.position.set(0.24 + Math.sin(t * 1.7) * 0.1, 0.62 + Math.max(0, Math.sin(t * 1.3)) * 0.3, 0.42 + Math.sin(t * 2.1) * 0.1);
    back.position.set(0.24 + Math.sin(t * 1.4 + 1) * 0.1, 0.6 + Math.max(0, Math.sin(t * 1.1 + 2)) * 0.26, -0.42 - Math.sin(t * 1.9) * 0.1);
    b.rotation.z += Math.sin(t * 0.9) * 0.1;
    b.position.y = Math.max(0, Math.sin(t * 2.6)) * 0.03;
  } else if (task === "chisel" && tool) {
    // Bent over the block, the chisel set to it in the back hand, the mallet in the front brought down on it; stone dust at each blow.
    const k = (t / CRAFTS.chisel) % 1, lift = k < 0.75 ? k / 0.75 : 1 - (k - 0.75) / 0.25;
    const chisel = tool.getObjectByName("chisel")!, mallet = tool.getObjectByName("mallet")!;
    back.position.set(0.4, 0.56, -0.06);
    chisel.position.set(0.46, 0.5, -0.04); chisel.rotation.set(0, 0, -0.5);
    front.position.set(0.32 + lift * 0.02, 0.62 + lift * 0.24, 0.06);
    mallet.position.copy(front.position); mallet.rotation.set(0, 0, -0.4 + lift * 0.9);
    b.rotation.z -= 0.24;
    const blow = Math.floor(t / CRAFTS.chisel);
    if (blow !== v.beat) {
      v.beat = blow;
      scratch.set(0.5, 0.46, -0.04).applyMatrix4(v.group.matrixWorld);
      for (let i = 0; i < 3; i++) ctx.particles.spawn("dust", scratch.x, scratch.y, scratch.z, (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5, 0.5);
    }
  } else if (task === "hoop" && tool) {
    // The hoop-driver set to the top hoop in the back hand, the hammer in the front coming down on it, working round the barrel.
    const k = (t / CRAFTS.hoop) % 1, lift = k < 0.7 ? k / 0.7 : 1 - (k - 0.7) / 0.3, round = Math.floor(t / CRAFTS.hoop) * 0.7;
    const driver = tool.getObjectByName("driver")!, hammer = tool.getObjectByName("hammer")!;
    const rx = 0.6 - 0.2 * (0.6 + 0.4 * Math.abs(Math.cos(round))), rz = Math.sin(round) * 0.15;   // round the near side of the rim
    driver.position.set(rx, 0.52, rz);
    back.position.set(rx - 0.04, 0.5, rz - 0.04);
    front.position.set(rx - 0.06, 0.66 + lift * 0.2, rz + 0.04);
    hammer.position.copy(front.position); hammer.rotation.set(0, 0, -0.9 + lift * 0.9);
    b.rotation.z -= 0.2;
  } else if (task === "saw" && tool) {
    // A hand on the plank, the saw worked to and fro through its end; sawdust at every stroke.
    const k = (t / CRAFTS.saw) % 1, to = Math.sin(k * Math.PI * 2), saw = tool.getObjectByName("saw")!;
    back.position.set(0.48, 0.48, -0.2);
    front.position.set(0.3 + to * 0.12, 0.56, 0.22);
    saw.position.set(front.position.x, 0.5, 0.22); saw.rotation.set(0, 0, -0.35);
    b.rotation.z -= 0.18 + to * 0.03;
    const stroke = Math.floor(t / CRAFTS.saw);
    if (stroke !== v.beat) {
      v.beat = stroke;
      scratch.set(0.55, 0.38, 0.22).applyMatrix4(v.group.matrixWorld);
      for (let i = 0; i < 3; i++) ctx.particles.spawn("dust", scratch.x, scratch.y, scratch.z, (Math.random() - 0.5) * 0.3, -0.1, (Math.random() - 0.5) * 0.3, 0.6);
    }
  } else if ((task === "stir" || task === "dye") && tool) {
    // Both hands on the paddle, its blade round and round in the vat; a brewer's wort steaming.
    const a = (t / CRAFTS.stir) * Math.PI * 2, paddle = tool.getObjectByName("paddle")!;
    paddle.position.set(0.36 + Math.cos(a) * 0.04, 0.95, Math.sin(a) * 0.04);   // its top in the hands; its blade round the vat
    along.set(0.62 + Math.cos(a) * 0.13 - paddle.position.x, 0.2 - 0.95, Math.sin(a) * 0.13 - paddle.position.z).normalize();
    paddle.quaternion.setFromUnitVectors(down, along);
    front.position.copy(paddle.position).addScaledVector(along, 0.04);
    back.position.copy(paddle.position).addScaledVector(along, 0.28);
    b.rotation.z -= 0.12 + Math.cos(a) * 0.05;
    const puff = Math.floor(t / 1.1);
    if (task === "stir" && puff !== v.beat) {
      v.beat = puff;
      scratch.set(0.62, 0.36, 0).applyMatrix4(v.group.matrixWorld);
      ctx.particles.spawn("dust", scratch.x + (Math.random() - 0.5) * 0.3, scratch.y, scratch.z + (Math.random() - 0.5) * 0.3, 0, 0.5, 0, 1.2);
    }
  } else if (task === "spin" && tool) {
    // The distaff of wool held up in the back hand, the front hand drawing out the yarn; the spindle twirling as it drops, wound up and set going again.
    const k = (t % CRAFTS.spin) / CRAFTS.spin, drop = k < 0.85 ? 0.1 + (k / 0.85) * 0.38 : 0.48 - ((k - 0.85) / 0.15) * 0.38;
    const distaff = tool.getObjectByName("distaff")!, spindle = tool.getObjectByName("spindle")!, yarn = tool.getObjectByName("yarn")!;
    back.position.set(0.18, 0.82, -0.22);
    distaff.position.set(0.2, 0.92, -0.22); distaff.rotation.set(0, 0, -0.2);
    front.position.set(0.32, 0.76, 0.12);
    yarn.position.set(0.32, 0.72, 0.12); yarn.scale.y = drop;
    spindle.position.set(0.32, 0.72 - drop - 0.08, 0.12); spindle.rotation.y = k < 0.85 ? t * 14 : -t * 6;
    b.rotation.z -= 0.03;
  } else if (task === "lamp" && tool) {
    // Facing the lamp a step off: the pole swung up from his side till its wick's up under the lantern, held
    // there while it catches (CRAFTS.lamps.raise), and brought down again; then he's off to the next.
    if (t - ((tool.userData.last as number | undefined) ?? -9) > 0.5) tool.userData.since = t;   // just got here: a new lamp
    tool.userData.last = t;
    const k = t - (tool.userData.since as number), lift = 0.6;
    const u = THREE.MathUtils.smoothstep(Math.min(k, CRAFTS.lamps.stay - k), 0, lift);
    const tipX = 1 / v.size, tipY = (LAMP_HEAD - 0.14) / v.size, up = Math.atan2(tipX - 0.16, tipY - 0.59);
    const tilt = THREE.MathUtils.lerp(0.12, up, u), fx = THREE.MathUtils.lerp(0.24, tipX - POLE * Math.sin(up), u), fy = THREE.MathUtils.lerp(0.25, tipY - POLE * Math.cos(up), u);
    const pole = tool.getObjectByName("pole")!;
    pole.position.set(fx, fy, 0.08);
    pole.rotation.set(0, 0, -tilt);
    back.position.set(fx + 0.2 * Math.sin(tilt), fy + 0.2 * Math.cos(tilt), 0.02);
    front.position.set(fx + 0.6 * Math.sin(tilt), fy + 0.6 * Math.cos(tilt), 0.12);
    b.rotation.z += 0.1 * u;                                 // leaning back a little, looking up at it
  }
}
