// Moving between areas. Only one area is ever built: arriving somewhere clears the last area's
// entities (the hero carries on, gear and all) and builds the new one from its definition.
import { SPAWNING } from "../data/enemies.ts";
import { HALF } from "../data/world.ts";
import { FACING_ANGLE, type AreaDef } from "../world/area.ts";
import { FEET, randomGroundSpot } from "../world/collision.ts";
import { layoutOf } from "../world/layouts.ts";
import { doorStep } from "../world/townkit.ts";
import { spawnBed, spawnTent } from "./sleeping.ts";
import { lockedOut } from "./undercroft.ts";
import { cancelActions } from "./combat.ts";
import { setState, toast, type Game } from "./game.ts";
import { spawnCampfire, spawnEnemy, spawnGuard, spawnKing, spawnPotion, spawnTraining } from "./spawn.ts";

/** Put the hero at an arrival point in an area, and fill the area with what lives there. */
export function enterArea(g: Game, def: AreaDef, entry: string): void {
  const layout = layoutOf(def), at = layout.entries[entry] ?? doorStep(layout, entry);   // or out of a house's door
  if (!at) throw new Error(`Area "${def.id}" has no entry "${entry}"`);
  for (const e of g.world.entities()) if (e !== g.player) g.world.destroy(e);
  g.area = { def, layout };
  g.map = layout.map;
  g.travel = null;
  g.fx = [];
  g.sfx = [];
  g.floaters = [];
  g.target = null;
  g.spawnTimer = 0;

  // The hero arrives standing still, whatever they were doing.
  const pos = g.world.need(g.player, "transform"), kb = g.world.need(g.player, "knockback"), motion = g.world.need(g.player, "motion");
  pos.x = at.x; pos.y = at.y;
  kb.vx = kb.vy = 0;
  motion.dash = motion.jump = 0;
  cancelActions(g.world.need(g.player, "actions"));

  for (const prop of layout.props) {
    if (prop.kind === "camp") { spawnCampfire(g, prop.fire.x, prop.fire.y); if (prop.tent) spawnTent(g, prop.tent); }
    if (prop.kind === "furniture" && prop.item === "bed") spawnBed(g, prop);
    if (prop.kind === "guard") spawnGuard(g, prop.x - HALF, prop.y - HALF, FACING_ANGLE[prop.facing]);
    if (prop.kind === "king") spawnKing(g, prop.x - HALF, prop.y - HALF, FACING_ANGLE[prop.facing]);
    if (prop.kind === "dummy" || prop.kind === "target") spawnTraining(g, prop.kind === "dummy" ? "dummy" : "butt", prop.x - HALF, prop.y - HALF, FACING_ANGLE[prop.facing]);
  }
  const life = def.life;
  if (life?.enemies) for (let i = 0; i < SPAWNING.startSlimes; i++) spawnEnemy(g, 80);
  if (life?.potions) {
    for (let i = 0; i < SPAWNING.startPotions; i++) {
      const p = randomGroundSpot(g.map, g.rng, pos, 40);
      if (p) spawnPotion(g, p.x, p.y);
    }
  }
  g.events.emit("area", g.area);
}

/** Has the hero walked into one of the area's exits? Then hold still and ask to travel. */
export function travelSystem(g: Game): void {
  if (g.travel) return;
  const p = g.world.need(g.player, "transform");
  // The hero's feet box, as everywhere else.
  const fx = p.x + FEET.x, fy = p.y + FEET.y, fw = FEET.w, fh = FEET.h;
  for (const exit of g.area.layout.exits) {
    const r = exit.rect;
    if (fx < r.x + r.w && r.x < fx + fw && fy < r.y + r.h && r.y < fy + fh) {
      if (lockedOut(g, exit)) return;
      g.travel = exit.to;
      setState(g, "travel");
      return;
    }
  }
}

/** The next area is loaded: go there, and pick up where you left off. */
export function arrive(g: Game, def: AreaDef): void {
  const to = g.travel;
  if (!to || to.area !== def.id) throw new Error(`Not travelling to "${def.id}"`);
  enterArea(g, def, to.entry);
  setState(g, "play");
  toast(g, def.name, true);
}
