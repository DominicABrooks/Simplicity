// The bow: press draws, release shoots along the aim. You can walk (slowly) while drawn. Speed, and
// so range, grows with draw time. Only a full draw does real damage: a power shot with +1 damage. The bow never swings.
import { BOW } from "../data/player.ts";
import { COMBAT_COLORS } from "../data/ui.ts";
import { combatText, hitEnemy, stagger } from "../game/combat.ts";
import type { Arrow, Transform } from "../game/components.ts";
import type { Game } from "../game/game.ts";
import { sound } from "../game/sfx.ts";
import { heroParts, weaponOf } from "../game/hero.ts";
import { spawnArrow } from "../game/spawn.ts";
import { spared } from "../game/peace.ts";
import { solidAt } from "../world/collision.ts";

export function bowSystem(g: Game, dt: number): void {
  const h = heroParts(g), { pos, hero, motion: m, actions: a } = h, input = g.input;
  if (weaponOf(h) !== "bow") { a.draw = null; return; }
  if (input.attackPressed && !a.draw && a.cooldown <= 0 && !m.swimming) a.draw = { t: 0 };
  input.attackPressed = false;
  if (!a.draw) return;
  a.draw.t += dt;
  if (m.swimming || m.dash > 0 || m.jump > 0) { a.draw = null; return; }
  if (!input.attackReleased) return;
  const charge = Math.min(1, a.draw.t / BOW.drawTime), power = charge >= 1;
  const cos = Math.cos(m.aim), sin = Math.sin(m.aim), x = pos.x + cos * BOW.nock, y = pos.y + sin * BOW.nock;
  // A full draw is a power shot: your damage +1. Anything less barely scratches, and a draw too weak
  // to do any damage at all is a dud: the arrow flops out and drops to the ground, further the more you drew.
  const damage = power ? hero.damage + 1 : Math.floor(hero.damage * BOW.partialDamage * charge);
  if (damage < 1) {
    const { minRange, maxRange, flightTime } = BOW.dud, speed = (minRange + (maxRange - minRange) * charge) / flightTime;
    spawnArrow(g, x, y, cos * speed, sin * speed, flightTime, 0, false, true);
    sound(g, "dud");
  } else {
    const speed = BOW.minSpeed + BOW.maxSpeedBonus * charge;
    spawnArrow(g, x, y, cos * speed, sin * speed, BOW.arrowLife, damage, power);
    sound(g, power ? "powerShot" : "bowRelease");
  }
  a.draw = null;
  a.cooldown = BOW.cooldown;
}

/** Arrows fly until they hit an enemy, run out of range, or sink into a tree. Duds just drop to the ground. */
export function arrowSystem(g: Game, dt: number): void {
  const w = g.world;
  for (const [e, { transform: p, arrow: a }] of w.query("arrow", "transform")) {
    if (a.stuck > 0) {                                       // in a tree, or on the ground, for a moment
      a.stuck -= dt;
      if (a.stuck <= 0) w.destroy(e);
      continue;
    }
    p.x += a.vx * dt; p.y += a.vy * dt; a.life -= dt;
    if (solidAt(g.map, p.x + 4, p.y + 4)) { a.stuck = BOW.stuckTime; a.vx = a.vy = 0; continue; }
    if (a.dud) {                                             // harmless: glances off enemies, lands, lies there a moment
      if (!a.bounced) glanceOffEnemy(g, p, a);
      if (a.life <= 0) { a.stuck = BOW.stuckTime; a.grounded = true; a.vx = a.vy = 0; }
      continue;
    }
    let hit = false;
    for (const [s, { transform: t }] of w.query("enemy", "transform")) {
      if (Math.hypot(t.x - p.x, t.y - p.y) >= BOW.hitRadius || spared(g, s)) continue;
      const d = Math.hypot(a.vx, a.vy) || 1;
      hitEnemy(g, s, a.damage, false);
      stagger(g, s, a.vx / d, a.vy / d, BOW.knock);
      hit = true;
      break;
    }
    if (hit || a.life <= 0) w.destroy(e);
  }
}

/** A dud that reaches an enemy bounces off it: no damage (a grey 0), a flicker and a spark, and it tumbles to the ground. */
function glanceOffEnemy(g: Game, p: Transform, a: Arrow): void {
  for (const [s, { transform: t, enemy }] of g.world.query("enemy", "transform")) {
    const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy);
    if (d >= BOW.hitRadius || spared(g, s)) continue;
    // Back off the way it came (away from the enemy), knocked a little to one side.
    const { speed, minSpeed, spread, flightTime } = BOW.glance;
    const away = d > 0.01 ? Math.atan2(dy, dx) : Math.atan2(-a.vy, -a.vx);
    const angle = away + (g.rng.next() - 0.5) * 2 * spread, v = Math.max(minSpeed, Math.hypot(a.vx, a.vy) * speed);
    a.vx = Math.cos(angle) * v;
    a.vy = Math.sin(angle) * v;
    a.life = a.flight = flightTime;
    a.bounced = true;
    enemy.flash = Math.max(enemy.flash, 0.08);
    combatText(g, t.x, t.y, "0", COMBAT_COLORS.glance);
    g.fx.push({ type: "hit", x: p.x, y: p.y });
    return;
  }
}
