// Temporary: drives the legacy three.js view from the ECS world until the render layer is ported.
// The legacy view wants plain objects with stable identities, and centre coordinates for
// projectiles, effects and fishing (everything else is a cell top-left, as in the ECS).
import type { Entity } from "../core/ecs.ts";
import { SPELLS } from "../data/enemies.ts";
import { PAL } from "../data/palette.ts";
import { BOW, FISHING, JUMP_TIME, THRUST } from "../data/player.ts";
import { HALF, Tile } from "../data/world.ts";
import type { CatchAnim } from "../game/components.ts";
import type { Fx } from "../game/fx.ts";
import type { Game } from "../game/game.ts";
import { createView } from "../legacy/view.js";
import type { Projector } from "./projector.ts";

type Obj = Record<string, unknown>;

export interface Renderer extends Projector {
  resize(pixelSize: number): void;
  render(g: Game, dt: number): void;
  critters(): unknown;
}

export function createLegacyRenderer(canvas: HTMLCanvasElement, g: Game): Renderer {
  const view = createView(canvas, PAL, {
    GRASS: Tile.Grass, WATER: Tile.Water, FLOWER: Tile.Flower, TREE: Tile.Tree,
    JUMP_TIME, ATTACK_TIME: THRUST.time, DASH_TIME: 0.1, CAST_TIME: FISHING.castTime, DRAW_TIME: BOW.drawTime,
    NOVA_RADIUS: SPELLS.nova.radius!, STRIKE_RADIUS: SPELLS.strike.radius!,
  });
  g.events.on("reset", ({ map }) => {
    view.setMap(map.tiles);
    const p = g.world.need(g.player, "transform");
    view.snapCamera(p.x, p.y);
  });

  // One stable object per entity, refreshed every frame.
  const objects = new Map<Entity, Obj>();
  const objectFor = (e: Entity) => { let o = objects.get(e); if (!o) objects.set(e, (o = {})); return o; };
  const catchObjects = new WeakMap<CatchAnim, Obj>();
  const centre = (v: { x: number; y: number }) => ({ x: v.x + HALF, y: v.y + HALF });

  const FX_FLAG = { slime: "big", fire: "fire", arcane: "arcane", frost: "frost", spark: "spark" } as const;
  const legacyEffect = (f: Fx): Obj => {
    const at = centre(f);
    switch (f.type) {
      case "hit": return { ...at, t: 0.18 };
      case "burst": return { ...at, t: 0.3, [FX_FLAG[f.palette]]: true };
      case "nova": return { ...at, t: 0.4, nova: true, radius: f.radius };
      case "bolt": return { ...at, t: 0.25, bolt: true };
      case "levelUp": return { ...at, t: 1, levelup: true };
    }
  };

  function snapshot(): Obj {
    const w = g.world, e = g.player;
    const pos = w.need(e, "transform"), motion = w.need(e, "motion"), status = w.need(e, "status");
    const a = w.need(e, "actions"), hero = w.need(e, "hero");
    const c = a.catchAnim;
    let catchObj: Obj | null = null;
    if (c) {
      catchObj = catchObjects.get(c) ?? { ...centre(c), t0: c.t0, rarity: c.rarity };
      catchObjects.set(c, catchObj);
    }
    const player = {
      x: pos.x, y: pos.y, face: motion.face, aim: motion.aim, swingAim: a.swingAim, dash: motion.dash,
      attack: a.attack, swingK: a.swingK, swingRel: a.swingRel, swingSide: a.swingSide,
      draw: a.draw, windup: a.windup && { ...a.windup, ...centre(a.windup) },
      fishing: a.fishing && { ...a.fishing, ...centre(a.fishing) }, catchAnim: catchObj,
      sheep: status.sheep, frozen: status.frozen, chill: status.chill, hurt: status.hurt,
      jump: motion.jump, swimming: motion.swimming, moving: motion.moving, gear: hero.gear,
    };

    const alive = new Set<Entity>();
    const slimes: Obj[] = [], potions: Obj[] = [], loot: Obj[] = [], arrows: Obj[] = [], fireballs: Obj[] = [], strikes: Obj[] = [];
    for (const [id, { renderable: r, transform: t }] of w.query("renderable", "transform")) {
      if (r.kind === "hero") continue;
      alive.add(id);
      const o = objectFor(id);
      if (r.kind === "slime") {
        const s = w.need(id, "slime");
        Object.assign(o, { kind: "slime", x: t.x, y: t.y, hop: s.hop, flash: w.need(id, "enemy").flash });
        slimes.push(o);
      } else if (r.kind === "mage") {
        Object.assign(o, w.need(id, "mage"), { kind: "mage", x: t.x, y: t.y, flash: w.need(id, "enemy").flash });
        slimes.push(o);
      } else if (r.kind === "potion") {
        Object.assign(o, { x: t.x, y: t.y });
        potions.push(o);
      } else if (r.kind === "loot") {
        const pickup = w.need(id, "pickup");
        if (pickup.kind === "loot") loot.push(Object.assign(o, { x: t.x, y: t.y, item: pickup.item }));
      } else if (r.kind === "arrow") {
        const ar = w.need(id, "arrow");
        arrows.push(Object.assign(o, centre(t), { vx: ar.vx, vy: ar.vy, stuck: ar.stuck, power: ar.power }));
      } else if (r.kind === "bolt") {
        fireballs.push(Object.assign(o, centre(t), { kind: w.need(id, "bolt").kind }));
      } else if (r.kind === "strike") {
        const s = w.need(id, "strike");
        strikes.push(Object.assign(o, centre(t), { t: s.t, total: s.total }));
      }
    }
    for (const id of objects.keys()) if (!alive.has(id)) objects.delete(id);

    const effects = g.fx.map(legacyEffect);
    g.fx = [];
    return { player, slimes, potions, loot, arrows, fireballs, strikes, effects, clock: g.clock, shake: g.shake };
  }

  return {
    resize: px => view.resize(px),
    render: (_g, dt) => view.render(snapshot(), dt),
    gameToScreen: (x, y, height) => view.gameToScreen(x, y, height),
    screenToGame(cx, cy) {
      const p = view.screenToGame(cx, cy);
      return p && { x: p.x - HALF, y: p.y - HALF };
    },
    critters: () => view.critters(),
  };
}
