// The bow: press draws, release shoots along the aim. You can walk (slowly) while drawn. Speed, and
// so range, grows with draw time; a full draw is a power shot with +1 damage. The bow never swings.
import { BOW } from "../data/player.ts";
import { Tile } from "../data/world.ts";
import { hitEnemy, stagger } from "../game/combat.ts";
import type { Game } from "../game/game.ts";
import { heroParts, weaponOf } from "../game/hero.ts";
import { spawnArrow } from "../game/spawn.ts";
import { tileAt } from "../world/collision.ts";

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
  const speed = BOW.minSpeed + BOW.maxSpeedBonus * charge, cos = Math.cos(m.aim), sin = Math.sin(m.aim);
  spawnArrow(g, pos.x + cos * BOW.nock, pos.y + sin * BOW.nock, cos * speed, sin * speed, BOW.arrowLife, hero.damage + (power ? 1 : 0), power);
  a.draw = null;
  a.cooldown = BOW.cooldown;
}

/** Arrows fly until they hit an enemy, run out of range, or sink into a tree. */
export function arrowSystem(g: Game, dt: number): void {
  const w = g.world;
  for (const [e, { transform: p, arrow: a }] of w.query("arrow", "transform")) {
    if (a.stuck > 0) {                                       // embedded in a tree for a moment
      a.stuck -= dt;
      if (a.stuck <= 0) w.destroy(e);
      continue;
    }
    p.x += a.vx * dt; p.y += a.vy * dt; a.life -= dt;
    if (tileAt(g.map, p.x + 4, p.y + 4) === Tile.Tree) { a.stuck = BOW.stuckTime; a.vx = a.vy = 0; continue; }
    let hit = false;
    for (const [s, { transform: t }] of w.query("enemy", "transform")) {
      if (Math.hypot(t.x - p.x, t.y - p.y) >= BOW.hitRadius) continue;
      const d = Math.hypot(a.vx, a.vy) || 1;
      hitEnemy(g, s, a.damage);
      stagger(g, s, a.vx / d, a.vy / d, BOW.knock);
      hit = true;
      break;
    }
    if (hit || a.life <= 0) w.destroy(e);
  }
}
