import { createView } from "./view.js";
import { createInventory, makeItem, rollItem } from "./inventory.js";
// Simplicity: a tiny top-down fantasy RPG. All art comes from sprites.js (built from art/).

const T = 8;                    // tile and sprite cell size, in game pixels
const MAP_W = 48, MAP_H = 32;
const GRASS = 0, FLOWER = 1, WATER = 2, TREE = 3;
const MAX_HP = 5;

// ---------- Sprite baking ----------
// Each frame is baked once into a canvas (and a mirrored copy) with the 1px ink outline from ART_STYLE.md.
const PAL = SPRITES.palette;
const NO_OUTLINE = new Set(SPRITES.noOutline);
const INK = PAL.K;

function bake(rows, outline, flip) {
  const h = rows.length, w = rows[0].length, pad = outline ? 1 : 0;
  const c = document.createElement("canvas");
  c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext("2d");
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const solid = (x, y) => inside(x, y) && rows[y][x] !== "." && !NO_OUTLINE.has(rows[y][x]);
  for (let y = -pad; y < h + pad; y++) {
    for (let x = -pad; x < w + pad; x++) {
      const ch = inside(x, y) ? rows[y][x] : ".";
      const dx = (flip ? w - 1 - x : x) + pad;
      if (ch !== ".") { g.fillStyle = PAL[ch]; g.fillRect(dx, y + pad, 1, 1); }
      else if (outline && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) {
        g.fillStyle = INK; g.fillRect(dx, y + pad, 1, 1);
      }
    }
  }
  return c;
}

const ART = {};
for (const [name, spr] of Object.entries(SPRITES.sprites)) {
  const outline = spr.kind !== "tile";
  ART[name] = {};
  for (const [anim, a] of Object.entries(spr.anims)) {
    ART[name][anim] = {
      ms: a.ms,
      pad: outline ? 1 : 0,
      frames: a.frames.map(rows => ({ w: rows[0].length, r: bake(rows, outline, false), l: bake(rows, outline, true) })),
    };
  }
}

// Item icons for the inventory: outlined pixel art as data URLs.
const ICONS = Object.fromEntries(["blade", "hood", "robe", "boots", "ring", "amulet"].map(t => [t, ART[t].idle.frames[0].r.toDataURL()]));

// ---------- Seeded randomness ----------
let seed = 7;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));

// ---------- World ----------
let map;
const SPAWN = { x: 8 * T, y: 8 * T };

function makeMap() {
  seed = 7;
  map = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) row.push(rand() < 0.06 ? FLOWER : GRASS);
    map.push(row);
  }
  const ellipse = (cx, cy, rx, ry) => {
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) map[y][x] = WATER;
  };
  ellipse(32, 19, 7, 5);
  ellipse(13, 24, 4, 3);
  for (let y = 0; y <= 15; y++) {                 // river from the lake to the north edge
    const cx = 31 + Math.round(2 * Math.sin(y / 3));
    map[y][cx] = map[y][cx + 1] = WATER;
  }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const edge = x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1;
    const nearSpawn = Math.hypot(x - SPAWN.x / T, y - SPAWN.y / T) < 5;
    if (edge && map[y][x] !== WATER) map[y][x] = TREE;
    else if (!nearSpawn && map[y][x] !== WATER && rand() < 0.08) map[y][x] = TREE;
  }
  for (let x = 0; x < MAP_W; x++) map[0][x] = map[MAP_H - 1][x] = TREE;   // seal the river mouth
}

const tileAt = (px, py) => {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? TREE : map[ty][tx];
};

// Feet-level collision box: x+1..x+7, y+4..y+8 inside the 8x8 cell.
function blocked(x, y, blocksWater) {
  for (const [px, py] of [[x + 1, y + 4], [x + 6.99, y + 4], [x + 1, y + 7.99], [x + 6.99, y + 7.99]]) {
    const t = tileAt(px, py);
    if (t === TREE || (blocksWater && t === WATER)) return true;
  }
  return false;
}

function moveBy(e, dx, dy, blocksWater) {
  if (dx && !blocked(e.x + dx, e.y, blocksWater)) e.x += dx;
  if (dy && !blocked(e.x, e.y + dy, blocksWater)) e.y += dy;
}

const overlap = (a, b) => Math.abs(a.x - b.x) < 6 && Math.abs(a.y - b.y) < 6;

function randomGrassSpot(minDist) {
  for (let i = 0; i < 200; i++) {
    const x = rint(1, MAP_W - 2) * T, y = rint(1, MAP_H - 2) * T;
    const t = map[y / T][x / T];
    if ((t === GRASS || t === FLOWER) && Math.hypot(x - player.x, y - player.y) >= minDist) return { x, y };
  }
  return null;
}

// ---------- State ----------
let player, slimes, potions, loot, effects, kills, state, clock, spawnTimer;

// ---------- Inventory ----------
const inv = createInventory({
  icons: ICONS,
  onChange: applyStats,
  onDrop: item => loot.push({ x: player.x, y: player.y, item, ignore: true }),
});
// Equipment totals feed straight into gameplay numbers.
function applyStats(st) {
  if (!player) return;
  player.damage = st.damage;
  player.maxHp = MAX_HP + st.life;
  player.hp = Math.min(player.hp, player.maxHp);
  player.speedMul = 1 + st.speed / 100;
  player.dashMul = 1 - st.dash / 100;
  player.gear = st.gear;
}

function reset() {
  makeMap();
  view.setMap(map);
  seed = Date.now() % 100000 + 1;
  player = { x: SPAWN.x, y: SPAWN.y, face: 1, aim: 0, swingAim: 0, dash: 0, dashX: 0, dashY: 0, dashCooldown: 0, hp: MAX_HP, hurt: 0, jump: 0, attack: 0, cooldown: 0, hit: false, moving: false, swimming: false, vx: 0, vy: 0 };
  slimes = []; potions = []; loot = []; effects = [];
  // Start naked, with a plain starter set in the bag to put on.
  inv.reset([]);
  for (const [type, name] of [["blade", "Rusty Blade"], ["hood", "Worn Hood"], ["robe", "Worn Robe"], ["boots", "Worn Boots"]]) inv.add(makeItem(type, "normal", {}, name));
  kills = 0; clock = 0; spawnTimer = 0;
  for (let i = 0; i < 8; i++) spawnSlime(80);
  for (let i = 0; i < 5; i++) { const p = randomGrassSpot(40); if (p) potions.push(p); }
  view.snapCamera(player.x, player.y);
}

function spawnSlime(minDist) {
  const p = randomGrassSpot(minDist);
  if (p) slimes.push({ x: p.x, y: p.y, hp: 3, timer: 0.5 + rand(), hop: 0, dx: 0, dy: 0, face: 1, flash: 0, vx: 0, vy: 0 });
}

// ---------- Input ----------
const keys = new Set();
let attackPressed = false, jumpPressed = false, dashRequest = null;
// Double-tap dash: WASD and arrows map to the same four directions.
const DIRS = { a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0], w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1] };
const DOUBLE_TAP = 0.25;
let lastTap = { dir: null, time: -1 };
addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
  if (state !== "play") {
    if (state === "title" || (state === "dead" && k === "r")) { reset(); setState("play"); }
    return;
  }
  if (k === "i" || k === "tab") { e.preventDefault(); if (!e.repeat) inv.toggle(); return; }
  if (k === "escape") { inv.close(); return; }
  if (!e.repeat) {
    if (k === "j" || k === "enter") attackPressed = true;
    if (k === " ") jumpPressed = true;
    if (DIRS[k]) {
      const dir = DIRS[k].join(), now = performance.now() / 1000;
      if (lastTap.dir === dir && now - lastTap.time < DOUBLE_TAP) { dashRequest = DIRS[k]; lastTap = { dir: null, time: -1 }; }
      else lastTap = { dir, time: now };
    }
  }
  keys.add(k);
});
addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
addEventListener("mousedown", e => {
  if (state !== "play" || e.button !== 0 || e.simplicityHandled || inv.owns(e.target)) return;
  attackPressed = true;
});
// Aiming: the cursor sets the aim once the mouse has moved; until then the aim follows movement.
let mouse = null;
addEventListener("mousemove", e => { mouse = { x: e.clientX, y: e.clientY }; });
addEventListener("mouseleave", () => { mouse = null; });
addEventListener("blur", () => keys.clear());

const overlay = document.getElementById("overlay"), message = document.getElementById("message"), hud = document.getElementById("hud");
function setState(s) {
  state = s;
  overlay.hidden = s === "play";
  if (s === "dead") inv.close();
  if (s === "dead") message.textContent = `You fell after defeating ${kills} slime${kills === 1 ? "" : "s"}. Press R to rise again.`;
}

// ---------- Update ----------
const PLAYER_SPEED = 42, SWIM_SPEED = 24, JUMP_TIME = 0.45, ATTACK_TIME = 0.3;
const DASH_TIME = 0.18, DASH_SPEED = 160, DASH_COOLDOWN = 0.6;   // ~29px, about 3.5 tiles

function updatePlayer(dt) {
  const p = player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.swimming = p.jump <= 0 && tileAt(p.x + 4, p.y + 6) === WATER;

  let ix = 0, iy = 0;
  if (keys.has("a") || keys.has("arrowleft")) ix--;
  if (keys.has("d") || keys.has("arrowright")) ix++;
  if (keys.has("w") || keys.has("arrowup")) iy--;
  if (keys.has("s") || keys.has("arrowdown")) iy++;
  const aimAt = mouse && view.screenToGame(mouse.x, mouse.y);
  if (aimAt) p.aim = Math.atan2(aimAt.y - (p.y + 4), aimAt.x - (p.x + 4));
  else if (ix || iy) p.aim = Math.atan2(iy, ix);
  p.face = Math.cos(p.attack > 0 ? p.swingAim : p.aim) >= 0 ? 1 : -1;
  const len = Math.hypot(ix, iy) || 1;
  const speed = (p.swimming ? SWIM_SPEED : PLAYER_SPEED) * (p.attack > 0 ? 0.35 : 1) * p.speedMul;
  p.moving = ix !== 0 || iy !== 0;
  if (dashRequest && p.dash <= 0 && p.dashCooldown <= 0 && !p.swimming && p.jump <= 0 && p.attack <= 0) {
    p.dash = DASH_TIME; p.dashCooldown = DASH_COOLDOWN * p.dashMul; [p.dashX, p.dashY] = dashRequest;
  }
  if (p.dash > 0) {                                        // dashing overrides walking; trees stop it, water ends it
    p.dash = Math.max(0, p.dash - dt);
    moveBy(p, p.dashX * DASH_SPEED * dt, p.dashY * DASH_SPEED * dt, false);
    if (tileAt(p.x + 4, p.y + 6) === WATER) p.dash = 0;
  } else {
    moveBy(p, (ix / len) * speed * dt + p.vx * dt, (iy / len) * speed * dt + p.vy * dt, false);
  }
  p.vx *= Math.pow(0.001, dt); p.vy *= Math.pow(0.001, dt);

  if (jumpPressed && p.jump <= 0 && !p.swimming && p.attack <= 0) p.jump = JUMP_TIME;
  if (p.jump > 0) p.jump = Math.max(0, p.jump - dt);

  if (attackPressed && p.cooldown <= 0 && !p.swimming) { p.attack = ATTACK_TIME; p.cooldown = 0.38; p.hit = false; p.swingAim = p.aim; }
  if (p.attack > 0) {
    p.attack = Math.max(0, p.attack - dt);
    if (!p.hit && p.attack < ATTACK_TIME * 0.66) {          // thrust frame: same reach as before (1..20px ahead, 7px either side), along the aim
      p.hit = true;
      const ax = Math.cos(p.swingAim), ay = Math.sin(p.swingAim);
      for (const s of slimes) {
        const dx = s.x - p.x, dy = s.y - p.y;
        const along = dx * ax + dy * ay, across = Math.abs(dx * ay - dy * ax);
        if (along > 1 && along < 20 && across < 7) {
          s.hp -= p.damage; s.flash = 0.15; s.vx = ax * 90; s.vy = ay * 90; s.timer = 0.6;
          effects.push({ x: s.x + 4, y: s.y + 4, t: 0.18 });
        }
      }
    }
  }
  attackPressed = jumpPressed = false; dashRequest = null;

  for (let i = potions.length - 1; i >= 0; i--) {
    if (overlap(p, potions[i]) && p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + 2); potions.splice(i, 1); }
  }
  // Walk over loot to pick it up. Dropped items wait until you step off them.
  for (let i = loot.length - 1; i >= 0; i--) {
    const l = loot[i];
    if (!overlap(p, l)) { l.ignore = false; continue; }
    if (l.ignore) continue;
    if (inv.add(l.item)) loot.splice(i, 1);
    else { l.ignore = true; toast("Inventory full"); }
  }
}

function updateSlimes(dt) {
  const p = player;
  for (const s of slimes) {
    s.flash = Math.max(0, s.flash - dt);
    moveBy(s, s.vx * dt, s.vy * dt, true);
    s.vx *= Math.pow(0.002, dt); s.vy *= Math.pow(0.002, dt);
    if (s.hop > 0) {
      s.hop = Math.max(0, s.hop - dt);
      moveBy(s, s.dx * 46 * dt, s.dy * 46 * dt, true);
    } else if ((s.timer -= dt) <= 0) {
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
      if (d < 72 && !p.swimming) { s.dx = dx / d; s.dy = dy / d; }
      else { const a = rand() * Math.PI * 2; s.dx = Math.cos(a); s.dy = Math.sin(a); }
      if (s.dx) s.face = Math.sign(s.dx);
      s.hop = 0.3; s.timer = 0.7 + rand() * 0.7;
    }
    if (p.hurt <= 0 && p.jump <= 0 && p.dash <= 0 && overlap(p, s)) {
      p.hp--; p.hurt = 1;
      const d = Math.hypot(p.x - s.x, p.y - s.y) || 1;
      p.vx = (p.x - s.x) / d * 110; p.vy = (p.y - s.y) / d * 110;
      if (p.hp <= 0) setState("dead");
    }
  }
  for (let i = slimes.length - 1; i >= 0; i--) {
    const s = slimes[i];
    if (s.hp <= 0) {
      kills++;
      effects.push({ x: s.x + 4, y: s.y + 4, t: 0.3, big: true });
      if (rand() < 0.3) potions.push({ x: s.x, y: s.y });
      if (rand() < 0.4) loot.push({ x: s.x, y: s.y, item: rollItem(rand) });
      slimes.splice(i, 1);
    }
  }
  const cap = Math.min(14, 8 + Math.floor(kills / 5));
  if ((spawnTimer -= dt) <= 0) { spawnTimer = 3; if (slimes.length < cap) spawnSlime(110); }
}

// ---------- Render ----------
// The world is drawn in 3D by view.js. Only the pixel HUD is drawn here, in 2D.
const view = createView(document.getElementById("screen"), PAL, { WATER, FLOWER, TREE, JUMP_TIME, ATTACK_TIME, DASH_TIME });
const hudCanvas = document.getElementById("hudCanvas");
const hg = hudCanvas.getContext("2d");
let pixelSize = 3;

function resize() {
  pixelSize = Math.max(2, Math.round(innerHeight / 300));
  view.resize(pixelSize);
  hudCanvas.width = Math.ceil(innerWidth / pixelSize);
  hudCanvas.height = Math.ceil(innerHeight / pixelSize);
}
addEventListener("resize", resize);

function render(dt) {
  view.render({ player, slimes, potions, loot, effects, clock }, dt);
  hg.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  for (let i = 0; i < player.maxHp; i++) {
    const h = i < player.hp ? ART.heart.full : ART.heart.empty;
    hg.drawImage(h.frames[0].r, 3 + (i % 10) * 10, 3 + Math.floor(i / 10) * 10);
  }
  renderLabels();
  hud.textContent = `Slimes ${kills}`;
}

// Item labels float over loot on the ground, coloured by rarity (PoE style).
const labelLayer = document.getElementById("labels"), labelEls = new Map();
function renderLabels() {
  const alive = new Set(loot.map(l => l.item.id));
  for (const [id, el] of labelEls) if (!alive.has(id)) { el.remove(); labelEls.delete(id); }
  for (const l of loot) {
    let el = labelEls.get(l.item.id);
    if (!el) {
      el = document.createElement("div");
      el.className = `label rarity-${l.item.rarity}`;
      el.textContent = l.item.name;
      labelLayer.append(el); labelEls.set(l.item.id, el);
    }
    const s = view.gameToScreen(l.x, l.y, 0.55);
    el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
  }
}

const toastEl = document.getElementById("toast");
let toastTimer;
function toast(text) {
  toastEl.textContent = text; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1500);
}

// ---------- Loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === "play") {
    clock += dt;
    updatePlayer(dt);
    if (state === "play") updateSlimes(dt);
    for (const e of effects) e.t -= dt;
    effects = effects.filter(e => e.t > 0);
  }
  render(dt);
  requestAnimationFrame(loop);
}

// Debug handle for the browser console: simplicity.player, simplicity.slimes, ...
window.simplicity = { get player() { return player; }, get slimes() { return slimes; }, get potions() { return potions; }, get loot() { return loot; }, inv };

resize();
reset();
setState("title");
requestAnimationFrame(loop);
