// HTML overlays pinned to the world: item names over ground loot (coloured by rarity, PoE style),
// and a "!" over the hero's head when a fish bites.
import { blinkVisible } from "../game/despawn.ts";
import type { Game } from "../game/game.ts";
import type { Projector } from "../render/projector.ts";
import { byId } from "./dom.ts";

export function createLabels(g: Game, view: Projector): { draw(): void } {
  const layer = byId("labels"), alert = byId("alert");
  const labels = new Map<number, HTMLElement>();
  const place = (el: HTMLElement, x: number, y: number, height: number) => {
    const s = view.gameToScreen(x, y, height);
    el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
  };

  return {
    draw() {
      const loot = g.world.query("pickup", "transform").flatMap(([e, { pickup, transform }]) =>
        pickup.kind === "loot" ? [{ item: pickup.item, at: transform, despawn: g.world.get(e, "despawn") }] : []);
      const alive = new Set(loot.map(l => l.item.id));
      for (const [id, el] of labels) if (!alive.has(id)) { el.remove(); labels.delete(id); }
      for (const { item, at, despawn } of loot) {
        let el = labels.get(item.id);
        if (!el) {
          el = document.createElement("div");
          el.className = `label rarity-${item.rarity}`;
          el.textContent = item.name;
          layer.append(el);
          labels.set(item.id, el);
        }
        place(el, at.x, at.y, 0.55);
        el.style.visibility = !despawn || blinkVisible(despawn.left) ? "" : "hidden";   // blinks with the item
      }
      const biting = g.world.get(g.player, "actions")?.fishing?.phase === "bite";
      alert.hidden = !biting;
      if (biting) {
        const p = g.world.need(g.player, "transform");
        place(alert, p.x, p.y, 1.7);
      }
    },
  };
}
