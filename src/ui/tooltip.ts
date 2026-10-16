// Item tooltips, PoE style: name in the rarity colour, base type, slot, stats and affixes.
import { AFFIXES, BASES, BASE_TEXT, CURIOS, SLOTS, type StatKey } from "../data/items.ts";
import type { Item } from "../items/items.ts";
import { byId } from "./dom.ts";

export interface Tooltip {
  show(item: Item, mouse: { x: number; y: number }): void;
  /** Keep it beside the cursor. */
  place(mouse: { x: number; y: number }): void;
  hide(): void;
}

export function createTooltip(): Tooltip {
  const tip = byId("tooltip");
  const line = (cls: string, text: string) => {
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = text;
    return div;
  };

  function place(mouse: { x: number; y: number }): void {
    if (tip.hidden) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, mouse.x - w - 16))}px`;
    tip.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, mouse.y - h / 2))}px`;
  }

  return {
    show(item, mouse) {
      const lines = [line(`tip-name rarity-${item.rarity}`, item.name)], curio = item.curio ? CURIOS[item.curio] : null;
      if (item.rarity !== "normal" && !curio) lines.push(line("tip-base", BASES[item.type].name));
      lines.push(line("tip-slot", item.slot ? SLOTS[item.slot].label : item.heal ? "Food" : curio ? "Curiosity" : "Keepsake"));
      if (item.heal) lines.push(line("tip-stat", `Restores ${item.heal} Life`), line("tip-note", "Right-click to eat"));
      const note = curio ? curio.note : item.note ?? BASES[item.type].note;
      if (note) lines.push(line("tip-note", note));
      if (item.curio === "bottle") lines.push(line("tip-note", "Right-click to open it"));
      for (const [k, v] of Object.entries(item.base) as [StatKey, number][]) {
        const text = BASE_TEXT[k];
        if (text) lines.push(line("tip-stat", text(v)));
      }
      for (const [k, v] of Object.entries(item.mods) as [StatKey, number][]) lines.push(line("tip-mod", AFFIXES[k].text(v)));
      tip.replaceChildren(...lines);
      tip.hidden = false;
      place(mouse);
    },
    place,
    hide() {
      tip.hidden = true;
    },
  };
}
