// Sword swipes. Every attack is a wide swipe that alternates direction. Presses during a swipe are
// buffered so mashing chains smoothly, each swipe steps you forward, and hits freeze the game for a
// few frames (hitstop) with a little screen shake so impacts land with weight.
import { SWIPE } from "../data/player.ts";
import { hitEnemy, stagger } from "../game/combat.ts";
import type { Game } from "../game/game.ts";
import { sound } from "../game/sfx.ts";
import { heroParts, weaponOf, type HeroParts } from "../game/hero.ts";
import { relativeAngle, sweptThrough, swingRel } from "../game/swing.ts";

function startSwipe(g: Game, h: HeroParts): void {
  sound(g, "swing");
  const { knockback: kb, motion: m, actions: a } = h;
  m.dashCooldown = 0;                                        // a swing resets the dash cooldown
  a.swingSide = -(a.swingSide || -1);
  a.swipe = { t: 0, queued: false, hits: new Set(), aim: m.aim, side: a.swingSide };
  a.swingAim = m.aim;
  kb.vx += Math.cos(m.aim) * SWIPE.step;                     // step into the swing
  kb.vy += Math.sin(m.aim) * SWIPE.step;
}

export function swordSystem(g: Game, dt: number): void {
  const h = heroParts(g), { pos, hero, motion: m, actions: a } = h, input = g.input;
  if (weaponOf(h) !== "blade") { a.swipe = null; return; }
  if (m.swimming || m.jump > 0) a.swipe = null;
  if (input.attackPressed && !m.swimming) {
    if (!a.swipe && a.cooldown <= 0) startSwipe(g, h);
    else if (a.swipe) a.swipe.queued = true;
    input.attackPressed = false;
  }
  const s = a.swipe;
  if (!s) { a.attack = 0; return; }
  const kPrev = s.t / SWIPE.dur;
  s.t += dt;
  const k = Math.min(1, s.t / SWIPE.dur);
  a.attack = Math.max(0.0001, SWIPE.dur - s.t);              // other systems read "attacking" from this
  a.swingK = k;
  a.swingRel = swingRel(s.side, k);

  // The blade sweeps from one side of the aim to the other; whatever it passes through gets hit once.
  for (const [e, { transform: t }] of g.world.query("enemy", "transform")) {
    if (s.hits.has(e)) continue;
    const dx = t.x - pos.x, dy = t.y - pos.y, d = Math.hypot(dx, dy);
    if (d > SWIPE.reach) continue;
    const rel = d < 2 ? 0 : relativeAngle(dx, dy, s.aim);
    if (!sweptThrough(s.side, kPrev, k, rel)) continue;
    s.hits.add(e);
    const nx = d < 2 ? Math.cos(s.aim) : dx / d, ny = d < 2 ? Math.sin(s.aim) : dy / d;
    hitEnemy(g, e, hero.damage);
    stagger(g, e, nx, ny, SWIPE.knock);
    g.hitstop = Math.max(g.hitstop, SWIPE.hitstop);
    g.shake = Math.max(g.shake, SWIPE.shake);
  }

  if (s.t >= SWIPE.dur) {
    a.swipe = null;
    a.attack = 0;
    if (s.queued) startSwipe(g, h);
  }
}
