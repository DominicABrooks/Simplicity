// Punches (unarmed) and the fishing pole's bonk: a short thrust along the aim. The sword, bow and
// a cast pole consume their presses before this runs, so whatever press is left starts a thrust.
import { THRUST } from "../data/player.ts";
import { hitEnemy, stagger } from "../game/combat.ts";
import type { Game } from "../game/game.ts";
import { heroParts, weaponOf } from "../game/hero.ts";

export function thrustSystem(g: Game, dt: number): void {
  const h = heroParts(g), { pos, hero, motion: m, actions: a } = h;
  if (g.input.attackPressed && a.cooldown <= 0 && !m.swimming) {
    a.attack = THRUST.time; a.cooldown = THRUST.cooldown; a.hit = false; a.swingAim = m.aim;
  }
  if (a.attack <= 0 || weaponOf(h) === "blade") return;
  a.attack = Math.max(0, a.attack - dt);
  if (a.hit || a.attack >= THRUST.time * THRUST.hitAt) return;
  // The hit frame: anything 1..reach px ahead and within `width` px either side of the aim.
  a.hit = true;
  const ax = Math.cos(a.swingAim), ay = Math.sin(a.swingAim);
  for (const [e, { transform: t }] of g.world.query("enemy", "transform")) {
    const dx = t.x - pos.x, dy = t.y - pos.y;
    const along = dx * ax + dy * ay, across = Math.abs(dx * ay - dy * ax);
    if (along > 1 && along < THRUST.reach && across < THRUST.width) {
      hitEnemy(g, e, hero.damage);
      stagger(g, e, ax, ay, THRUST.knock);
    }
  }
}
