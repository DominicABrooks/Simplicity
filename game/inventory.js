// Simplicity inventory: Diablo/PoE-style grid, equipment slots and random loot.
// Items live entirely here; the game asks for stat totals and hands over picked-up loot.

export const COLS = 10, ROWS = 5, CELL = 32;

// Base item types. w/h are inventory cells; icons come from art/items.
const BASES = {
  blade:  { name: "Blade",  slot: "weapon", w: 1, h: 3, base: { damage: 1 } },
  hood:   { name: "Hood",   slot: "helm",   w: 2, h: 2, base: { life: 1 } },
  robe:   { name: "Robe",   slot: "armor",  w: 2, h: 3, base: { life: 2 } },
  boots:  { name: "Boots",  slot: "boots",  w: 2, h: 2, base: { speed: 5 } },
  ring:   { name: "Ring",   slot: "ring",   w: 1, h: 1, base: {} },
  amulet: { name: "Amulet", slot: "amulet", w: 1, h: 1, base: {} },
  bow:    { name: "Bow",    slot: "weapon", w: 2, h: 3, base: { damage: 1 }, note: "Hold to draw, release to shoot. Full draw: +1 damage" },
  // Not in the random loot table: the pole is a starter item and fish come from fishing.
  rod:    { name: "Fishing Pole", slot: "weapon", w: 1, h: 3, base: {}, noLoot: true, note: "Aim at water and click to cast" },
  fish:   { name: "Koi", slot: null, w: 2, h: 1, base: {}, noLoot: true },
};

// Catches: rarity decides the koi and how much eating it heals.
const FISH = { normal: { name: "Pond Koi", heal: 1 }, magic: { name: "Silver Koi", heal: 2 }, rare: { name: "Golden Koi", heal: 4 } };
export function makeFish(rarity) {
  const item = makeItem("fish", rarity, {}, FISH[rarity].name);
  item.heal = FISH[rarity].heal;
  return item;
}

// Equipment paperdoll: slot positions in cells inside a 10x7 area.
export const SLOTS = {
  helm:   { label: "Helm",   x: 4, y: 0, w: 2, h: 2 },
  amulet: { label: "Amulet", x: 6, y: 1, w: 1, h: 1 },
  weapon: { label: "Weapon", x: 2, y: 2, w: 1, h: 3 },
  armor:  { label: "Armor",  x: 4, y: 2, w: 2, h: 3 },
  ring:   { label: "Ring",   x: 7, y: 3, w: 1, h: 1 },
  boots:  { label: "Boots",  x: 4, y: 5, w: 2, h: 2 },
};

const SLOT_ICON = { weapon: "blade", helm: "hood", armor: "robe", boots: "boots", ring: "ring", amulet: "amulet" };

// Stats an item can roll. Prefixes and suffixes name magic items.
const AFFIXES = {
  damage: { min: 1, max: 1, prefix: "Keen", text: v => `+${v} Damage`, slots: ["weapon", "ring", "amulet"] },
  life:   { min: 1, max: 2, prefix: "Sturdy", text: v => `+${v} Life`, slots: ["helm", "armor", "boots", "ring", "amulet"] },
  speed:  { min: 4, max: 10, suffix: "of Haste", text: v => `+${v}% Movement Speed`, slots: ["boots", "ring", "amulet", "armor"] },
  dash:   { min: 10, max: 20, suffix: "of the Wind", text: v => `${v}% Faster Dash Recovery`, slots: ["boots", "armor", "amulet", "helm"] },
};
const RARE_A = ["Gloom", "Ember", "Hollow", "Storm", "Grim", "Moss", "Dusk", "Rune"];
const RARE_B = ["Shroud", "Fang", "Ward", "Whisper", "Veil", "Bite", "Song", "Mark"];
const BASE_TEXT = { damage: v => `${v} Damage`, life: v => `+${v} Life`, speed: v => `+${v}% Movement Speed` };

let nextId = 1;
export function makeItem(type, rarity = "normal", mods = {}, name) {
  const b = BASES[type];
  return { id: nextId++, type, rarity, name: name || b.name, slot: b.slot, w: b.w, h: b.h, base: { ...b.base }, mods };
}

export function rollItem(rand) {
  const types = Object.keys(BASES).filter(t => !BASES[t].noLoot);
  const type = types[Math.floor(rand() * types.length)];
  const slot = BASES[type].slot;
  const r = rand();
  const rarity = r < 0.12 ? "rare" : r < 0.45 ? "magic" : "normal";
  const pool = Object.keys(AFFIXES).filter(k => AFFIXES[k].slots.includes(slot));
  const count = rarity === "rare" ? Math.min(3, pool.length) : rarity === "magic" ? 1 + Math.floor(rand() * 2) : 0;
  const mods = {};
  const picks = [...pool];
  for (let i = 0; i < count && picks.length; i++) {
    const k = picks.splice(Math.floor(rand() * picks.length), 1)[0];
    const a = AFFIXES[k];
    mods[k] = a.min + Math.floor(rand() * (a.max - a.min + 1));
  }
  let name = BASES[type].name;
  if (rarity === "magic") {
    const pre = Object.keys(mods).find(k => AFFIXES[k].prefix), suf = Object.keys(mods).find(k => AFFIXES[k].suffix);
    name = [pre && AFFIXES[pre].prefix, name, suf && AFFIXES[suf].suffix].filter(Boolean).join(" ");
  } else if (rarity === "rare") {
    name = `${RARE_A[Math.floor(rand() * RARE_A.length)]} ${RARE_B[Math.floor(rand() * RARE_B.length)]}`;
  }
  return makeItem(type, rarity, mods, name);
}

export function createInventory({ icons, onChange, onDrop, onUse }) {
  const panel = document.getElementById("inventory");
  const gridEl = document.getElementById("invGrid"), equipEl = document.getElementById("invEquip");
  const statsEl = document.getElementById("invStats"), tip = document.getElementById("tooltip"), heldEl = document.getElementById("held");
  let grid = [], equip = {}, held = null, mouse = { x: 0, y: 0 };

  // ---------- Grid logic ----------
  const overlapping = (x, y, w, h, list = grid) =>
    list.filter(e => x < e.x + e.item.w && e.x < x + w && y < e.y + e.item.h && e.y < y + h);
  const inBounds = (x, y, w, h) => x >= 0 && y >= 0 && x + w <= COLS && y + h <= ROWS;
  function freeSpot(item) {
    for (let x = 0; x <= COLS - item.w; x++)
      for (let y = 0; y <= ROWS - item.h; y++)
        if (!overlapping(x, y, item.w, item.h).length) return { x, y };
    return null;
  }
  function add(item) {
    const s = freeSpot(item);
    if (!s) return false;
    grid.push({ item, ...s });
    changed();
    return true;
  }

  function stats() {
    const t = { damage: 0, life: 0, speed: 0, dash: 0 };
    for (const item of Object.values(equip)) {
      if (!item) continue;
      for (const src of [item.base, item.mods]) for (const k in src) t[k] += src[k];
    }
    const gear = Object.fromEntries(Object.keys(SLOTS).map(k => [k, equip[k] ? equip[k].rarity : null]));
    gear.weaponType = equip.weapon ? equip.weapon.type : null;
    return { damage: Math.max(1, t.damage), life: t.life, speed: t.speed, dash: Math.min(60, t.dash), gear };
  }

  function changed() { render(); onChange(stats()); }

  // ---------- Rendering ----------
  const rarityClass = item => `rarity-${item.rarity}`;
  function itemEl(item, x, y) {
    const el = document.createElement("div");
    el.className = `item ${rarityClass(item)}`;
    Object.assign(el.style, { left: `${x * CELL}px`, top: `${y * CELL}px`, width: `${item.w * CELL}px`, height: `${item.h * CELL}px` });
    const img = new Image(); img.src = icons[item.type][item.rarity]; img.alt = item.name; img.draggable = false;
    el.append(img);
    el.addEventListener("mouseenter", () => showTip(item));
    el.addEventListener("mouseleave", hideTip);
    return el;
  }

  function render() {
    gridEl.querySelectorAll(".item").forEach(e => e.remove());
    for (const e of grid) {
      const el = itemEl(e.item, e.x, e.y);
      el.addEventListener("mousedown", ev => onGridItem(ev, e));
      gridEl.append(el);
    }
    equipEl.innerHTML = "";
    for (const [slot, s] of Object.entries(SLOTS)) {
      const box = document.createElement("div");
      box.className = "slot";
      Object.assign(box.style, { left: `${s.x * CELL}px`, top: `${s.y * CELL}px`, width: `${s.w * CELL}px`, height: `${s.h * CELL}px` });
      if (equip[slot]) {
        const el = itemEl(equip[slot], 0, 0);
        box.append(el);
      } else {                                              // empty slot: faded silhouette of what goes there
        const ghost = new Image(); ghost.src = icons[SLOT_ICON[slot]].normal; ghost.alt = s.label; ghost.className = "ghost"; ghost.draggable = false;
        box.title = s.label;
        box.append(ghost);
      }
      box.addEventListener("mousedown", ev => onSlot(ev, slot));
      equipEl.append(box);
    }
    const st = stats();
    statsEl.innerHTML = [
      `<b>${st.damage}</b> Damage`, `<b>${5 + st.life}</b> Life`,
      `<b>+${st.speed}%</b> Speed`, `<b>${st.dash}%</b> Dash recovery`,
    ].map(s => `<span>${s}</span>`).join("");
    renderHeld();
  }

  function renderHeld() {
    heldEl.innerHTML = "";
    heldEl.hidden = !held;
    if (!held) return;
    const img = new Image(); img.src = icons[held.type][held.rarity]; img.draggable = false;
    Object.assign(heldEl.style, { width: `${held.w * CELL}px`, height: `${held.h * CELL}px` });
    heldEl.className = `item held ${rarityClass(held)}`;
    heldEl.append(img);
    moveHeld();
  }
  function moveHeld() {
    if (!held) return;
    heldEl.style.left = `${mouse.x - (held.w * CELL) / 2}px`;
    heldEl.style.top = `${mouse.y - (held.h * CELL) / 2}px`;
    updatePreview();
  }

  // Placement preview under the held item.
  const preview = document.createElement("div");
  preview.className = "preview";
  gridEl.append(preview);
  function heldTarget() {
    const r = gridEl.getBoundingClientRect();
    const x = Math.round((mouse.x - r.left) / CELL - held.w / 2), y = Math.round((mouse.y - r.top) / CELL - held.h / 2);
    const inside = mouse.x >= r.left && mouse.x < r.right && mouse.y >= r.top && mouse.y < r.bottom;
    return inside ? { x: Math.max(0, Math.min(COLS - held.w, x)), y: Math.max(0, Math.min(ROWS - held.h, y)) } : null;
  }
  function updatePreview() {
    const t = held && heldTarget();
    preview.hidden = !t;
    if (!t) return;
    const ok = overlapping(t.x, t.y, held.w, held.h).length <= 1;
    Object.assign(preview.style, { left: `${t.x * CELL}px`, top: `${t.y * CELL}px`, width: `${held.w * CELL}px`, height: `${held.h * CELL}px` });
    preview.classList.toggle("bad", !ok);
  }

  // ---------- Tooltip ----------
  function showTip(item) {
    if (held) return;
    const lines = [`<div class="tip-name ${rarityClass(item)}">${item.name}</div>`];
    if (item.rarity !== "normal") lines.push(`<div class="tip-base">${BASES[item.type].name}</div>`);
    lines.push(`<div class="tip-slot">${item.slot ? SLOTS[item.slot].label : "Food"}</div>`);
    if (item.heal) lines.push(`<div class="tip-stat">Restores ${item.heal} Life</div><div class="tip-note">Right-click to eat</div>`);
    if (BASES[item.type].note) lines.push(`<div class="tip-note">${BASES[item.type].note}</div>`);
    for (const k in item.base) lines.push(`<div class="tip-stat">${BASE_TEXT[k](item.base[k])}</div>`);
    for (const k in item.mods) lines.push(`<div class="tip-mod">${AFFIXES[k].text(item.mods[k])}</div>`);
    tip.innerHTML = lines.join("");
    tip.hidden = false;
    placeTip();
  }
  function placeTip() {
    if (tip.hidden) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, mouse.x - w - 16))}px`;
    tip.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, mouse.y - h / 2))}px`;
  }
  function hideTip() { tip.hidden = true; }

  // ---------- Interaction ----------
  function onGridItem(ev, entry) {
    ev.stopPropagation(); ev.preventDefault(); ev.simplicityHandled = true;
    if (held) return placeHeld(ev);
    if (ev.button === 2 && !entry.item.slot) {             // right-click food: eat it
      if (onUse(entry.item)) { grid = grid.filter(e => e !== entry); hideTip(); changed(); }
      return;
    }
    if (ev.button === 2) {                                  // right-click: equip
      grid = grid.filter(e => e !== entry);
      const old = equip[entry.item.slot];
      equip[entry.item.slot] = entry.item;
      if (old) {
        if (inBounds(entry.x, entry.y, old.w, old.h) && !overlapping(entry.x, entry.y, old.w, old.h).length) grid.push({ item: old, x: entry.x, y: entry.y });
        else if (!freeSpot(old)) { equip[entry.item.slot] = old; grid.push(entry); return changed(); }
        else grid.push({ item: old, ...freeSpot(old) });
      }
    } else {
      grid = grid.filter(e => e !== entry);
      held = entry.item;
    }
    hideTip(); changed();
  }

  function onSlot(ev, slot) {
    ev.stopPropagation(); ev.preventDefault(); ev.simplicityHandled = true;
    if (held) {
      if (held.slot !== slot) return;
      const old = equip[slot];
      equip[slot] = held;
      held = old || null;
    } else if (equip[slot]) {
      if (ev.button === 2) { if (add(equip[slot])) { equip[slot] = null; } }
      else { held = equip[slot]; equip[slot] = null; }
    }
    hideTip(); changed();
  }

  function placeHeld(ev) {
    const t = heldTarget();
    if (!t) return;
    const hits = overlapping(t.x, t.y, held.w, held.h);
    if (hits.length > 1) return;
    grid = grid.filter(e => e !== hits[0]);
    grid.push({ item: held, ...t });
    held = hits[0] ? hits[0].item : null;
    changed();
  }

  gridEl.addEventListener("mousedown", ev => {
    if (ev.simplicityHandled) return;
    ev.preventDefault(); ev.simplicityHandled = true;
    if (held) placeHeld(ev);
  });
  panel.addEventListener("mousedown", ev => { ev.simplicityHandled = true; });
  panel.addEventListener("contextmenu", ev => ev.preventDefault());
  // Every click updates the cursor position first, so placement never uses a stale mousemove.
  addEventListener("mousedown", ev => { mouse = { x: ev.clientX, y: ev.clientY }; }, true);
  // Clicking the world while holding an item drops it at the hero's feet.
  addEventListener("mousedown", ev => {
    if (!held || ev.simplicityHandled || panel.contains(ev.target)) return;
    ev.simplicityHandled = true;
    onDrop(held); held = null; changed();
  }, true);
  addEventListener("mousemove", ev => { mouse = { x: ev.clientX, y: ev.clientY }; moveHeld(); placeTip(); });

  function setOpen(open) {
    panel.hidden = !open;
    if (!open) {
      hideTip();
      if (held) { if (!add(held)) onDrop(held); held = null; changed(); }
    }
  }

  function reset(startItems) {
    grid = []; held = null;
    equip = Object.fromEntries(Object.keys(SLOTS).map(k => [k, null]));
    for (const item of startItems) equip[item.slot] = item;
    setOpen(false);
    changed();
  }

  return {
    add, reset, stats,
    toggle: () => setOpen(panel.hidden),
    close: () => setOpen(false),
    isOpen: () => !panel.hidden,
    owns: target => panel.contains(target),
  };
}
