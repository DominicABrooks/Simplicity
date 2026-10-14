// Simplicity 3D view: renders the 2D game state as a low-poly PS1-era scene.
// Gameplay never reads from here. One tile = one world unit; game x -> world X, game y -> world Z.
import * as THREE from "three";
import { TIERS } from "./tiers.js";

const PX_PER_TILE = 8;
const WATER_Y = -0.15, BED_Y = -0.6;

export function createView(canvas, PAL, C) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const SKY = new THREE.Color(PAL.k);
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 14, 24);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  const CAM_OFFSET = new THREE.Vector3(0, 11.5, 8.5);
  const camTarget = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight(0xcfe3ff, new THREE.Color(PAL.v), 1.5));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(-3, 6, 2);           // top-left of screen, as in ART_STYLE.md
  scene.add(sun);

  // ---------- PS1 vertex snapping ----------
  const snap = { value: new THREE.Vector2(160, 120) };
  function ps1(mat) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSnap = snap;
      sh.vertexShader = "uniform vec2 uSnap;\n" + sh.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;");
    };
    return mat;
  }
  const col = c => new THREE.Color(PAL[c] || c);
  const lambert = (c, o = {}) => ps1(new THREE.MeshLambertMaterial({ color: col(c), flatShading: true, dithering: true, ...o }));
  const basic = (c, o = {}) => ps1(new THREE.MeshBasicMaterial({ color: col(c), ...o }));

  // ---------- Hand-painted textures (tiny, nearest-filtered, palette colours) ----------
  let tseed = 0x9e3779b9;
  const tr = () => { tseed ^= tseed << 13; tseed ^= tseed >>> 17; tseed ^= tseed << 5; return (tseed >>> 0) / 4294967296; };
  function paint(w, h, fn, repeat) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); fn(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const dots = (g, x0, w, h, color, n, dw = 1, dh = 1) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) g.fillRect(x0 + Math.floor(tr() * w), Math.floor(tr() * h), dw, dh);
  };
  // Ground textures span several tiles so one texel is roughly one screen pixel (no moire).
  const grassTex = paint(32, 32, (g) => {
    g.fillStyle = PAL.v; g.fillRect(0, 0, 32, 32);
    dots(g, 0, 31, 31, "#285f3b", 22, 2, 2);
    dots(g, 0, 32, 31, PAL.G, 38, 1, 2);
    dots(g, 0, 32, 32, "#86c46a", 8, 1, 1);
  }, true);
  const flowerTex = paint(8, 8, (g) => {
    for (const [x, y, c] of [[2, 2, PAL.Y], [5, 5, PAL.W]]) {
      g.fillStyle = c; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = PAL.O; g.fillRect(x, y, 1, 1);
    }
  });
  const waterTex = paint(32, 32, (g) => {
    g.fillStyle = PAL.B; g.fillRect(0, 0, 32, 32);
    dots(g, 0, 30, 30, PAL.b, 10, 3, 2);
    dots(g, 0, 28, 31, PAL.C, 8, 4, 1);
  }, true);
  const earthTex = paint(16, 16, (g) => {
    g.fillStyle = PAL.N; g.fillRect(0, 0, 16, 16);
    for (let y = 3; y < 16; y += 4) { g.fillStyle = PAL.n; g.fillRect(0, y, 16, 1); }
    dots(g, 0, 15, 15, PAL.w, 5, 2, 1);
    g.fillStyle = PAL.G; g.fillRect(0, 0, 16, 2);
  }, true);
  // Gear tiers (tiers.js) decide cloth, trim and glow, so better loot visibly upgrades the hero.
  const texCache = {};
  function clothTex(tier) {                               // vertical folds, trim along the hem
    return texCache["cloth" + tier] ||= paint(16, 16, (g) => {
      const T = TIERS[tier];
      g.fillStyle = T.cloth; g.fillRect(0, 0, 16, 16);
      g.fillStyle = T.dark; for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
      g.fillStyle = T.light; for (let x = 3; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
      g.fillStyle = T.trim; g.fillRect(0, 13, 16, 2);
    }, true);
  }
  function mantleTex(tier) {
    return texCache["mantle" + tier] ||= paint(16, 16, (g) => {
      const T = TIERS[tier];
      g.fillStyle = T.dark; g.fillRect(0, 0, 16, 16);
      g.fillStyle = T.trim; g.fillRect(0, 12, 16, 3);
      if (tier === "rare") { g.fillStyle = PAL.O; for (let x = 1; x < 16; x += 4) g.fillRect(x, 13, 1, 1); }
    }, true);
  }
  const barkTex = paint(16, 16, (g) => {
    g.fillStyle = PAL.N; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL.n; for (let x = 2; x < 16; x += 5) g.fillRect(x, 0, 1, 16);
    dots(g, 0, 15, 15, PAL.n, 6, 1, 2);
  }, true);
  const leafTex = paint(16, 16, (g) => {
    g.fillStyle = PAL.G; g.fillRect(0, 0, 16, 16);
    dots(g, 0, 14, 14, PAL.v, 16, 2, 2);
    dots(g, 0, 15, 15, "#8fd06e", 10, 1, 1);
  }, true);

  // ---------- Terrain ----------
  const world = new THREE.Group(); scene.add(world);
  let fish = [], isWaterAt = () => false;
  function quadGeometry(quads) {
    const pos = [], uv = [];
    for (const q of quads) {
      for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...q.p[i]); uv.push(...q.uv[i]); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }

  function setMap(map) {
    world.clear();
    const H = map.length, W = map[0].length;
    const isWater = (x, y) => x >= 0 && y >= 0 && x < W && y < H && map[y][x] === C.WATER;
    const ground = [], flowers = [], water = [], bed = [], shore = [], trees = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = map[y][x];
      const corners = (yy) => [[x, yy, y], [x, yy, y + 1], [x + 1, yy, y + 1], [x + 1, yy, y]];
      const worldUV = k => [[x / k, y / k], [x / k, (y + 1) / k], [(x + 1) / k, (y + 1) / k], [(x + 1) / k, y / k]];
      if (t === C.WATER) {
        water.push({ p: corners(WATER_Y), uv: worldUV(4) });
        bed.push({ p: corners(BED_Y), uv: [[0, 0], [0, 1], [1, 1], [1, 0]] });
        const edges = [
          [!isWater(x, y - 1), [x, y], [x + 1, y]], [!isWater(x, y + 1), [x, y + 1], [x + 1, y + 1]],
          [!isWater(x - 1, y), [x, y], [x, y + 1]], [!isWater(x + 1, y), [x + 1, y], [x + 1, y + 1]],
        ];
        for (const [land, a, b] of edges) if (land) shore.push({
          p: [[a[0], 0, a[1]], [a[0], BED_Y, a[1]], [b[0], BED_Y, b[1]], [b[0], 0, b[1]]],
          uv: [[0, 1], [0, 0], [1, 0], [1, 1]],
        });
      } else {
        ground.push({ p: corners(0), uv: worldUV(4) });
        if (t === C.FLOWER) flowers.push({ p: corners(0.01), uv: [[0, 0], [0, 1], [1, 1], [1, 0]] });
        if (t === C.TREE) trees.push([x + 0.5, y + 0.5]);
      }
    }
    const side = { side: THREE.DoubleSide };
    world.add(new THREE.Mesh(quadGeometry(ground), lambert("#ffffff", { map: grassTex, ...side })));
    world.add(new THREE.Mesh(quadGeometry(flowers), lambert("#ffffff", { map: flowerTex, alphaTest: 0.5, ...side })));
    world.add(new THREE.Mesh(quadGeometry(bed), lambert(PAL.b, side)));
    world.add(new THREE.Mesh(quadGeometry(shore), lambert("#ffffff", { map: earthTex, ...side })));
    world.add(new THREE.Mesh(quadGeometry(water), lambert("#ffffff", { map: waterTex, transparent: true, opacity: 0.62, ...side })));

    // Ground beyond the map edge: four strips around it, so they never cover the sunken water.
    // Tinted darker: it's forest floor under the canopy.
    const R = 60, outerMat = lambert("#9db29d", { map: grassTex, ...side });
    const strip = (x0, z0, x1, z1) => ({ p: [[x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0]], uv: [[x0 / 4, z0 / 4], [x0 / 4, z1 / 4], [x1 / 4, z1 / 4], [x1 / 4, z0 / 4]] });
    world.add(new THREE.Mesh(quadGeometry([
      strip(-R, -R, W + R, 0), strip(-R, H, W + R, H + R), strip(-R, 0, 0, H), strip(W, 0, W + R, H),
    ]), outerMat));

    // Deterministic per-position noise so the forest looks the same every run.
    const hash = (x, z, k) => { const s = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
    const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && map[y][x] !== C.TREE;

    // Trees: map trees (nudged off the grid) plus a dense decorative forest around the map, fading into fog.
    const placed = [];                                      // [x, z, scale]
    for (const [x, z] of trees) {
      placed.push([x + (hash(x, z, 1) - 0.5) * 0.3, z + (hash(x, z, 2) - 0.5) * 0.3, 0.8 + hash(x, z, 3) * 0.45]);
    }
    const RING = 9;
    for (let y = -RING; y < H + RING; y++) for (let x = -RING; x < W + RING; x++) {
      if (x >= 0 && y >= 0 && x < W && y < H) continue;
      if (hash(x, y, 4) > 0.72) continue;                   // a few gaps so it isn't a solid carpet
      const big = 0.95 + hash(x, y, 5) * 0.6;              // outer forest grows taller than the treeline
      placed.push([x + 0.5 + (hash(x, y, 6) - 0.5) * 0.7, y + 0.5 + (hash(x, y, 7) - 0.5) * 0.7, big]);
    }
    const treeParts = [
      [new THREE.CylinderGeometry(0.11, 0.17, 0.62, 5).translate(0, 0.31, 0), lambert("#ffffff", { map: barkTex })],
      [new THREE.IcosahedronGeometry(0.52, 0).translate(0, 0.92, 0), lambert("#ffffff", { map: leafTex })],
      [new THREE.IcosahedronGeometry(0.36, 0).translate(0.08, 1.34, 0.04), lambert("#ffffff", { map: leafTex })],
    ];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const instanced = (geo, mat, list, colorFor) => {
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z, k], i) => {
        q.setFromAxisAngle(up, hash(x, z, 8) * Math.PI * 2);
        m.compose(new THREE.Vector3(x, 0, z), q, sc.set(k, k * (0.9 + hash(x, z, 9) * 0.25), k));
        inst.setMatrixAt(i, m);
        inst.setColorAt(i, colorFor(x, z));
      });
      world.add(inst);
    };
    // Leaves vary a little in hue and brightness; outer trees are darker, like deeper woods.
    const leafColor = (x, z) => {
      const deep = x < 0 || z < 0 || x > W || z > H ? 0.78 : 1;
      const b = (0.78 + hash(x, z, 10) * 0.35) * deep;
      return new THREE.Color(b * (0.92 + hash(x, z, 11) * 0.12), b, b * (0.9 + hash(x, z, 12) * 0.1));
    };
    instanced(treeParts[0][0], treeParts[0][1], placed, () => new THREE.Color(1, 1, 1));
    instanced(treeParts[1][0], treeParts[1][1], placed, leafColor);
    instanced(treeParts[2][0], treeParts[2][1], placed, leafColor);

    // Undergrowth: bushes and rocks on tree tiles that face the clearing, softening the treeline.
    const bushes = [], rocks = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (map[y][x] !== C.TREE) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!walkable(x + dx, y + dy) || hash(x * 3 + dx, y * 3 + dy, 13) > 0.55) continue;
        const bx = x + 0.5 + dx * 0.32 + (hash(x, y, 14 + dx) - 0.5) * 0.4;
        const bz = y + 0.5 + dy * 0.32 + (hash(x, y, 15 + dy) - 0.5) * 0.4;
        if (hash(x + dx, y + dy, 16) < 0.18) rocks.push([bx, bz, 0.7 + hash(x, y, 17) * 0.6]);
        else bushes.push([bx, bz, 0.7 + hash(x, y, 18) * 0.5]);
      }
    }
    instanced(new THREE.IcosahedronGeometry(0.24, 0).translate(0, 0.14, 0).scale(1.2, 0.8, 1.2), lambert("#ffffff", { map: leafTex }), bushes, leafColor);
    instanced(new THREE.DodecahedronGeometry(0.16, 0).translate(0, 0.08, 0).scale(1.3, 0.75, 1), lambert(PAL.w), rocks,
      (x, z) => { const b = 0.75 + hash(x, z, 19) * 0.3; return new THREE.Color(b, b, b); });

    // Fish swim just under the surface of every body of water, about one per 7 water tiles.
    isWaterAt = (x, z) => isWater(Math.floor(x), Math.floor(z));
    const waterTiles = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (map[y][x] === C.WATER) waterTiles.push([x, y]);
    fish = [];
    for (let i = 0; i < Math.round(waterTiles.length / 7); i++) {
      const [x, y] = waterTiles[Math.floor(Math.random() * waterTiles.length)];
      fish.push(makeFish(x + 0.5, y + 0.5));
    }
  }

  // A koi: elongated octahedron body, a wiggling tail and a top fin, in one of a few koi colourings.
  const FISH_COLORS = [[PAL.O, PAL.W], [PAL.R, PAL.W], [PAL.W, PAL.O], [PAL.Y, PAL.O], [PAL.O, PAL.R]];
  const fishBodyGeo = new THREE.OctahedronGeometry(0.1, 0).scale(1.9, 0.65, 0.8);
  const fishTailGeo = new THREE.ConeGeometry(0.075, 0.13, 3).rotateZ(Math.PI / 2).translate(-0.065, 0, 0);
  const fishFinGeo = new THREE.ConeGeometry(0.035, 0.08, 3).translate(0, 0.07, 0);
  function makeKoiMesh(main, accent, glow = 0.75) {
    const group = new THREE.Group(), tail = new THREE.Group();
    const bodyMat = lambert(main, { emissive: col(main), emissiveIntensity: glow });
    const accentMat = lambert(accent, { emissive: col(accent), emissiveIntensity: glow });
    group.add(new THREE.Mesh(fishBodyGeo, bodyMat));
    const fin = new THREE.Mesh(fishFinGeo, accentMat); fin.position.x = 0.02;
    tail.position.x = -0.17; tail.add(new THREE.Mesh(fishTailGeo, accentMat));
    group.add(fin, tail);
    group.userData.tail = tail;
    return group;
  }
  function makeFish(x, z) {
    const [main, accent] = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];
    const group = makeKoiMesh(main, accent), tail = group.userData.tail;
    const s = 1.4 + Math.random() * 0.6;
    group.scale.setScalar(s);
    world.add(group);
    return { group, tail, x, z, heading: Math.random() * Math.PI * 2, speed: 0.4, phase: Math.random() * 10, turn: 0, dart: 0 };
  }

  // ---------- Fishing visuals ----------
  const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 9 }, () => new THREE.Vector3()));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: col(PAL.W), transparent: true, opacity: 0.8 }));
  const bobber = new THREE.Group();
  const bobTop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), lambert(PAL.R, { emissive: col(PAL.R), emissiveIntensity: 0.4 }));
  const bobBottom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lambert(PAL.W));
  bobber.add(bobTop, bobBottom);
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 10).rotateX(-Math.PI / 2), basic(PAL.W, { transparent: true, opacity: 0.7, depthWrite: false }));
  const castMarker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 8).rotateX(-Math.PI / 2),
    basic(PAL.C, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  castMarker.visible = false;
  scene.add(line, bobber, splash, castMarker);
  line.visible = bobber.visible = splash.visible = false;
  let bobberAt = null;
  // The caught koi leaps from the water to the hero.
  let leaper = null, leaperKey = null;
  const tipPos = new THREE.Vector3(), bobPos = new THREE.Vector3(), mid = new THREE.Vector3();

  function updateFishing(p, t, dt) {
    const w = p.windup;
    castMarker.visible = !!w;
    if (w) {
      const [mx, mz] = toWorld(w.x - 4, w.y - 4);
      castMarker.position.set(mx, (w.water ? WATER_Y : 0) + 0.02, mz);
      castMarker.material.color.set(w.water ? PAL.C : PAL.w);
      castMarker.material.opacity = w.water ? 0.9 : 0.45;
      castMarker.rotation.y = t * 2;
      castMarker.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
    }
    const f = p.fishing;
    const show = !!(f && hero.rodTip && hero.sword.visible);
    line.visible = bobber.visible = show;
    splash.visible = false;
    bobberAt = null;
    if (show) {
      hero.group.updateMatrixWorld(true);
      hero.rodTip.getWorldPosition(tipPos);
      const [bx, bz] = toWorld(f.x - 4, f.y - 4);
      if (f.phase === "cast") {                             // arc from the rod tip to the water
        const k = Math.min(1, f.t / C.CAST_TIME);
        bobPos.set(tipPos.x + (bx - tipPos.x) * k, tipPos.y + (WATER_Y - tipPos.y) * k + Math.sin(k * Math.PI) * 0.8, tipPos.z + (bz - tipPos.z) * k);
      } else {
        const dip = f.phase === "bite" ? -0.08 + Math.sin(t * 30) * 0.03 : Math.sin(t * 3) * 0.015;
        bobPos.set(bx, WATER_Y + 0.02 + dip, bz);
        bobberAt = { x: bx, z: bz };
        if (f.phase === "bite") {
          splash.visible = true;
          splash.position.set(bx, WATER_Y + 0.01, bz);
          const s = (t * 3) % 1;
          splash.scale.setScalar(1 + s * 2); splash.material.opacity = 0.7 * (1 - s);
        }
      }
      bobber.position.copy(bobPos);
      // Line sags between the tip and the bobber.
      const pos = lineGeo.attributes.position;
      for (let i = 0; i < 9; i++) {
        const k = i / 8;
        mid.lerpVectors(tipPos, bobPos, k);
        mid.y -= Math.sin(k * Math.PI) * (f.phase === "bite" ? 0.05 : 0.25);
        pos.setXYZ(i, mid.x, mid.y, mid.z);
      }
      pos.needsUpdate = true;
      lineGeo.computeBoundingSphere();
    }

    const c = p.catchAnim, age = c ? t - c.t0 : 99;
    if (age < 0.7) {
      if (leaperKey !== c) {
        if (leaper) world.remove(leaper);
        const T = TIERS[c.rarity];
        leaper = makeKoiMesh(T.fishMain, T.fishAccent);
        leaper.scale.setScalar(2.2);
        world.add(leaper); leaperKey = c;
        const [sx, sz] = toWorld(c.x - 4, c.y - 4);
        for (let i = 0; i < 8; i++) {                       // splash droplets
          const m = new THREE.Mesh(sparkGeo, sparkMats.water), a = Math.random() * Math.PI * 2;
          m.position.set(sx, WATER_Y, sz);
          m.userData = { vx: Math.cos(a) * 1.2, vz: Math.sin(a) * 1.2, vy: 2.5 + Math.random() * 1.5, life: 0.45 };
          scene.add(m); sparks.push(m);
        }
      }
      const [sx, sz] = toWorld(c.x - 4, c.y - 4), k = age / 0.7;
      const [hx, hz] = toWorld(p.x, p.y);
      leaper.position.set(sx + (hx - sx) * k, WATER_Y + Math.sin(k * Math.PI) * 1.6 + k * 0.6, sz + (hz - sz) * k);
      leaper.rotation.set(0, -Math.atan2(hz - sz, hx - sx), Math.sin(t * 25) * 0.5 + k * 6);
    } else if (leaper) { world.remove(leaper); leaper = null; leaperKey = null; }
  }

  // ---------- Sword swoosh ----------
  // A flat arc on the hero, from where the sweep began to where the blade is now, fading after the sweep.
  const swooshMat = basic(PAL.W, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const swoosh = new THREE.Mesh(new THREE.BufferGeometry(), swooshMat);
  swoosh.position.y = 0.5;
  const SWOOSH_COLOR = { normal: PAL.W, magic: PAL.C, rare: PAL.Y };
  function updateSwoosh(p) {
    if (!swoosh.parent) hero.group.add(swoosh);             // hero is created later in this file
    const k = p.swingK, active = p.attack > 0 && !p.lunge && p.gear && p.gear.weaponType === "blade" && k > 0.25 && k < 0.85;
    swoosh.visible = !!active;
    if (!active) return;
    const start = p.swingSide * 1.25, now = p.swingRel;
    const from = Math.min(-start, -now), len = Math.abs(now - start);
    if (len < 0.02) { swoosh.visible = false; return; }
    swoosh.geometry.dispose();
    swoosh.geometry = new THREE.RingGeometry(0.3, 0.95, 10, 1, from, len).rotateX(-Math.PI / 2);
    swooshMat.color.set(SWOOSH_COLOR[p.gear.weapon] || PAL.W);
    swooshMat.opacity = k < 0.6 ? 0.45 : 0.45 * (1 - (k - 0.6) / 0.25);
  }

  // ---------- Hands ----------
  const grip = new THREE.Vector3(), handTarget = new THREE.Vector3();
  const lerp = (a, b, k) => a + (b - a) * k;
  function animateHands(p, t, dt) {
    const h = hero, sw = h.sword;
    // A new attack starts when the timer jumps up; alternate punching hands.
    if (p.attack > h.lastAttack + 1e-4) h.punchSide ^= 1;
    h.lastAttack = p.attack;
    h.body.rotation.y = 0;
    h.hands.forEach((hand, i) => {
      const side = i === 0 ? 1 : -1;
      // Resting: hovering at the sides, breathing with the body.
      let x = 0.12, y = 0.38 + Math.sin(t * 2.5 + i) * 0.02, z = side * 0.44;
      if (p.swimming) {                                     // paddle at the surface
        const a = t * 5 + i * Math.PI;
        x = 0.15 + Math.cos(a) * 0.12; y = 0.44 + Math.sin(a) * 0.05; z = side * 0.38;
      } else if (p.dash > 0) { x = -0.22; y = 0.45; }         // trail behind
      else if (p.jump > 0) { x = 0.05; y = 0.75; z = side * 0.42; }   // up in the air
      else if (p.moving) { x = 0.12 + Math.sin(t * 12 + i * Math.PI) * 0.12; y += Math.abs(Math.sin(t * 12)) * 0.04; }

      if (i === 1 && sw.visible && h.bow && p.draw) {       // back hand pulls the bowstring
        sw.updateMatrix();
        grip.set(h.bow.nockX - 0.02, 0, 0).applyMatrix4(sw.matrix);
        hand.position.copy(grip);
        return;
      }
      if (i === 0 && sw.visible) {                          // front hand holds the weapon's grip
        sw.updateMatrix();
        grip.set(0, h.gripY, 0).applyMatrix4(sw.matrix);
        hand.position.copy(grip);
        return;
      }
      if (!sw.visible && p.attack > 0 && i === h.punchSide) {   // unarmed: punch
        const k = 1 - p.attack / C.ATTACK_TIME;
        if (k < 0.34) { const u = k / 0.34; x = lerp(x, -0.06, u); y = lerp(y, 0.44, u); }          // pull back
        else if (k < 0.6) {                                                                          // jab
          const u = 1 - Math.pow(1 - (k - 0.34) / 0.26, 3);
          x = lerp(-0.06, 0.62, u); y = 0.47; z = lerp(z, side * 0.12, u);
          h.body.rotation.y = side * 0.25 * u;              // twist into the punch
        } else { const u = (k - 0.6) / 0.4; x = lerp(0.62, x, u); y = lerp(0.47, y, u); z = lerp(side * 0.12, z, u); }
        hand.position.set(x, y, z);
        return;
      }
      handTarget.set(x, y, z);
      hand.position.lerp(handTarget, 1 - Math.exp(-dt * 20));
    });
  }

  function updateFish(dt, t, px, pz) {
    for (const f of fish) {
      // Wander: drift the turn rate, and occasionally pick a new one.
      if (Math.random() < dt * 0.8) f.turn = (Math.random() - 0.5) * 2.4;
      f.heading += f.turn * dt;
      // Drift toward a bobber in the water and mill around it.
      if (bobberAt) {
        const bx = bobberAt.x - f.x, bz = bobberAt.z - f.z, bd = Math.hypot(bx, bz);
        if (bd < 3 && bd > 0.35) f.heading += Math.atan2(Math.sin(Math.atan2(bz, bx) - f.heading), Math.cos(Math.atan2(bz, bx) - f.heading)) * dt * 2;
      }
      // Scatter from the hero.
      const dx = f.x - px, dz = f.z - pz, d = Math.hypot(dx, dz);
      if (d < 1.4 && f.dart <= 0) { f.heading = Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.8; f.dart = 0.6; }
      f.dart = Math.max(0, f.dart - dt);
      const speed = f.dart > 0 ? 2.2 : 0.45;
      f.speed += (speed - f.speed) * (1 - Math.exp(-dt * 6));
      // Stay in the water: if the way ahead is land, turn away.
      const ahead = 0.3 * f.group.scale.x;
      if (!isWaterAt(f.x + Math.cos(f.heading) * ahead, f.z + Math.sin(f.heading) * ahead)) {
        f.heading += Math.PI * (0.6 + Math.random() * 0.6);
        f.dart = 0;
      } else {
        f.x += Math.cos(f.heading) * f.speed * dt;
        f.z += Math.sin(f.heading) * f.speed * dt;
      }
      f.group.position.set(f.x, -0.22 + Math.sin(t * 1.3 + f.phase) * 0.02, f.z);
      f.group.rotation.y = -f.heading;
      f.tail.rotation.y = Math.sin(t * (6 + f.speed * 10) + f.phase) * 0.6;
    }
  }

  // ---------- Models ----------
  const shadowGeo = new THREE.CircleGeometry(0.34, 8).rotateX(-Math.PI / 2);
  const shadowMat = basic("#000000", { transparent: true, opacity: 0.35, depthWrite: false });
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  const lathe = (pts, mat) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 7), mat);

  // Base body: a little stone spirit in a bark wrap. Gear groups are rebuilt whenever equipment changes.
  function makeHero() {
    const group = new THREE.Group(), body = new THREE.Group(), sword = new THREE.Group(), ring = new THREE.Group();
    group.add(body, sword, ring);
    const skin = lambert(PAL.w);
    body.add(lathe([[0, 0.06], [0.2, 0.06], [0.27, 0.2], [0.27, 0.4], [0.2, 0.56], [0.08, 0.64]], skin));
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.29, 0.11, 7), lambert(PAL.n)); wrap.position.y = 0.19;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 7, 5), skin); head.position.y = 0.8;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), basic(PAL.k));
    face.position.set(0.17, 0.78, 0); face.scale.set(0.55, 0.8, 0.9);
    const eyeMat = basic(PAL.Y);
    const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(box(0.05, 0.1, 0.06), eyeMat); e.position.set(0.29, 0.8, s * 0.075); return e; });
    // Each foot is a group so bare feet and boots share the walk animation.
    const feet = [-1, 1].map(s => {
      const f = new THREE.Group(); f.position.set(0.14, 0, s * 0.12);
      const nub = new THREE.Mesh(box(0.14, 0.07, 0.11), skin); nub.position.y = 0.035;
      f.add(nub); f.userData.nub = nub;
      return f;
    });
    body.add(wrap, head, face, ...eyes, ...feet);
    const gear = new THREE.Group(); body.add(gear);
    // Floating hands (no arms). [0] is the front hand on the camera side, [1] the back hand.
    const handGeo = new THREE.IcosahedronGeometry(0.1, 0).scale(1.1, 0.9, 1);
    const handMat = lambert("#8f8578");                       // a shade darker than the body so they read
    const hands = [1, -1].map(s => { const m = new THREE.Mesh(handGeo, handMat); m.position.set(0.12, 0.38, s * 0.44); return m; });
    group.add(...hands);

    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = 0.01;
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.5, 10).rotateX(-Math.PI / 2), basic(PAL.C, { transparent: true, opacity: 0.6, depthWrite: false }));
    scene.add(group, shadow, ripple);
    return { group, body, gear, sword, ring, eyes, feet, hands, shadow, ripple, footX: 0.14, gripY: 0, key: null, punchSide: 0, lastAttack: 0 };
  }

  function dressHero(h, g) {
    const key = JSON.stringify(g);
    if (key === h.key) return;
    h.key = key;
    h.gear.clear(); h.sword.clear(); h.ring.clear();
    h.feet.forEach(f => { f.clear(); f.add(f.userData.nub); f.userData.nub.visible = true; });

    if (g.armor) {
      const T = g.armor;
      h.gear.add(lathe([[0.42, 0], [0.4, 0.1], [0.3, 0.38], [0.18, 0.56]], lambert("#ffffff", { map: clothTex(T) })));
      h.gear.add(lathe([[0.38, 0.44], [0.34, 0.52], [0.2, 0.64]], lambert("#ffffff", { map: mantleTex(T) })));
    }
    if (g.helm) {
      const T = g.helm;
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.31, 7, 5), lambert("#ffffff", { map: clothTex(T) }));
      hood.position.set(0, 0.8, 0); hood.scale.set(1, 0.95, 1);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), lambert(TIERS[T].cloth));
      tip.position.set(-0.2, 1.04, 0); tip.rotation.z = 1.1;
      const opening = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), basic(PAL.k));
      opening.position.set(0.21, 0.77, 0); opening.scale.set(0.6, 0.85, 0.95);
      h.gear.add(hood, tip, opening);
    }
    // Eyes sit in whatever face is in front: the hood's opening or the bare head.
    h.eyes.forEach(e => { e.position.x = g.helm ? 0.34 : 0.29; });
    if (g.boots) {
      const T = TIERS[g.boots];
      h.feet.forEach(f => {
        f.userData.nub.visible = false;
        const boot = new THREE.Mesh(box(0.2, 0.12, 0.14), lambert(T.boot)); boot.position.set(0.02, 0.06, 0);
        const cuff = new THREE.Mesh(box(0.15, 0.04, 0.16), lambert(T.trim)); cuff.position.set(-0.01, 0.14, 0);
        f.add(boot, cuff);
      });
    }
    // Feet poke out from under a robe, or sit under a bare body.
    h.footX = g.armor ? 0.3 : 0.14;
    if (g.amulet) {
      const T = TIERS[g.amulet];
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), lambert(T.gem, { emissive: col(T.gem), emissiveIntensity: 0.6 }));
      gem.position.set(g.armor ? 0.36 : 0.28, 0.5, 0);
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 3, 10).rotateX(Math.PI / 2), lambert(T.metal));
      chain.position.set(g.armor ? 0.18 : 0.1, 0.6, 0); chain.scale.set(1.15, 1, 1);
      h.gear.add(gem, chain);
    }
    if (g.ring) {
      const T = TIERS[g.ring];
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 8), lambert(T.metal, { emissive: col(T.gem), emissiveIntensity: 0.5 }));
      band.position.set(0.52, 0.45, 0);
      h.ring.add(band);
    }
    h.rodTip = null; h.bow = null;
    if (g.weaponType === "bow") {
      const T = TIERS[g.weapon];
      const wood = lambert(PAL.N), wrap = lambert(T.cloth), tipMat = lambert(T.metal, { emissive: col(T.metal), emissiveIntensity: T.glow });
      // Limbs curve forward (+X) away from the string; the grip sits at the group origin.
      const limb = (s) => { const m = new THREE.Mesh(box(0.045, 0.3, 0.05), wood); m.position.set(0.06, s * 0.2, 0); m.rotation.z = s * 0.35; return m; };
      const limb2 = (s) => { const m = new THREE.Mesh(box(0.04, 0.16, 0.045), wood); m.position.set(0.0, s * 0.4, 0); m.rotation.z = s * -0.25; return m; };
      const gripM = new THREE.Mesh(box(0.06, 0.15, 0.07), wrap); gripM.position.x = 0.08;
      const tips = [1, -1].map(s => { const m = new THREE.Mesh(box(0.05, 0.05, 0.06), tipMat); m.position.set(-0.03, s * 0.48, 0); return m; });
      const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.03, 0.48, 0), new THREE.Vector3(-0.03, 0, 0), new THREE.Vector3(-0.03, -0.48, 0)]);
      const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: col(PAL.W) }));
      // Nocked arrow, shown while drawing.
      const arrow = makeArrowMesh();
      arrow.visible = false;
      h.sword.add(limb(1), limb(-1), limb2(1), limb2(-1), gripM, ...tips, string, arrow);
      h.bow = { string, arrow };
      h.gripY = 0;
    } else if (g.weaponType === "rod") {
      const oak = lambert(PAL.N), dark = lambert(PAL.n);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 1.3, 4).translate(0, 0.6, 0), oak);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 5).translate(0, -0.05, 0), dark);
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6).rotateX(Math.PI / 2), lambert(PAL.w));
      reel.position.set(-0.06, 0.12, 0);
      const tip = new THREE.Object3D(); tip.position.y = 1.25;
      h.sword.add(pole, grip, reel, tip);
      h.rodTip = tip;
      h.gripY = -0.05;
    } else if (g.weapon) {
      const T = TIERS[g.weapon];
      const blade = lambert(T.blade, { emissive: col(g.weapon === "rare" ? PAL.Y : PAL.C), emissiveIntensity: T.glow });
      const guard = lambert(T.guard);
      const parts = [[box(0.05, 0.62, 0.12), blade, 0.45], [box(0.08, 0.06, 0.32), guard, 0.12], [box(0.05, 0.16, 0.05), lambert(PAL.N), 0.02], [box(0.08, 0.08, 0.08), guard, -0.08]];
      for (const [geo, m, y] of parts) { const p = new THREE.Mesh(geo, m); p.position.y = y; h.sword.add(p); }
      h.gripY = 0.02;
    }
  }

  function makeSlime() {
    const group = new THREE.Group(), body = new THREE.Group();
    const mat = lambert(PAL.G, { transparent: true, opacity: 0.9, emissive: col("#000000") });
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), mat);
    blob.scale.set(1, 0.72, 1); blob.position.y = 0.26;
    const eyeMat = basic(PAL.k);
    const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(box(0.06, 0.1, 0.06), eyeMat); e.position.set(0.3, 0.32, s * 0.11); return e; });
    const shine = new THREE.Mesh(box(0.08, 0.05, 0.08), basic(PAL.W)); shine.position.set(-0.08, 0.5, -0.12);
    body.add(blob, ...eyes, shine);
    group.add(body);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = 0.01;
    scene.add(group, shadow);
    return { group, body, mat, shadow };
  }

  function makePotion() {
    const group = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), lambert(PAL.R, { emissive: col(PAL.r), emissiveIntensity: 0.6 }));
    bottle.position.y = 0.17;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 5), lambert(PAL.w)); neck.position.y = 0.34;
    const cork = new THREE.Mesh(box(0.08, 0.06, 0.08), lambert(PAL.n)); cork.position.y = 0.42;
    const glint = new THREE.Mesh(box(0.04, 0.04, 0.04), basic(PAL.W)); glint.position.set(-0.07, 0.24, -0.07);
    group.add(bottle, neck, cork, glint);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = 0.01; shadow.scale.setScalar(0.6);
    scene.add(group, shadow);
    return { group, shadow };
  }

  const RARITY = { normal: PAL.w, magic: "#7fa6ff", rare: PAL.Y };
  function makeLoot(item) {
    const group = new THREE.Group();
    const c = RARITY[item.rarity];
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), lambert(c, { emissive: col(c), emissiveIntensity: 0.5 }));
    gem.position.y = 0.3;
    group.add(gem);
    if (item.rarity !== "normal") {                         // light beam: short for magic, tall for rare
      const hgt = item.rarity === "rare" ? 3 : 1.2;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, hgt, 5, 1, true).translate(0, hgt / 2, 0),
        basic(c, { transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      group.add(beam);
    }
    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = 0.01; shadow.scale.setScalar(0.5);
    scene.add(group, shadow);
    return { group, shadow, gem };
  }

  const hero = makeHero();
  const reticle = new THREE.Mesh(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.18, 0, 0), new THREE.Vector3(-0.1, 0, -0.14), new THREE.Vector3(-0.1, 0, 0.14)]),
    basic(PAL.Y, { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(reticle);
  const slimeViews = new Map(), potionViews = new Map(), lootViews = new Map(), arrowViews = new Map();
  // Arrow: oak shaft along +X, stone head, ember fletching. The head glows on a power shot.
  function makeArrowMesh(power = false) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(box(0.42, 0.025, 0.025), lambert(PAL.N)); shaft.position.x = 0.21;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4).rotateZ(-Math.PI / 2), lambert(PAL.w, { emissive: col(PAL.Y), emissiveIntensity: power ? 1 : 0 }));
    tip.position.x = 0.45;
    const fletch = new THREE.Mesh(box(0.1, 0.06, 0.01), lambert(PAL.R)); fletch.position.x = 0.04;
    g.add(shaft, tip, fletch);
    g.userData.tip = tip;
    return g;
  }
  function makeArrowView(a) {
    const group = new THREE.Group(), mesh = makeArrowMesh(a.power);
    mesh.position.x = -0.24;                                // centre the arrow on its game position
    group.add(mesh);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.scale.set(0.5, 1, 0.15); shadow.position.y = 0.01;
    scene.add(group, shadow);
    return { group, shadow };
  }
  const sparkGeo = new THREE.OctahedronGeometry(0.07, 0);
  const sparkMats = { hit: basic(PAL.Y), big: basic(PAL.G), water: basic(PAL.C) };
  let sparks = [];
  let ghosts = [], ghostTimer = 0, wasDashing = false;
  const dustMat = basic(PAL.w);
  function puff(x, z) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(sparkGeo, dustMat), a = Math.random() * Math.PI * 2;
      m.position.set(x, 0.08, z);
      m.userData = { vx: Math.cos(a) * 1.5, vz: Math.sin(a) * 1.5, vy: 1 + Math.random(), life: 0.3 };
      scene.add(m); sparks.push(m);
    }
  }
  const seenEffects = new WeakSet();

  function syncSet(list, views, make) {
    const alive = new Set(list);
    for (const [o, v] of views) if (!alive.has(o)) { scene.remove(v.group, v.shadow); views.delete(o); }
    for (const o of list) if (!views.has(o)) views.set(o, make(o));
  }

  const toWorld = (x, y) => [(x + 4) / PX_PER_TILE, (y + 4) / PX_PER_TILE];
  const smooth = (cur, target, dt, k) => cur + (target - cur) * (1 - Math.exp(-dt * k));
  // Turn an angle toward a target along the shortest way round.
  const turn = (cur, target, dt, k) => cur + Math.atan2(Math.sin(target - cur), Math.cos(target - cur)) * (1 - Math.exp(-dt * k));
  let yaw = 0;

  function resize(pixelSize) {
    const w = Math.ceil(innerWidth / pixelSize), h = Math.ceil(innerHeight / pixelSize);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    snap.value.set(w / 3, h / 3);
  }

  function render(s, dt) {
    const p = s.player, t = s.clock;
    const [px, pz] = toWorld(p.x, p.y);

    // Hero
    const hz = p.jump > 0 ? Math.sin((1 - p.jump / C.JUMP_TIME) * Math.PI) * 1.0 : 0;
    const swimY = p.swimming ? -0.48 + Math.sin(t * 4) * 0.03 : 0;
    hero.group.position.set(px, hz + swimY, pz);
    // Face the aim (locked to the swing direction mid-attack). Game angle a maps to yaw -a.
    const targetYaw = -(p.attack > 0 ? p.swingAim : p.aim);
    yaw = turn(yaw, targetYaw, dt, 18);
    hero.group.rotation.y = yaw;
    hero.group.visible = !(p.hurt > 0 && Math.floor(t * 16) % 2);

    dressHero(hero, p.gear || {});
    const b = hero.body;
    b.position.y = 0; b.rotation.z = 0; b.scale.set(1, 1, 1);
    hero.feet.forEach(f => { f.position.x = hero.footX; f.visible = !p.swimming; });
    if (p.dash > 0 || p.lungeActive) {
      b.rotation.z = -0.4; b.scale.set(1.15, 0.9, 0.9);      // lean hard into the dash (or lunge)
    } else if (p.jump > 0) {
      const squash = p.jump > C.JUMP_TIME * 0.8;
      b.scale.set(squash ? 1.25 : 0.88, squash ? 0.7 : 1.18, squash ? 1.25 : 0.88);
    } else if (p.moving && !p.swimming) {
      b.position.y = Math.abs(Math.sin(t * 12)) * 0.07;
      b.rotation.z = -0.1;
      hero.feet.forEach((f, i) => { f.position.x = hero.footX + Math.sin(t * 12 + i * Math.PI) * 0.1; });
    } else if (!p.swimming) {
      b.scale.y = 1 + Math.sin(t * 2.5) * 0.025;
    }
    const blink = (t % 3) < 0.15;
    hero.eyes.forEach(e => { e.scale.y = blink ? 0.15 : 1; });

    // Sword: floats at the side, winds up, then thrusts forward (matches the 2D hit timing).
    const sw = hero.sword;
    sw.visible = !p.swimming && !!(p.gear && p.gear.weapon);
    hero.ring.rotation.y = t * 1.8;                         // the ring orbits the hero
    hero.ring.position.y = Math.sin(t * 2.4) * 0.05;
    const rod = p.gear && p.gear.weaponType === "rod";
    const fishing = p.fishing;
    if (hero.bow) {
      const c = p.draw ? Math.min(1, p.draw.t / C.DRAW_TIME) : 0;
      if (p.draw) { sw.position.set(0.42, 0.5, 0.06); sw.rotation.set(0, 0, 0); }      // held out toward the aim
      else { sw.position.set(0.08, 0.45, 0.48); sw.rotation.set(0, 0, -0.25 + Math.sin(t * 1.7) * 0.04); }
      // Pull the string back to the nock; the nocked arrow rides on it.
      const nockX = -0.03 - 0.3 * c;
      hero.bow.nockX = nockX;
      const sp = hero.bow.string.geometry.attributes.position;
      sp.setX(1, nockX); sp.needsUpdate = true;
      const ar = hero.bow.arrow;
      ar.visible = !!p.draw;
      ar.position.set(nockX + 0.02, 0, 0);
      ar.userData.tip.material.emissiveIntensity = c >= 1 ? 0.9 + Math.sin(t * 20) * 0.3 : 0;
    } else if (rod && p.windup) {
      const pull = Math.min(1, p.windup.t / 0.5);
      sw.position.set(0.1, 0.5, 0.3);
      sw.rotation.set(0, 0, 0.9 + pull * 0.35 + Math.sin(t * 40) * 0.02 * pull);
    } else if (rod && fishing) {
      const k = fishing.phase === "cast" ? Math.min(1, fishing.t / C.CAST_TIME) : 1;
      const shake = fishing.phase === "bite" ? Math.sin(t * 60) * 0.06 : 0;
      sw.position.set(0.15, 0.45, 0.3);
      sw.rotation.set(0, 0, 0.9 - k * 1.8 + shake);      // swing from behind the head to out over the water
    } else if (rod && p.attack <= 0) {
      sw.position.set(0.1, 0.4 + Math.sin(t * 3) * 0.03, 0.4);
      sw.rotation.set(0, 0, -0.35 + Math.sin(t * 1.7) * 0.04);
    } else if (p.attack > 0 && p.gear && p.gear.weaponType === "blade" && p.lunge) {
      const k = p.swingK;
      const reach = k < 0.2 ? -0.1 - (k / 0.2) * 0.15 : k < 0.5 ? 0.6 : 0.6 - ((k - 0.5) / 0.5) * 0.45;
      sw.position.set(reach, 0.5, 0.18);
      sw.rotation.set(0, 0, -Math.PI / 2);
    } else if (p.attack > 0 && p.gear && p.gear.weaponType === "blade" && p.swingRel !== undefined) {
      const r = p.swingRel;
      sw.position.set(Math.cos(r) * 0.3, 0.5, Math.sin(r) * 0.3);
      sw.rotation.set(0, -r, -Math.PI / 2);
    } else if (p.attack > 0) {
      const windup = p.attack > C.ATTACK_TIME * 0.66;
      if (windup) { sw.position.set(-0.05, 0.75, 0.42); sw.rotation.set(0, 0, 0.7); }
      else { sw.position.set(0.5, 0.45, 0.2); sw.rotation.set(0, 0, -Math.PI / 2); }
    } else {
      sw.position.set(0.12, 0.5 + Math.sin(t * 3) * 0.05, 0.46);
      sw.rotation.set(0, 0, 0.15 + Math.sin(t * 1.7) * 0.06);
    }

    animateHands(p, t, dt);
    updateSwoosh(p);

    hero.shadow.visible = !p.swimming;
    hero.shadow.position.set(px, 0.01, pz);
    hero.shadow.scale.setScalar(1 - hz * 0.4);
    hero.ripple.visible = p.swimming;
    hero.ripple.position.set(px, WATER_Y + 0.01, pz);
    hero.ripple.scale.setScalar(1 + (t * 1.5 % 1) * 0.4);
    hero.ripple.material.opacity = 0.6 * (1 - (t * 1.5 % 1));

    // Slimes
    syncSet(s.slimes, slimeViews, makeSlime);
    for (const [o, v] of slimeViews) {
      const [x, z] = toWorld(o.x, o.y);
      const hop = o.hop > 0 ? Math.sin((1 - o.hop / 0.3) * Math.PI) : 0;
      v.group.position.set(x, hop * 0.45, z);
      const look = -Math.atan2(p.y - o.y, p.x - o.x);       // always face the hero
      v.yaw = v.yaw === undefined ? look : turn(v.yaw, look, dt, 10);
      v.group.rotation.y = v.yaw;
      const wob = Math.sin(t * 5 + o.x);
      v.body.scale.set(1 + (hop ? -0.12 : wob * 0.06), 1 + (hop ? 0.2 : -wob * 0.08), 1 + (hop ? -0.12 : wob * 0.06));
      v.mat.emissive.set(o.flash > 0 ? 0xffffff : 0x000000);
      v.shadow.position.set(x, 0.01, z);
      v.shadow.scale.setScalar(1 - hop * 0.3);
    }

    // Potions
    syncSet(s.potions, potionViews, makePotion);
    for (const [o, v] of potionViews) {
      const [x, z] = toWorld(o.x, o.y);
      v.group.position.set(x, 0.06 + Math.sin(t * 3 + o.x) * 0.06, z);
      v.group.rotation.y = t * 1.5 + o.x;
      v.shadow.position.set(x, 0.01, z);
    }

    // Arrows in flight (and stuck in trees)
    syncSet(s.arrows, arrowViews, makeArrowView);
    for (const [a, v] of arrowViews) {
      const [x, z] = toWorld(a.x - 4, a.y - 4);
      v.group.position.set(x, a.stuck > 0 ? 0.6 : 0.5, z);
      if (a.stuck <= 0) v.group.rotation.set(0, -Math.atan2(a.vy, a.vx), 0);
      v.shadow.position.set(x, 0.01, z);
      v.shadow.visible = a.stuck <= 0;
    }

    // Loot on the ground
    const lootByItem = new Map(s.loot.map(l => [l.item, l]));
    syncSet([...lootByItem.keys()], lootViews, makeLoot);
    for (const [item, v] of lootViews) {
      const l = lootByItem.get(item), [x, z] = toWorld(l.x, l.y);
      v.group.position.set(x, 0, z);
      v.gem.rotation.y = t * 2; v.gem.position.y = 0.3 + Math.sin(t * 3 + l.x) * 0.05;
      v.shadow.position.set(x, 0.01, z);
    }

    // Hit sparks: each new game effect bursts into a few tumbling octahedrons.
    for (const e of s.effects) {
      if (seenEffects.has(e)) continue;
      seenEffects.add(e);
      const [x, z] = toWorld(e.x - 4, e.y - 4);
      for (let i = 0; i < (e.big ? 10 : 5); i++) {
        const m = new THREE.Mesh(sparkGeo, e.big ? sparkMats.big : sparkMats.hit);
        const a = Math.random() * Math.PI * 2, sp = e.big ? 2.5 : 3.5;
        m.position.set(x, 0.4, z);
        m.userData = { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + Math.random() * 2, life: e.big ? 0.45 : 0.25 };
        scene.add(m); sparks.push(m);
      }
    }
    sparks = sparks.filter(m => {
      const u = m.userData;
      u.life -= dt; u.vy -= 12 * dt;
      m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt;
      m.rotation.x += dt * 10; m.rotation.y += dt * 8;
      if (u.life <= 0) { scene.remove(m); return false; }
      return true;
    });

    // Dash: dust puff on take-off, then fading afterimages.
    const dashing = p.dash > 0 || p.lungeActive;
    if (dashing && !wasDashing) puff(px, pz);
    wasDashing = dashing;
    if (dashing && (ghostTimer -= dt) <= 0) {
      ghostTimer = 0.03;
      const mat = basic(PAL.C, { transparent: true, opacity: 0.45, depthWrite: false });
      const ghost = hero.body.clone();
      ghost.traverse(o => { if (o.isMesh) o.material = mat; });
      const holder = new THREE.Group(); holder.add(ghost);
      holder.position.copy(hero.group.position); holder.rotation.copy(hero.group.rotation);
      scene.add(holder); ghosts.push({ holder, mat, life: 0.2 });
    }
    ghosts = ghosts.filter(g => {
      g.life -= dt; g.mat.opacity = 0.45 * Math.max(0, g.life / 0.2);
      if (g.life <= 0) { scene.remove(g.holder); g.mat.dispose(); return false; }
      return true;
    });

    // Aim marker on the ground, a short way out along the aim.
    reticle.position.set(px + Math.cos(p.aim) * 1.4, 0.02, pz + Math.sin(p.aim) * 1.4);
    reticle.rotation.y = -p.aim;
    reticle.visible = !p.swimming;

    updateFishing(p, t, dt);
    updateFish(dt, t, px, pz);

    // World animation and camera
    waterTex.offset.set((t * 0.06) % 1, (t * 0.03) % 1);
    camTarget.set(smooth(camTarget.x, px, dt, 8), 0, smooth(camTarget.z, pz, dt, 8));
    camera.position.copy(camTarget).add(CAM_OFFSET);
    camera.lookAt(camTarget);
    if (s.shake > 0.01) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s.shake * 0.35, 0, (Math.random() - 0.5) * s.shake * 0.35));
    renderer.render(scene, camera);
  }

  function snapCamera(x, y) {
    const [px, pz] = toWorld(x, y);
    camTarget.set(px, 0, pz);
  }

  // Screen point -> game pixel coordinates on the ground plane, or null if the ray misses it.
  const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function screenToGame(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    if (!ray.ray.intersectPlane(groundPlane, hit)) return null;
    return { x: hit.x * PX_PER_TILE, y: hit.z * PX_PER_TILE };
  }

  // Game pixel coordinates (cell top-left) plus a height -> CSS pixels on screen.
  const proj = new THREE.Vector3();
  function gameToScreen(x, y, height = 0) {
    const [wx, wz] = toWorld(x, y);
    proj.set(wx, height, wz).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (proj.x + 1) / 2 * r.width, y: r.top + (1 - proj.y) / 2 * r.height };
  }

  return { setMap, render, resize, snapCamera, screenToGame, gameToScreen };
}
