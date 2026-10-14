// The inventory panel: paperdoll slots, stat totals and the bag grid, drawn from the Inventory model.
// Click to pick up and place, drag and drop, right-click to equip, unequip or eat. Holding an item and
// clicking the world drops it. The panel is a window you can drag by its title; it remembers where it was.
import { BASES, SLOTS, SLOT_ICON, type Slot } from "../data/items.ts";
import { BASE_HP } from "../data/player.ts";
import { COLS, ROWS, type GridEntry, type Inventory } from "../items/inventory.ts";
import type { Item } from "../items/items.ts";
import { byId, isHandled, isUiTarget, markHandled } from "./dom.ts";
import type { ItemIcons } from "./sprites.ts";
import { createTooltip } from "./tooltip.ts";

export interface InventoryHooks {
  /** Drop an item in the world (at the hero's feet). */
  onDrop(item: Item): void;
  /** Use food. False if it can't be used right now. */
  onUse(item: Item): boolean;
}

export interface InventoryView {
  /** px = one game pixel on screen; the panel scales in step with the world. */
  setScale(px: number): void;
  toggle(): void;
  close(): void;
  isOpen(): boolean;
  owns(target: EventTarget | null): boolean;
}

// The panel is sized in game pixels: one cell is 12 game pixels and icon art is drawn 1:1 in game
// pixels, like the hearts. ui is the screen size of one game pixel.
const CELL_UNITS = 12, ART_UNITS = 1;
const POSITION_KEY = "simplicity.inventoryPos";

export function createInventoryView(model: Inventory, icons: ItemIcons, hooks: InventoryHooks): InventoryView {
  const panel = byId("inventory"), gridEl = byId("invGrid"), equipEl = byId("invEquip");
  const statsEl = byId("invStats"), heldEl = byId("held");
  const tip = createTooltip();
  let ui = 2, cell = CELL_UNITS * ui;
  let mouse = { x: 0, y: 0 };
  let dragStart: { x: number; y: number } | null = null;

  // Icons at an exact integer scale, centred in their box. Art is 8 px per cell plus a 1 px outline
  // all round, so a w x h icon is (8w+2) x (8h+2) art pixels and always fits inside its 12-unit cells.
  const iconSize = (w: number, h: number) => [(8 * w + 2) * ART_UNITS * ui, (8 * h + 2) * ART_UNITS * ui] as const;
  function iconImg(item: Item): HTMLImageElement {
    const img = new Image();
    img.src = icons[item.type][item.rarity];
    img.alt = item.name;
    img.draggable = false;
    const [iw, ih] = iconSize(item.w, item.h);
    Object.assign(img.style, { width: `${iw}px`, height: `${ih}px`, left: `${(item.w * cell - iw) / 2}px`, top: `${(item.h * cell - ih) / 2}px` });
    return img;
  }
  const box = (el: HTMLElement, x: number, y: number, w: number, h: number) =>
    Object.assign(el.style, { left: `${x * cell}px`, top: `${y * cell}px`, width: `${w * cell}px`, height: `${h * cell}px` });

  function itemEl(item: Item, x: number, y: number): HTMLElement {
    const el = document.createElement("div");
    el.className = `item rarity-${item.rarity}`;
    box(el, x, y, item.w, item.h);
    el.append(iconImg(item));
    el.addEventListener("mouseenter", () => { if (!model.held) tip.show(item, mouse); });
    el.addEventListener("mouseleave", () => tip.hide());
    return el;
  }

  // ---------- Rendering ----------
  const preview = document.createElement("div");
  preview.className = "preview";

  function render(): void {
    gridEl.replaceChildren(preview);
    for (const entry of model.grid) {
      const el = itemEl(entry.item, entry.x, entry.y);
      el.addEventListener("mousedown", ev => onGridItem(ev, entry));
      gridEl.append(el);
    }
    equipEl.replaceChildren();
    for (const [slot, s] of Object.entries(SLOTS) as [Slot, (typeof SLOTS)[Slot]][]) {
      const slotEl = document.createElement("div");
      slotEl.className = "slot";
      slotEl.dataset.slot = slot;
      box(slotEl, s.x, s.y, s.w, s.h);
      const item = model.equip[slot];
      if (item) {
        // Centre items narrower or shorter than the slot (a 1x3 blade in the 2x3 weapon slot).
        slotEl.append(itemEl(item, (s.w - item.w) / 2, (s.h - item.h) / 2));
      } else {                                               // empty slot: faded silhouette of what goes there
        const ghost = new Image(), type = SLOT_ICON[slot];
        ghost.src = icons[type].normal; ghost.alt = s.label; ghost.className = "ghost"; ghost.draggable = false;
        const [gw, gh] = iconSize(BASES[type].w, BASES[type].h);
        Object.assign(ghost.style, { width: `${gw}px`, height: `${gh}px` });
        slotEl.title = s.label;
        slotEl.append(ghost);
      }
      slotEl.addEventListener("mousedown", ev => onSlot(ev, slot));
      equipEl.append(slotEl);
    }
    const st = model.stats();
    statsEl.replaceChildren(...[
      ["Level ", st.level, ""], ["", st.damage, " Damage"], ["", BASE_HP + st.life, " Life"],
      ["", `+${st.speed}%`, " Speed"], ["", `${st.dash}%`, " Dash recovery"],
    ].map(([before, value, after]) => {
      const span = document.createElement("span"), b = document.createElement("b");
      b.textContent = String(value);
      span.append(String(before), b, String(after));
      return span;
    }));
    renderHeld();
  }

  function renderHeld(): void {
    const held = model.held;
    heldEl.replaceChildren();
    heldEl.hidden = !held;
    if (!held) return;
    Object.assign(heldEl.style, { width: `${held.w * cell}px`, height: `${held.h * cell}px` });
    heldEl.className = `item held rarity-${held.rarity}`;
    heldEl.append(iconImg(held));
    moveHeld();
  }

  function moveHeld(): void {
    const held = model.held;
    if (!held) return;
    heldEl.style.left = `${mouse.x - (held.w * cell) / 2}px`;
    heldEl.style.top = `${mouse.y - (held.h * cell) / 2}px`;
    updatePreview();
  }

  /** The cell the held item would land in, or null with the cursor off the grid. */
  function heldTarget(): { x: number; y: number } | null {
    const held = model.held;
    if (!held) return null;
    const r = gridEl.getBoundingClientRect();
    const x = Math.round((mouse.x - r.left) / cell - held.w / 2), y = Math.round((mouse.y - r.top) / cell - held.h / 2);
    const inside = mouse.x >= r.left && mouse.x < r.right && mouse.y >= r.top && mouse.y < r.bottom;
    return inside ? { x: Math.max(0, Math.min(COLS - held.w, x)), y: Math.max(0, Math.min(ROWS - held.h, y)) } : null;
  }

  // Placement preview under the held item: green if it fits, red if it would cover two items.
  function updatePreview(): void {
    const held = model.held, t = heldTarget();
    preview.hidden = !t;
    if (!held || !t) return;
    box(preview, t.x, t.y, held.w, held.h);
    preview.classList.toggle("bad", model.overlapping(t.x, t.y, held.w, held.h).length > 1);
  }

  function placeHeld(): void {
    const t = heldTarget();
    if (t) model.placeHeldAt(t.x, t.y);
  }

  // ---------- Interaction ----------
  function onGridItem(ev: MouseEvent, entry: GridEntry): void {
    ev.stopPropagation(); ev.preventDefault(); markHandled(ev);
    if (model.held) { placeHeld(); return; }
    tip.hide();
    if (ev.button === 2 && !entry.item.slot) model.useFromGrid(entry, hooks.onUse);   // right-click food: eat it
    else if (ev.button === 2) model.equipFromGrid(entry);                             // right-click: equip
    else { model.pickFromGrid(entry); dragStart = { x: ev.clientX, y: ev.clientY }; }
  }

  function onSlot(ev: MouseEvent, slot: Slot): void {
    ev.stopPropagation(); ev.preventDefault(); markHandled(ev);
    tip.hide();
    if (model.held) model.putHeldInSlot(slot);
    else if (model.equip[slot]) {
      if (ev.button === 2) model.unequipToGrid(slot);
      else { model.pickFromSlot(slot); dragStart = { x: ev.clientX, y: ev.clientY }; }
    }
  }

  function dropHeld(): void {
    const item = model.takeHeld();
    if (item) hooks.onDrop(item);
  }

  gridEl.addEventListener("mousedown", ev => {
    if (isHandled(ev)) return;
    ev.preventDefault(); markHandled(ev);
    if (model.held) placeHeld();
  });
  panel.addEventListener("mousedown", ev => markHandled(ev));
  panel.addEventListener("contextmenu", ev => ev.preventDefault());
  // Every click updates the cursor position first, so placement never uses a stale mousemove.
  addEventListener("mousedown", ev => { mouse = { x: ev.clientX, y: ev.clientY }; }, true);
  // Clicking the world while holding an item drops it at the hero's feet.
  addEventListener("mousedown", ev => {
    if (!model.held || isHandled(ev) || isUiTarget(ev.target)) return;
    markHandled(ev);
    dropHeld();
  }, true);
  addEventListener("mousemove", ev => { mouse = { x: ev.clientX, y: ev.clientY }; moveHeld(); tip.place(mouse); });

  // Drag and drop: press on an item, move, and release over a cell, a slot or the world.
  // A press and release without moving stays click-to-pick, click-to-place.
  addEventListener("mouseup", ev => {
    if (!model.held || !dragStart || ev.button !== 0) { dragStart = null; return; }
    const moved = Math.hypot(ev.clientX - dragStart.x, ev.clientY - dragStart.y) >= 5;
    dragStart = null;
    if (!moved) return;
    mouse = { x: ev.clientX, y: ev.clientY };
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    const slotEl = target?.closest<HTMLElement>(".slot");
    if (slotEl) model.putHeldInSlot(slotEl.dataset.slot as Slot);
    else if (target && gridEl.contains(target)) placeHeld();
    else if (!target || !panel.contains(target)) dropHeld();
  });

  // ---------- The window ----------
  const handle = panel.querySelector("h2")!;
  let panelDrag: { dx: number; dy: number } | null = null;
  function placePanel(x: number, y: number): void {
    const w = panel.offsetWidth, h = panel.offsetHeight;
    x = Math.max(0, Math.min(innerWidth - w, x));
    y = Math.max(0, Math.min(innerHeight - h, y));
    Object.assign(panel.style, { left: `${x}px`, top: `${y}px`, right: "auto", transform: "none" });
    try { localStorage.setItem(POSITION_KEY, JSON.stringify([x, y])); } catch { /* storage may be unavailable */ }
  }
  handle.addEventListener("mousedown", ev => {
    if (ev.button !== 0) return;
    const r = panel.getBoundingClientRect();
    panelDrag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
  });
  addEventListener("mousemove", ev => { if (panelDrag) placePanel(ev.clientX - panelDrag.dx, ev.clientY - panelDrag.dy); });
  addEventListener("mouseup", () => { panelDrag = null; });
  function restorePanel(): void {
    try {
      const pos: unknown = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null");
      if (Array.isArray(pos)) placePanel(Number(pos[0]), Number(pos[1]));
    } catch { /* no saved position */ }
  }

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    if (open) { restorePanel(); return; }
    tip.hide();
    const held = model.takeHeld();                           // closing puts the held item back, or drops it
    if (held && !model.add(held)) hooks.onDrop(held);
  }

  model.subscribe(render);
  render();

  return {
    setScale(px) {
      ui = px;
      cell = CELL_UNITS * ui;
      render();
      if (!panel.hidden) restorePanel();
    },
    toggle: () => setOpen(Boolean(panel.hidden)),
    close: () => setOpen(false),
    isOpen: () => !panel.hidden,
    owns: target => target instanceof Node && panel.contains(target),
  };
}
