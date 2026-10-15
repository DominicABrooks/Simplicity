// The inventory model: a Diablo/PoE-style grid, equipment slots and the item held on the cursor.
// Pure logic, no DOM: the view in ui/inventory calls these actions and re-renders on change.
import { SLOTS, type ItemType, type Rarity, type Slot, type StatKey } from "../data/items.ts";
import type { LevelBonus } from "../data/progression.ts";
import type { Item } from "./items.ts";

export const COLS = 10, ROWS = 5;

export interface GridEntry {
  item: Item;
  x: number;
  y: number;
}

/** What the hero is wearing, by rarity, plus the weapon type (for the 3D model and controls). */
export type Gear = Record<Slot, Rarity | null> & { weaponType: ItemType | null };

export interface InventoryStats {
  level: number;
  damage: number;
  life: number;
  speed: number;
  dash: number;
  gear: Gear;
}

const SLOT_KEYS = Object.keys(SLOTS) as Slot[];

export class Inventory {
  grid: GridEntry[] = [];
  equip: Record<Slot, Item | null> = emptyEquip();
  /** The item on the cursor, if any. */
  held: Item | null = null;
  private readonly listeners: ((stats: InventoryStats) => void)[] = [];

  /** `bonus` supplies the hero's level bonuses, which add to the gear's stat totals. */
  constructor(private readonly bonus: () => LevelBonus) {}

  /** Called after every change with the new stat totals. */
  subscribe(fn: (stats: InventoryStats) => void): void {
    this.listeners.push(fn);
  }

  /** Re-total and notify (also used after a level-up changes the bonus). */
  changed(): void {
    const s = this.stats();
    for (const fn of this.listeners) fn(s);
  }

  // ---------- Grid rules ----------
  overlapping(x: number, y: number, w: number, h: number): GridEntry[] {
    return this.grid.filter(e => x < e.x + e.item.w && e.x < x + w && y < e.y + e.item.h && e.y < y + h);
  }

  inBounds(x: number, y: number, w: number, h: number): boolean {
    return x >= 0 && y >= 0 && x + w <= COLS && y + h <= ROWS;
  }

  /** The first free spot for an item, scanning columns left to right, top to bottom. */
  freeSpot(item: Item): { x: number; y: number } | null {
    for (let x = 0; x <= COLS - item.w; x++)
      for (let y = 0; y <= ROWS - item.h; y++)
        if (!this.overlapping(x, y, item.w, item.h).length) return { x, y };
    return null;
  }

  /** Put an item in the first free spot. False if the bag is full. */
  add(item: Item): boolean {
    const s = this.freeSpot(item);
    if (!s) return false;
    this.grid.push({ item, ...s });
    this.changed();
    return true;
  }

  stats(): InventoryStats {
    const t: Record<StatKey, number> = { damage: 0, life: 0, speed: 0, dash: 0 };
    for (const item of Object.values(this.equip)) {
      if (!item) continue;
      for (const src of [item.base, item.mods])
        for (const [k, v] of Object.entries(src) as [StatKey, number][]) t[k] += v;
    }
    const gear = Object.fromEntries(SLOT_KEYS.map(k => [k, this.equip[k]?.rarity ?? null])) as Gear;
    gear.weaponType = this.equip.weapon?.type ?? null;
    const b = this.bonus();
    return { level: b.level, damage: Math.max(1, t.damage) + b.damage, life: t.life + b.life, speed: t.speed + b.speed, dash: Math.min(60, t.dash), gear };
  }

  // ---------- Actions ----------
  /** Pick an item up from the grid onto the cursor. */
  pickFromGrid(entry: GridEntry): void {
    this.grid = this.grid.filter(e => e !== entry);
    this.held = entry.item;
    this.changed();
  }

  /** Pick an equipped item up onto the cursor. */
  pickFromSlot(slot: Slot): void {
    if (!this.equip[slot]) return;
    this.held = this.equip[slot];
    this.equip[slot] = null;
    this.changed();
  }

  /** Place the held item at (x, y). Lands on at most one other item, which is picked up in a swap. */
  placeHeldAt(x: number, y: number): boolean {
    const held = this.held;
    if (!held || !this.inBounds(x, y, held.w, held.h)) return false;
    const hits = this.overlapping(x, y, held.w, held.h);
    if (hits.length > 1) return false;
    this.grid = this.grid.filter(e => e !== hits[0]);
    this.grid.push({ item: held, x, y });
    this.held = hits[0]?.item ?? null;
    this.changed();
    return true;
  }

  /** Equip the held item in a slot (if it fits there), picking up whatever was in it. */
  putHeldInSlot(slot: Slot): void {
    if (!this.held || this.held.slot !== slot) return;
    const old = this.equip[slot];
    this.equip[slot] = this.held;
    this.held = old ?? null;
    this.changed();
  }

  /** Right-click equip: the replaced item goes where this one was, or the first free spot. */
  equipFromGrid(entry: GridEntry): void {
    const slot = entry.item.slot;
    if (!slot) return;
    this.grid = this.grid.filter(e => e !== entry);
    const old = this.equip[slot];
    this.equip[slot] = entry.item;
    if (old) {
      if (this.inBounds(entry.x, entry.y, old.w, old.h) && !this.overlapping(entry.x, entry.y, old.w, old.h).length) {
        this.grid.push({ item: old, x: entry.x, y: entry.y });
      } else {
        const spot = this.freeSpot(old);
        if (!spot) { this.equip[slot] = old; this.grid.push(entry); this.changed(); return; }   // nowhere to put it: undo
        this.grid.push({ item: old, ...spot });
      }
    }
    this.changed();
  }

  /** Right-click an equipped item: back into the bag, if there's room. */
  unequipToGrid(slot: Slot): boolean {
    const item = this.equip[slot];
    if (!item || !this.freeSpot(item)) return false;
    this.equip[slot] = null;
    return this.add(item);
  }

  /** Right-click food: eat it if `use` accepts it. */
  useFromGrid(entry: GridEntry, use: (item: Item) => boolean): void {
    if (!use(entry.item)) return;
    this.grid = this.grid.filter(e => e !== entry);
    this.changed();
  }

  /** Take the held item off the cursor (to drop it in the world). */
  takeHeld(): Item | null {
    const item = this.held;
    this.held = null;
    if (item) this.changed();
    return item;
  }

  /** Empty the bag and equip a set of items. */
  reset(equipped: Item[]): void {
    this.grid = [];
    this.held = null;
    this.equip = emptyEquip();
    for (const item of equipped) if (item.slot) this.equip[item.slot] = item;
    this.changed();
  }
}

function emptyEquip(): Record<Slot, Item | null> {
  return Object.fromEntries(SLOT_KEYS.map(k => [k, null])) as Record<Slot, Item | null>;
}
