// Calder's fight, at the edge of the great crack in the Thunder Rift (the rules are CALDER_FIGHT, in src/data/rift.ts).
// He isn't there until the hero comes up close to the crack: then lightning comes down all round the glade, Calder
// turns from the edge, and nobody leaves until one of them falls. He's a Storm mage underneath (sparks, and three
// lightning strikes at a time), and over it: a storm of marked circles coming down round the hero; a blink so fast
// he seems to be in three places, landing close with two echoes of himself, and a moment after it to catch him with a
// blade; static that turns any arrow short of a full draw; and the crack itself, opening wider every time the hero's
// knocked back and closing a little every time he lands a hit, its cold dragging at him and its dark spreading across
// the ground the wider it gets. When he falls, the crack groans shut for the rest of the run. Drawn by the tempest
// view (src/render/tempest.ts), on an entity made for the fight at the ring's middle, and once he's fallen, on one
// that keeps the crack shut.
import type { Entity } from "../core/ecs.ts";
import { CALDER_FIGHT as F } from "../data/rift.ts";
import { MAGE, SPELLS } from "../data/enemies.ts";
import { COMBAT_COLORS } from "../data/ui.ts";
import { HALF, T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { blocked } from "../world/collision.ts";
import { greatCrackSpine } from "../world/greatcrack.ts";
import { beaten, bossHere, bossWaiting, fellAt, summonBoss } from "./bosses.ts";
import { isFrozen } from "./cheats.ts";
import { combatText, damagePlayer } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { heroParts } from "./hero.ts";
import { sound } from "./sfx.ts";
import { spawnBolt, spawnStrike } from "./spawn.ts";

/** One of the echoes his blink leaves round the hero: where it stands, and how long it's been there. */
export interface Echo { x: number; y: number; t: number }

export interface CalderFight {
  /** The ring's middle (cell top-left). */
  x: number; y: number;
  /** Seconds since the lightning shut the ring. */
  t: number;
  angry: boolean;
  /** How open the great crack is: 0 shut, 1 as wide as it goes. */
  open: number;
  nextStorm: number;
  /** Catching his breath after a blink (seconds left), and the two echoes of him standing round the hero meanwhile. */
  daze: number;
  echoes: Echo[];
  /** Which way the hero's been going lately (px/s, smoothed), for the storm to lead him. */
  going: { x: number; y: number } | null;
  /** Where he stood last frame, his health and melee damage taken then, and the hero's hurt (to see blinks, hits and knocks). */
  last: { x: number; y: number; hp: number; melee: number; hurt: number; hx: number; hy: number };
  /** Seconds before the crack's cold pulls at him again, after it's bitten him. */
  letGo: number;
  /** Whether he's said yet that his static turns the arrows. */
  toldStatic: boolean;
  /** The entity it's drawn on. */
  view: Entity;
}

const fights = new WeakMap<Game, CalderFight>();
/** Once he's fallen: the entity the shut crack's drawn on, which arrival it was made in, and how far it's got shutting. */
const scars = new WeakMap<Game, { e: Entity; in: Game["area"]; t: number; from: number }>();
const listening = new WeakSet<Game>();

/** The fight in progress, if the lightning's shut the ring. */
export const calderFight = (g: Game): CalderFight | null => fights.get(g) ?? null;

/**
 * How wide the great crack is drawn and reaches, times its own width: as it was made before the fight; opening and
 * closing in it; and once he's fallen, groaning shut to a seam of grey stone.
 */
export function crackWidth(g: Game): number {
  const f = fights.get(g);
  if (f) return 1 + f.open * (F.crack.widest - 1);
  const s = scars.get(g), k = crackSealed(g);
  return s ? s.from + (F.crack.seam - s.from) * k : fellAt(g, "calder") ? F.crack.seam : 1;
}

/** How far the great crack has sealed over with grey stone since Calder fell (0 open, 1 shut for good). */
export function crackSealed(g: Game): number {
  const s = scars.get(g);
  if (!s) return fellAt(g, "calder") ? 1 : 0;
  const k = Math.min(1, s.t / F.crack.shut);
  return 1 - (1 - k) * (1 - k);
}

/** Seconds since Calder fell, on this arrival in the Rift (counted from the crack's having shut, on any later one); null if he hasn't. */
export const calderGone = (g: Game): number | null => scars.get(g)?.t ?? null;

/** Every frame in his lair: shut the ring when the hero comes close, run the storm and the crack, and once he's fallen, keep it shut. */
export function calderFightSystem(g: Game, dt: number): void {
  if (!listening.has(g)) { listening.add(g); g.events.on("reset", () => { fights.delete(g); scars.delete(g); }); }
  if (g.area.def.id !== "rift") return;
  const at = fellAt(g, "calder");
  if (at) {                                                 // shut for the run
    const s = scars.get(g);
    if (s?.in !== g.area) scars.set(g, { e: g.world.create({ transform: { ...at }, renderable: { kind: "tempest" } }), in: g.area, t: s ? F.crack.shut : 0, from: s?.from ?? 1 });
    else s.t += dt;
  }
  const f = fights.get(g);
  if (!f) { if (bossWaiting(g) === "calder") shut(g); return; }
  const calder = bossHere(g);
  if (calder === null || (g.world.get(calder, "health")?.hp ?? 0) <= 0) { end(g, f, beaten(g, "calder")); return; }
  run(g, f, calder, dt);
}

/** Where he stands, at the crack's edge (cell top-left), from the area's props. */
function standOf(g: Game): { x: number; y: number } | null {
  const p = g.area.layout.props.find((q): q is Extract<Prop, { kind: "boss" }> => q.kind === "boss" && q.who === "calder");
  return p ? { x: p.x - HALF, y: p.y - HALF } : null;
}

/** The great crack, as the area made it. */
const crackOf = (g: Game) => g.area.layout.props.find((p): p is Extract<Prop, { kind: "greatCrack" }> => p.kind === "greatCrack") ?? null;

/** The hero's come up close: down comes the lightning all round, and Calder turns from the edge. */
function shut(g: Game): void {
  const stand = standOf(g), p = g.world.need(g.player, "transform");
  if (!stand || Math.hypot(p.x - stand.x, p.y - stand.y) > F.shutAt) return;
  const mid = { ...stand };
  const view = g.world.create({ transform: { ...mid }, renderable: { kind: "tempest" } });
  const e = summonBoss(g);
  const hp = e === null ? 0 : g.world.need(e, "health").hp;
  fights.set(g, {
    ...mid, t: 0, angry: false, going: null, letGo: 0, open: F.crack.start, nextStorm: F.storm.first, daze: 0, echoes: [],
    last: { ...stand, hp, melee: 0, hurt: heroParts(g).status.hurt, hx: p.x, hy: p.y }, toldStatic: false, view,
  });
  g.shake = Math.max(g.shake, 2.5);
  sound(g, "thunder", p);
  toast(g, F.say.shut, true);
  toast(g, F.say.rise);
}

/** He's down (or the hero's gone): the lightning goes out, and if he fell, the crack starts to groan shut. */
function end(g: Game, f: CalderFight, fell: boolean): void {
  if (g.world.isAlive(f.view)) g.world.destroy(f.view);
  fights.delete(g);
  if (!fell) return;
  const at = fellAt(g, "calder")!;
  scars.set(g, { e: g.world.create({ transform: { ...at }, renderable: { kind: "tempest" } }), in: g.area, t: 0, from: 1 + f.open * (F.crack.widest - 1) });
  toast(g, F.say.open);
  g.shake = Math.max(g.shake, 3);
  sound(g, "thunder", at);
  toast(g, F.say.shutCrack);
}

function run(g: Game, f: CalderFight, calder: Entity, dt: number): void {
  const h = heroParts(g), hp = g.world.need(calder, "health"), enemy = g.world.need(calder, "enemy"), brain = g.world.need(calder, "mage");
  const him = g.world.need(calder, "transform");
  f.t += dt;
  f.angry = hp.hp <= hp.maxHp * F.angry;
  keepIn(f, h.pos);
  keepIn(f, him);
  if (dt > 0 && h.motion.dash <= 0 && h.status.hurt <= 0) {     // walking, not dashing or thrown
    const vx = (h.pos.x - f.last.hx) / dt, vy = (h.pos.y - f.last.hy) / dt, k = Math.min(1, dt * 6), was = f.going ?? { x: 0, y: 0 };
    f.going = { x: was.x + (vx - was.x) * k, y: was.y + (vy - was.y) * k };
  }

  // What happened since last frame: a blade caught him in his daze; a hit landed (the crack closes a little); the
  // hero was knocked back (it opens wider).
  const melee = enemy.melee ?? 0, cut = melee - f.last.melee;
  if (cut > 0 && f.daze > 0) {
    const more = Math.round(cut * (F.blink.cut - 1));
    hp.hp -= more;
    combatText(g, him.x, him.y - 6, F.say.caught, COMBAT_COLORS.crit, true);
  }
  if (hp.hp < f.last.hp) f.open = Math.max(0, f.open - F.crack.hit);
  if (h.status.hurt > f.last.hurt + 0.01) widen(g, f);
  // His static: anything short of a full draw is turned aside.
  for (const [e, { arrow, transform: a }] of g.world.query("arrow", "transform")) {
    if (arrow.power || arrow.dud || arrow.stuck > 0 || Math.hypot(a.x - him.x, a.y - him.y) > F.static) continue;
    g.fx.push({ type: "burst", x: a.x, y: a.y, palette: "spark" });
    sound(g, "dud", a);
    g.world.destroy(e);
    if (!f.toldStatic) { f.toldStatic = true; toast(g, F.say.static); }
  }
  const remember = () => { f.last = { x: him.x, y: him.y, hp: hp.hp, melee, hurt: h.status.hurt, hx: h.pos.x, hy: h.pos.y }; };
  if (hp.hp <= 0 || isFrozen(g)) { remember(); return; }   // (playtesting: the storm holds still with him)

  // A blink: he lands close by the hero instead, with an echo of himself either side of him round the hero.
  if (Math.hypot(him.x - f.last.x, him.y - f.last.y) > F.blink.jump && f.daze <= 0) blinked(g, f, him);
  if (f.daze > 0) {
    f.daze -= dt;
    brain.held = f.daze > 0;
    if (f.daze <= 0) brain.timer = Math.min(brain.timer, 0.3);
  }
  for (const echo of f.echoes) {
    echo.t += dt;
    if (echo.t < F.blink.daze) continue;
    // Its spark, and it's gone.
    const a = Math.atan2(h.pos.y - echo.y, h.pos.x - echo.x), v = SPELLS.spark.speed! * 0.8, o = MAGE.boltOffset;
    spawnBolt(g, "spark", echo.x + Math.cos(a) * o, echo.y + Math.sin(a) * o, Math.cos(a) * v, Math.sin(a) * v);
    g.fx.push({ type: "burst", x: echo.x, y: echo.y, palette: "spark" });
    sound(g, "spell", echo);
  }
  f.echoes = f.echoes.filter(e => e.t < F.blink.daze);

  // The crack: the wider it is, the faster he goes, the harder it pulls, and the further its dark reaches.
  const more = dt * f.open * F.crack.hurry;
  brain.timer -= more;
  brain.blinkCD = Math.max(0, brain.blinkCD - more);
  brain.specialCD = Math.max(0, brain.specialCD - more);
  const safe = h.motion.dash > 0 || h.motion.jump > 0;
  const crack = crackOf(g);
  if (crack) {
    const near = nearestOnCrack(crack, h.pos, crackWidth(g));
    const d = Math.hypot(near.x - h.pos.x, near.y - h.pos.y) || 1;
    f.letGo = Math.max(0, f.letGo - dt);
    if (!safe && h.status.hurt <= 0 && f.letGo <= 0) {
      const pull = F.crack.pull * f.open * dt;
      h.pos.x += ((near.x - h.pos.x) / d) * pull;
      h.pos.y += ((near.y - h.pos.y) / d) * pull;
    }
    if (near.inside && !safe && h.status.hurt <= 0) {
      damagePlayer(g, near.x, near.y - 2 * T, 1);          // thrown back out of the dark, away from the crack
      f.letGo = F.crack.letGo;
      toast(g, F.say.cold);
    }
  }

  // The storm: three circles marked, one on him, one where he's going, one near; and down it comes.
  if ((f.nextStorm -= dt) <= 0) {
    f.nextStorm = F.storm.every[f.angry ? 1 : 0];
    const S = F.storm, a = g.rng.next() * Math.PI * 2, d = S.near[0] + g.rng.next() * (S.near[1] - S.near[0]);
    const going = f.going && Math.hypot(f.going.x, f.going.y) > 8 ? f.going : null;
    const spots = [
      { x: h.pos.x, y: h.pos.y },
      going ? { x: h.pos.x + going.x * S.lead, y: h.pos.y + going.y * S.lead } : { x: h.pos.x + Math.cos(a + 2) * d, y: h.pos.y + Math.sin(a + 2) * d },
      { x: h.pos.x + Math.cos(a) * d, y: h.pos.y + Math.sin(a) * d },
    ].slice(0, S.count);
    for (const s of spots) { keepIn(f, s); spawnStrike(g, s.x, s.y, S.warn); }
    sound(g, "cast", him);
  }
  remember();
}

/** Knocked back: the crack opens wider. */
function widen(g: Game, f: CalderFight): void {
  const was = f.open;
  f.open = Math.min(1, f.open + F.crack.knock);
  g.shake = Math.max(g.shake, 1);
  if (f.open >= 1 && was < 1) toast(g, F.say.widest, true);
  else if (Math.floor(f.open * 3) > Math.floor(was * 3)) toast(g, F.say.wider);
}

/** He blinked: land him close by the hero, with an echo of himself either side round the hero, and let him catch his breath. */
function blinked(g: Game, f: CalderFight, him: { x: number; y: number }): void {
  const h = heroParts(g).pos, base = Math.atan2(him.y - h.y, him.x - h.x), B = F.blink;
  const spots = [0, 1, 2].map(i => {
    const a = base + (i * Math.PI * 2) / 3;
    const s = { x: Math.round(h.x + Math.cos(a) * B.land), y: Math.round(h.y + Math.sin(a) * B.land) };
    keepIn(f, s);
    return s;
  });
  const open = spots.filter(s => !blocked(g.map, s.x, s.y, true));
  const real = open[Math.floor(g.rng.next() * open.length)];
  if (!real) return;                                        // nowhere near him to land: he stays where he blinked to
  g.fx.push({ type: "burst", x: him.x, y: him.y, palette: "spark" });
  him.x = real.x; him.y = real.y;
  f.echoes = spots.filter(s => s !== real).map(s => ({ ...s, t: 0 }));
  for (const s of spots) g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "arcane" });
  f.daze = B.daze;
  sound(g, "blink", him);
}

/** The nearest point on the great crack's spine to `p` (cell top-left px), and whether `p` is in its dark, drawn `wide` times its width. */
export function nearestOnCrack(crack: Extract<Prop, { kind: "greatCrack" }>, p: { x: number; y: number }, wide: number): { x: number; y: number; inside: boolean } {
  const spine = greatCrackSpine(crack), px = (p.x + HALF) / T, py = (p.y + HALF) / T;
  let best = { x: px, y: py, d: Infinity, half: 0 };
  for (let i = 1; i < spine.length; i++) {
    const a = spine[i - 1]!, b = spine[i]!, ex = b.at.x - a.at.x, ez = b.at.z - a.at.z, len2 = ex * ex + ez * ez || 1;
    const k = Math.max(0, Math.min(1, ((px - a.at.x) * ex + (py - a.at.z) * ez) / len2));
    const x = a.at.x + ex * k, y = a.at.z + ez * k, d = Math.hypot(px - x, py - y);
    if (d < best.d) best = { x, y, d, half: a.half + (b.half - a.half) * k };
  }
  return { x: best.x * T - HALF, y: best.y * T - HALF, inside: wide > 1 && best.d < best.half * wide - 0.15 };
}

/** Nobody leaves the ring: kept within its lightning. */
function keepIn(f: CalderFight, t: { x: number; y: number }): void {
  const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
  if (d <= F.keepIn) return;
  t.x = f.x + (dx / d) * F.keepIn;
  t.y = f.y + (dy / d) * F.keepIn;
}
