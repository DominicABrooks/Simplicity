// The hero's body: status timers, walking, swimming, dashing and jumping.
import { CHILL_SLOW } from "../data/enemies.ts";
import { BOW, DASH, JUMP_TIME, MOVE, RESET_HOLD } from "../data/player.ts";
import { Tile } from "../data/world.ts";
import { resetGame } from "../game/reset.ts";
import { setState, type Game } from "../game/game.ts";
import { heroParts } from "../game/hero.ts";
import { moveBy, tileAt } from "../world/collision.ts";

/** Hold R to restart the run. A reset needs R released before another can start. */
export function resetHoldSystem(g: Game, dt: number): void {
  g.resetHold = g.input.keys.has("r") && !g.resetLatch ? g.resetHold + dt : 0;
  if (g.resetHold >= RESET_HOLD) {
    g.resetHold = 0;
    g.resetLatch = true;
    resetGame(g);
    setState(g, "play");
  }
}

/** Count down timers. Polymorphed or frozen, the hero can't act, so their presses are dropped. */
export function heroStatusSystem(g: Game, dt: number): void {
  const { pos, motion, status, actions } = heroParts(g), input = g.input;
  if (status.sheep > 0) {                                    // polymorphed: walking is all a sheep can do
    status.sheep = Math.max(0, status.sheep - dt);
    input.attackPressed = input.attackReleased = input.jumpPressed = false;
    input.dashRequest = null;
  }
  if (status.frozen > 0) {                                   // frozen solid: no moving, no acting
    status.frozen = Math.max(0, status.frozen - dt);
    input.attackPressed = input.attackReleased = input.jumpPressed = false;
    input.dashRequest = null;
  }
  status.chill = Math.max(0, status.chill - dt);
  actions.cooldown = Math.max(0, actions.cooldown - dt);
  status.hurt = Math.max(0, status.hurt - dt);
  motion.dashCooldown = Math.max(0, motion.dashCooldown - dt);
  motion.swimming = motion.jump <= 0 && tileAt(g.map, pos.x + 4, pos.y + 6) === Tile.Water;
}

/** Aim, walk, swim, dash and jump. */
export function heroMoveSystem(g: Game, dt: number): void {
  const { pos, knockback: kb, hero, motion: m, status, actions: a } = heroParts(g), input = g.input, keys = input.keys;
  let ix = 0, iy = 0;
  if (keys.has("a") || keys.has("arrowleft")) ix--;
  if (keys.has("d") || keys.has("arrowright")) ix++;
  if (keys.has("w") || keys.has("arrowup")) iy--;
  if (keys.has("s") || keys.has("arrowdown")) iy++;
  if (status.frozen > 0) ix = iy = 0;
  // The cursor sets the aim once the mouse has moved; until then the aim follows movement.
  if (input.pointer) m.aim = Math.atan2(input.pointer.y - pos.y, input.pointer.x - pos.x);
  else if (ix || iy) m.aim = Math.atan2(iy, ix);
  m.face = Math.cos(a.attack > 0 ? a.swingAim : m.aim) >= 0 ? 1 : -1;
  const len = Math.hypot(ix, iy) || 1;
  const speed = (m.swimming ? MOVE.swimSpeed : MOVE.speed) * (a.attack > 0 ? MOVE.attackSlow : 1) * (a.draw ? BOW.drawSlow : 1)
    * (status.sheep > 0 ? MOVE.sheepSlow : 1) * (status.chill > 0 ? CHILL_SLOW : 1) * hero.speedMul;
  m.moving = ix !== 0 || iy !== 0;
  // Swings and dashes feed each other: a dash can cancel a sword swing at any point and readies
  // the next swing; starting a swing readies the next dash (see the sword system).
  if (input.dashRequest && m.dash <= 0 && m.dashCooldown <= 0 && !m.swimming && m.jump <= 0 && (a.attack <= 0 || a.swipe)) {
    if (a.swipe) { a.swipe = null; a.attack = 0; }
    m.dash = DASH.time;
    m.dashCooldown = DASH.cooldown * hero.dashMul;
    [m.dashX, m.dashY] = input.dashRequest;
    a.cooldown = 0;                                          // a dash resets the swing cooldown
  }
  if (m.dash > 0) {                                          // dashing overrides walking; trees stop it, water ends it
    m.dash = Math.max(0, m.dash - dt);
    moveBy(g.map, pos, m.dashX * DASH.speed * dt, m.dashY * DASH.speed * dt, false);
    if (tileAt(g.map, pos.x + 4, pos.y + 6) === Tile.Water) m.dash = 0;
  } else {
    moveBy(g.map, pos, (ix / len) * speed * dt + kb.vx * dt, (iy / len) * speed * dt + kb.vy * dt, false);
  }
  kb.vx *= Math.pow(MOVE.drag, dt);
  kb.vy *= Math.pow(MOVE.drag, dt);

  if (input.jumpPressed && m.jump <= 0 && !m.swimming && a.attack <= 0) m.jump = JUMP_TIME;
  if (m.jump > 0) m.jump = Math.max(0, m.jump - dt);
}

/** Presses are one-frame events: whatever no system used this frame is dropped. */
export function clearPressesSystem(g: Game): void {
  const input = g.input;
  input.attackPressed = input.attackReleased = input.jumpPressed = false;
  input.dashRequest = null;
}
