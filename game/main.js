"use strict";
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
let player, slimes, potions, effects, kills, state, clock, spawnTimer;

function reset() {
  makeMap();
  seed = Date.now() % 100000 + 1;
  player = { x: SPAWN.x, y: SPAWN.y, face: 1, hp: MAX_HP, hurt: 0, jump: 0, attack: 0, cooldown: 0, hit: false, moving: false, swimming: false, vx: 0, vy: 0 };
  slimes = []; potions = []; effects = [];
  kills = 0; clock = 0; spawnTimer = 0;
  for (let i = 0; i < 8; i++) spawnSlime(80);
  for (let i = 0; i < 5; i++) { const p = randomGrassSpot(40); if (p) potions.push(p); }
}

function spawnSlime(minDist) {
  const p = randomGrassSpot(minDist);
  if (p) slimes.push({ x: p.x, y: p.y, hp: 3, timer: 0.5 + rand(), hop: 0, dx: 0, dy: 0, face: 1, flash: 0, vx: 0, vy: 0 });
}

// ---------- Input ----------
const keys = new Set();
let attackPressed = false, jumpPressed = false;
addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
  if (state !== "play") {
    if (state === "title" || (state === "dead" && k === "r")) { reset(); setState("play"); }
    return;
  }
  if (!e.repeat) {
    if (k === "j" || k === "enter") attackPressed = true;
    if (k === " ") jumpPressed = true;
  }
  keys.add(k);
});
addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
addEventListener("mousedown", () => { if (state === "play") attackPressed = true; });
addEventListener("blur", () => keys.clear());

const overlay = document.getElementById("overlay"), message = document.getElementById("message"), hud = document.getElementById("hud");
function setState(s) {
  state = s;
  overlay.hidden = s === "play";
  if (s === "dead") message.textContent = `You fell after defeating ${kills} slime${kills === 1 ? "" : "s"}. Press R to rise again.`;
}

// ---------- Update ----------
const PLAYER_SPEED = 42, SWIM_SPEED = 24, JUMP_TIME = 0.45, ATTACK_TIME = 0.3;

function updatePlayer(dt) {
  const p = player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.swimming = p.jump <= 0 && tileAt(p.x + 4, p.y + 6) === WATER;

  let ix = 0, iy = 0;
  if (keys.has("a") || keys.has("arrowleft")) ix--;
  if (keys.has("d") || keys.has("arrowright")) ix++;
  if (keys.has("w") || keys.has("arrowup")) iy--;
  if (keys.has("s") || keys.has("arrowdown")) iy++;
  if (ix) p.face = ix;
  const len = Math.hypot(ix, iy) || 1;
  const speed = (p.swimming ? SWIM_SPEED : PLAYER_SPEED) * (p.attack > 0 ? 0.35 : 1);
  p.moving = ix !== 0 || iy !== 0;
  moveBy(p, (ix / len) * speed * dt + p.vx * dt, (iy / len) * speed * dt + p.vy * dt, false);
  p.vx *= Math.pow(0.001, dt); p.vy *= Math.pow(0.001, dt);

  if (jumpPressed && p.jump <= 0 && !p.swimming && p.attack <= 0) p.jump = JUMP_TIME;
  if (p.jump > 0) p.jump = Math.max(0, p.jump - dt);

  if (attackPressed && p.cooldown <= 0 && !p.swimming) { p.attack = ATTACK_TIME; p.cooldown = 0.38; p.hit = false; }
  if (p.attack > 0) {
    p.attack = Math.max(0, p.attack - dt);
    if (!p.hit && p.attack < ATTACK_TIME * 0.66) {          // thrust frame: blade reaches 4..13px ahead
      p.hit = true;
      const x0 = p.face > 0 ? p.x + 8 : p.x - 13, x1 = x0 + 13;
      for (const s of slimes) {
        if (s.x + 7 > x0 && s.x + 1 < x1 && Math.abs(s.y - p.y) < 7) {
          s.hp--; s.flash = 0.15; s.vx = p.face * 90; s.vy = 0; s.timer = 0.6;
          effects.push({ x: s.x + 4, y: s.y + 4, t: 0.18 });
        }
      }
    }
  }
  attackPressed = jumpPressed = false;

  for (let i = potions.length - 1; i >= 0; i--) {
    if (overlap(p, potions[i]) && p.hp < MAX_HP) { p.hp = Math.min(MAX_HP, p.hp + 2); potions.splice(i, 1); }
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
    if (p.hurt <= 0 && p.jump <= 0 && overlap(p, s)) {
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
      slimes.splice(i, 1);
    }
  }
  const cap = Math.min(14, 8 + Math.floor(kills / 5));
  if ((spawnTimer -= dt) <= 0) { spawnTimer = 3; if (slimes.length < cap) spawnSlime(110); }
}

// ---------- Render ----------
const screen = document.getElementById("screen");
const sctx = screen.getContext("2d");
const view = document.createElement("canvas");
const g = view.getContext("2d");
let scale = 4;

function resize() {
  scale = Math.max(2, Math.round(innerHeight / 150));
  view.width = Math.ceil(innerWidth / scale);
  view.height = Math.ceil(innerHeight / scale);
  screen.width = view.width * scale;
  screen.height = view.height * scale;
}
addEventListener("resize", resize);

function frameOf(anim, t) {
  return anim.frames[Math.floor(t * 1000 / anim.ms) % anim.frames.length];
}

// Draw a frame with its top-left 8x8 cell at (x, y). Wide frames grow forward from the body.
function draw(anim, frame, x, y, face) {
  const ox = face < 0 ? -(frame.w - T) : 0;
  g.drawImage(face < 0 ? frame.l : frame.r, Math.round(x + ox - anim.pad), Math.round(y - anim.pad));
}

function playerFrame() {
  const p = player, A = ART.wanderer;
  if (p.attack > 0) return [A.fight, A.fight.frames[p.attack > ATTACK_TIME * 0.66 ? 0 : 1]];
  if (p.jump > 0) return [A.jump, A.jump.frames[p.jump > JUMP_TIME * 0.8 ? 0 : 1]];
  if (p.swimming) return [A.swim, frameOf(A.swim, clock)];
  if (p.moving) return [A.walk, frameOf(A.walk, clock)];
  return [A.idle, A.idle.frames[(clock % 3) < 0.15 ? 1 : 0]];
}

function render() {
  const p = player;
  const camX = Math.round(Math.min(Math.max(p.x + 4 - view.width / 2, 0), Math.max(0, MAP_W * T - view.width)));
  const camY = Math.round(Math.min(Math.max(p.y + 4 - view.height / 2, 0), Math.max(0, MAP_H * T - view.height)));
  g.fillStyle = INK; g.fillRect(0, 0, view.width, view.height);
  g.save(); g.translate(-camX, -camY);

  const tx0 = Math.max(0, Math.floor(camX / T)), ty0 = Math.max(0, Math.floor(camY / T));
  const tx1 = Math.min(MAP_W - 1, Math.floor((camX + view.width) / T)), ty1 = Math.min(MAP_H - 1, Math.floor((camY + view.height) / T));
  const water = frameOf(ART.water.idle, clock), grass = ART.grass.a.frames[0], flower = ART.grass.flower.frames[0];
  const props = [];
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const t = map[y][x];
    g.drawImage(t === WATER ? water.r : t === FLOWER ? flower.r : grass.r, x * T, y * T);
    if (t === TREE) props.push({ y: y * T, fn: () => draw(ART.tree.idle, ART.tree.idle.frames[0], x * T, y * T, 1) });
  }

  for (const o of potions) props.push({ y: o.y, fn: () => draw(ART.potion.idle, ART.potion.idle.frames[0], o.x, o.y + Math.round(Math.sin(clock * 3 + o.x) * 0.6), 1) });
  for (const s of slimes) {
    const z = s.hop > 0 ? Math.round(Math.sin((1 - s.hop / 0.3) * Math.PI) * 3) : 0;
    const idx = s.hop > 0 ? 0 : (Math.floor(clock * 2.5 + s.x) % 2);
    props.push({ y: s.y, fn: () => {
      if (s.flash > 0 && Math.floor(clock * 30) % 2) return;
      draw(ART.slime.idle, ART.slime.idle.frames[idx], s.x, s.y - z, s.face);
    } });
  }
  const [anim, frame] = playerFrame();
  const z = p.jump > 0 ? Math.round(Math.sin((1 - p.jump / JUMP_TIME) * Math.PI) * 7) : 0;
  props.push({ y: p.y, fn: () => {
    if (z > 0) { g.fillStyle = "rgb(20 16 30 / 0.45)"; g.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 8, 6, 1); }
    if (p.hurt > 0 && Math.floor(clock * 16) % 2) return;
    draw(anim, frame, p.x, p.y - z, p.face);
  } });

  props.sort((a, b) => a.y - b.y);
  for (const o of props) o.fn();

  for (const e of effects) {                              // hit sparks: a glow plus, then a ring of pixels
    g.fillStyle = e.big ? PAL.G : PAL.Y;
    const r = e.big ? Math.round((0.3 - e.t) * 30) + 1 : 1;
    const cx = Math.round(e.x), cy = Math.round(e.y);
    for (const [dx, dy] of [[0, -r], [0, r], [-r, 0], [r, 0], [r, r], [-r, -r], [r, -r], [-r, r]].slice(0, e.big ? 8 : 4))
      g.fillRect(cx + dx, cy + dy, 1, 1);
    if (!e.big) g.fillRect(cx, cy, 1, 1);
  }
  g.restore();

  for (let i = 0; i < MAX_HP; i++) {
    const h = i < p.hp ? ART.heart.full : ART.heart.empty;
    g.drawImage(h.frames[0].r, 2 + i * 9, 2);
  }

  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(view, 0, 0, screen.width, screen.height);
  hud.textContent = `Slimes ${kills}`;
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
  render();
  requestAnimationFrame(loop);
}

resize();
reset();
setState("title");
requestAnimationFrame(loop);
