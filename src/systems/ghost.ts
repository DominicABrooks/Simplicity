// The Grey Ringer in a fight. She rises out of her grave, then drifts after the hero through walls and
// gravestones alike; touching her hurts. Every couple of seconds she either tolls her bell (a charge-up, then a
// ring of sound breaking over everything near her: two hearts unless you dash or jump through it) or wails
// a fan of wisps that drift after you. Lead her too far from her grave and she drifts back to it, mending.
// Below half health she's angry: faster, more wisps, and now and then she fades away and comes back behind
// you, already tolling. She can't be knocked about; she's not really there.
import { SPELLS } from "../data/enemies.ts";
import { BELL_HOME, GHOST, GHOST_SAYS } from "../data/ghost.ts";
import { XP } from "../data/progression.ts";
import type { Entity } from "../core/ecs.ts";
import type { GhostAct, GhostBrain, Transform } from "../game/components.ts";
import { isFrozen } from "../game/cheats.ts";
import { damagePlayer, grantXP } from "../game/combat.ts";
import { spendCurio } from "../game/curios.ts";
import { toast, type Game } from "../game/game.ts";
import { sound } from "../game/sfx.ts";
import { bellHome, ghostListens, ghostSolid, graveGoods } from "../game/ghost.ts";
import { heroParts, type HeroParts } from "../game/hero.ts";
import { spawnBolt } from "../game/spawn.ts";
import { speak, talking } from "../game/talk.ts";
import { blocked, overlap } from "../world/collision.ts";

const between = (g: Game, [a, b]: readonly [number, number]) => a + g.rng.next() * (b - a);

export function ghostSystem(g: Game, dt: number): void {
  const h = heroParts(g);
  for (const [e, { transform, ghost, health }] of g.world.query("ghost", "transform", "health")) {
    const kb = g.world.get(e, "knockback");
    if (kb) kb.vx = kb.vy = 0;                               // blows pass through her
    const enemy = g.world.get(e, "enemy");
    if (enemy) enemy.face = h.pos.x - transform.x >= 0 ? 1 : -1;
    if (ghost.calm) { updateCalm(g, h, e, transform, ghost, dt); continue; }
    if (isFrozen(g) && ghost.act !== "rise") continue;       // playtesting: up out of the grass, then held still, doing nothing
    if (!ghost.angry && health.hp > 0 && health.hp <= health.maxHp * GHOST.angry) {
      ghost.angry = true;
      g.shake = Math.max(g.shake, 3);
      toast(g, GHOST_SAYS.angry);
    }
    updateGhost(g, h, e, transform, ghost, health, dt);
  }
}

function start(b: GhostBrain, act: GhostAct): void {
  b.act = act;
  b.t = 0;
}

function updateGhost(g: Game, h: HeroParts, e: Entity, s: Transform, b: GhostBrain, health: { hp: number; maxHp: number }, dt: number): void {
  const p = h.pos, dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
  b.t += dt;
  switch (b.act) {
    case "rise":
      if (b.t >= GHOST.rise) { ghostSolid(g, e, true); start(b, "drift"); b.next = between(g, GHOST.every); }
      return;
    case "toll": {
      const charge = b.angry ? GHOST.toll.angryCharge : GHOST.toll.charge;
      if (b.t < charge) return;
      g.fx.push({ type: "toll", x: s.x, y: s.y, radius: GHOST.toll.radius });
      sound(g, "toll", s);
      g.shake = Math.max(g.shake, 2.5);
      if (d < GHOST.toll.radius && h.status.hurt <= 0 && h.motion.dash <= 0 && h.motion.jump <= 0) damagePlayer(g, s.x, s.y, GHOST.toll.damage);
      rest(g, b);
      return;
    }
    case "wail": {
      if (b.t < GHOST.wail.charge) return;
      const n = b.angry ? GHOST.wail.angryCount : GHOST.wail.count, a0 = Math.atan2(dy, dx), v = SPELLS.wisp.speed!;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * GHOST.wail.spread;
        spawnBolt(g, "wisp", s.x + Math.cos(a) * 5, s.y + Math.sin(a) * 5, Math.cos(a) * v, Math.sin(a) * v);
      }
      rest(g, b);
      return;
    }
    case "fade": {
      if (b.t < GHOST.fade.gone) return;
      // Back behind the hero (whichever way he's facing), somewhere open, already raising the bell.
      const back = Math.atan2(Math.sin(h.motion.aim + Math.PI), Math.cos(h.motion.aim + Math.PI));
      for (let i = 0; i < 12; i++) {
        const a = back + (i ? (g.rng.next() - 0.5) * Math.PI * 1.4 : 0);
        const x = p.x + Math.cos(a) * GHOST.fade.behind, y = p.y + Math.sin(a) * GHOST.fade.behind;
        if (!blocked(g.map, x, y, true) || i === 11) { s.x = x; s.y = y; break; }
      }
      b.hidden = false;
      ghostSolid(g, e, true);
      g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "frost" });
      start(b, "toll");
      return;
    }
    case "return": {
      const hx = b.home.x - s.x, hy = b.home.y - s.y, hd = Math.hypot(hx, hy);
      health.hp = Math.min(health.maxHp, health.hp + GHOST.mend * dt);
      if (hd < 2) { start(b, "drift"); b.next = between(g, GHOST.every); return; }
      const step = Math.min(hd, GHOST.returnSpeed * dt);
      s.x += (hx / hd) * step; s.y += (hy / hd) * step;
      return;
    }
    case "drift": {
      // Lead her too far from her grave and she goes back to it.
      if (Math.hypot(p.x - b.home.x, p.y - b.home.y) > GHOST.leash) { start(b, "return"); return; }
      const step = (b.angry ? GHOST.angrySpeed : GHOST.speed) * dt;
      if (d > 4) { s.x += (dx / d) * step; s.y += (dy / d) * step; }
      if (h.status.hurt <= 0 && h.motion.jump <= 0 && h.motion.dash <= 0 && overlap(p, s)) damagePlayer(g, s.x, s.y, GHOST.touch);
      if ((b.next -= dt) > 0) return;
      if (b.angry && g.rng.next() < GHOST.fade.chance) {
        b.hidden = true;
        ghostSolid(g, e, false);
        g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "frost" });
        start(b, "fade");
        return;
      }
      start(b, d < GHOST.toll.near && g.rng.next() < 0.65 ? "toll" : "wail");
      return;
    }
  }
}

/** After an attack: back to drifting, with a breather before the next. */
function rest(g: Game, b: GhostBrain): void {
  start(b, "drift");
  b.next = between(g, b.angry ? GHOST.angryEvery : GHOST.every);
}

/**
 * Calm, for her bell (BELL_HOME): up out of the grass, over to the hero, a word, and she takes it back. Then she
 * rings nine with it one last time, and goes, leaving her grave goods behind.
 */
function updateCalm(g: Game, h: HeroParts, e: Entity, s: Transform, b: GhostBrain, dt: number): void {
  const p = h.pos, dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
  b.t += dt;
  switch (b.act) {
    case "rise":
      if (b.t >= GHOST.rise) { ghostListens(g, e); start(b, "come"); }
      return;
    case "come":
      if (!g.world.has(e, "targetable")) ghostListens(g, e);
      if (d > BELL_HOME.near + 0.5) { const step = Math.min(d - BELL_HOME.near, BELL_HOME.speed * dt); s.x += (dx / d) * step; s.y += (dy / d) * step; return; }
      speak(g, e, "ismay", BELL_HOME.lines);
      start(b, "speak");
      return;
    case "speak":
      if (talking(g)) return;
      spendCurio(g, "bell");
      start(b, "ring");
      return;
    case "ring": {
      // A toll every so often as she rings, harmless now: just the sound of it going out over the city.
      const every = BELL_HOME.ring / 3;
      if (Math.floor(b.t / every) !== Math.floor((b.t - dt) / every)) {
        g.fx.push({ type: "toll", x: s.x, y: s.y, radius: GHOST.toll.radius });
        sound(g, "toll", s);
      }
      if (b.t < BELL_HOME.ring) return;
      g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "frost" });
      grantXP(g, XP.ghost, s.x, s.y);
      graveGoods(g, s.x, s.y);
      if (g.target === e) g.target = null;
      g.world.destroy(e);
      bellHome(g);
      return;
    }
    default:
      start(b, "come");
  }
}
