// Mages: three schools share one body and one brain. Keep a casting distance, telegraph every spell
// with a charge-up, blink away when crowded or pinned, and draw a sword up close while blink is on
// cooldown. Each school has its own bolt and a signature spell.
import type { Entity } from "../core/ecs.ts";
import { MAGE, SCHOOLS, SPELLS, type SpellName } from "../data/enemies.ts";
import type { Knockback, MageBrain, Transform } from "../game/components.ts";
import { cancelActions, damagePlayer } from "../game/combat.ts";
import { toast, type Game } from "../game/game.ts";
import { heroParts, type HeroParts } from "../game/hero.ts";
import { spawnBolt, spawnStrike } from "../game/spawn.ts";
import { MAGE_SWING_TIME, mageSwingK, relativeAngle, sweptThrough, swingRel } from "../game/swing.ts";
import { blocked, moveBy } from "../world/collision.ts";

export function mageSystem(g: Game, dt: number): void {
  const h = heroParts(g);
  for (const [e, { transform, mage, enemy }] of g.world.query("mage", "transform", "enemy")) {
    enemy.face = h.pos.x - transform.x >= 0 ? 1 : -1;
    updateMage(g, h, e, transform, mage, dt);
  }
}

function updateMage(g: Game, h: HeroParts, e: Entity, s: Transform, b: MageBrain, dt: number): void {
  const p = h.pos, dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
  const school = SCHOOLS[b.school];
  b.blinkCD = Math.max(0, b.blinkCD - dt);
  b.specialCD = Math.max(0, b.specialCD - dt);
  if (b.casting && b.spell) {
    const charge = SPELLS[b.spell].charge;
    b.castT += dt;
    b.castK = Math.min(1, b.castT / charge);
    b.moving = false;
    if (b.castT >= charge) releaseSpell(g, h, s, b, dx, dy);
    return;
  }
  // Frost Mage: getting close sets off Frost Nova first (then it usually blinks away).
  if (school.special === "nova" && d < SPELLS.nova.radius! && b.specialCD <= 0 && !b.melee) { startCast(b, "nova"); return; }
  const kb = g.world.need(e, "knockback");
  // Up close: blink away if it can, otherwise draw the sword and fight until blink is ready again.
  if (!b.melee && d < MAGE.near) {
    if (b.blinkCD <= 0) { blinkMage(g, p, s, b, kb); return; }
    b.melee = true; b.swing = null; b.swingCD = MAGE.firstSwing;
  }
  if (b.melee) {
    if (b.blinkCD <= 0 && !b.swing) { b.melee = false; blinkMage(g, p, s, b, kb); return; }
    if (d > MAGE.meleeLeash && !b.swing) { b.melee = false; b.timer = Math.max(b.timer, MAGE.afterLeash); return; }   // you got away
    updateMelee(g, h, s, b, dt, dx, dy, d);
    return;
  }
  // Back off when crowded, close in when far, otherwise circle at casting range.
  let mx = 0, my = 0;
  if (d < MAGE.near) { mx = -dx / d; my = -dy / d; }
  else if (d > MAGE.far && d < MAGE.sight * 1.5) { mx = dx / d; my = dy / d; }
  else if (d <= MAGE.far) {
    if ((b.strafeT -= dt) <= 0) { b.strafe = g.rng.next() < 0.5 ? 1 : -1; b.strafeT = 1 + g.rng.next() * 1.5; }
    mx = (-dy / d) * b.strafe * 0.7; my = (dx / d) * b.strafe * 0.7;
  }
  // Track whether a wall is stopping it; if it stays pinned, blink away.
  if (mx || my) {
    const ox = s.x, oy = s.y;
    moveBy(g.map, s, mx * MAGE.speed * dt, my * MAGE.speed * dt, true);
    b.stuckT = Math.hypot(s.x - ox, s.y - oy) < MAGE.speed * dt * 0.3 ? b.stuckT + dt : 0;
  } else b.stuckT = 0;
  b.moving = !!(mx || my);
  if (b.stuckT >= MAGE.stuckBeforeBlink && b.blinkCD <= 0) { blinkMage(g, p, s, b, kb); return; }
  if ((b.timer -= dt) <= 0 && d < MAGE.sight) {
    const sp = school.special, S = SPELLS[sp];
    const usable = S.chance && b.specialCD <= 0 && !(sp === "poly" && h.status.sheep > 0);
    startCast(b, usable && g.rng.next() < S.chance! ? sp : school.bolt);
  }
}

function startCast(b: MageBrain, spell: SpellName): void {
  b.casting = true; b.castT = 0; b.castK = 0; b.spell = spell;
}

/** A finished cast: bolts fly at the hero, Frost Nova bursts around the mage, Lightning Strike marks the ground. */
function releaseSpell(g: Game, h: HeroParts, s: Transform, b: MageBrain, dx: number, dy: number): void {
  const p = h.pos, spell = b.spell!, S = SPELLS[spell], a = Math.atan2(dy, dx);
  if (spell === "nova") {
    g.fx.push({ type: "nova", x: s.x, y: s.y, radius: S.radius! });
    if (Math.hypot(dx, dy) < S.radius! && h.motion.dash <= 0 && h.motion.jump <= 0) {
      h.status.frozen = S.freeze!;
      cancelActions(h.actions);
      toast(g, "Frozen!");
    }
  } else if (spell === "strike") {
    for (let i = 0; i < S.count!; i++) {
      const off = i === 0 ? 0 : 8 + g.rng.next() * 8, oa = g.rng.next() * Math.PI * 2;
      spawnStrike(g, p.x + Math.cos(oa) * off, p.y + Math.sin(oa) * off, S.delay!);
    }
  } else {
    const o = MAGE.boltOffset;
    spawnBolt(g, spell, s.x + Math.cos(a) * o, s.y + Math.sin(a) * o, Math.cos(a) * S.speed!, Math.sin(a) * S.speed!);
  }
  if (S.cooldown) b.specialCD = S.cooldown;
  b.casting = false;
  b.timer = MAGE.every[0] + g.rng.next() * (MAGE.every[1] - MAGE.every[0]);
}

/** Teleport to a random open spot 5-9 tiles from the hero, clear of trees and water on all sides. */
function blinkMage(g: Game, p: Transform, s: Transform, b: MageBrain, kb: Knockback): void {
  for (let i = 0; i < MAGE.blinkTries; i++) {
    const a = g.rng.next() * Math.PI * 2, d = MAGE.blinkMin + g.rng.next() * (MAGE.blinkMax - MAGE.blinkMin);
    const x = Math.round(p.x + Math.cos(a) * d), y = Math.round(p.y + Math.sin(a) * d);
    if ([[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].some(([ox, oy]) => blocked(g.map, x + ox!, y + oy!, true))) continue;
    g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "arcane" });
    s.x = x; s.y = y;
    kb.vx = kb.vy = 0;
    g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "arcane" });
    b.blinkCD = MAGE.blinkCooldown;
    b.stuckT = 0;
    b.timer = Math.max(b.timer, MAGE.afterBlink);
    return;
  }
}

/** Sword drawn: chase the hero and swing on the same curve as the hero's swipes. */
function updateMelee(g: Game, h: HeroParts, s: Transform, b: MageBrain, dt: number, dx: number, dy: number, d: number): void {
  b.swingCD = Math.max(0, b.swingCD - dt);
  const sw = b.swing;
  if (sw) {
    b.moving = false;
    const kPrev = mageSwingK(sw.t);
    sw.t += dt;
    const k = mageSwingK(sw.t);
    b.swingK = k;
    b.swingRel = swingRel(sw.side, k);
    // Same sweep test as the hero's: hit if the blade passed through the hero's direction this frame.
    const { motion, status } = h;
    if (!sw.hit && d <= MAGE.swingReach && status.hurt <= 0 && motion.dash <= 0 && motion.jump <= 0
      && sweptThrough(sw.side, kPrev, k, relativeAngle(dx, dy, sw.aim))) {
      sw.hit = true;
      damagePlayer(g, s.x, s.y);
    }
    if (sw.t >= MAGE_SWING_TIME) { b.swing = null; b.swingCD = MAGE.swingRest; }
    return;
  }
  if (d > MAGE.swingReach - 2) {                             // chase
    moveBy(g.map, s, (dx / d) * MAGE.chaseSpeed * dt, (dy / d) * MAGE.chaseSpeed * dt, true);
    b.moving = true;
  } else b.moving = false;
  if (d <= MAGE.swingReach + 2 && b.swingCD <= 0) {
    b.swingSide = -(b.swingSide || -1);
    b.swing = { t: 0, side: b.swingSide, aim: Math.atan2(dy, dx), hit: false };
  }
}
