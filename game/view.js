// Simplicity 3D view: renders the 2D game state as a low-poly PS1-era scene.
// Gameplay never reads from here. One tile = one world unit; game x -> world X, game y -> world Z.
import * as THREE from "three";

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
  const clothTex = paint(16, 16, (g) => {
    g.fillStyle = PAL.B; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL.b; for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
    g.fillStyle = "#5d8ae0"; for (let x = 3; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
    g.fillStyle = PAL.Y; g.fillRect(0, 13, 16, 2);       // gold hem trim (bottom of the lathe)
  }, true);
  const mantleTex = paint(16, 16, (g) => {
    g.fillStyle = PAL.b; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL.Y; g.fillRect(0, 12, 16, 3);
    g.fillStyle = PAL.O; for (let x = 1; x < 16; x += 4) g.fillRect(x, 13, 1, 1);
  }, true);
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
    world.add(new THREE.Mesh(quadGeometry(water), lambert("#ffffff", { map: waterTex, transparent: true, opacity: 0.82, ...side })));

    // Ground beyond the map edge: four strips around it, so they never cover the sunken water.
    const R = 60, outerMat = lambert("#ffffff", { map: grassTex, ...side });
    const strip = (x0, z0, x1, z1) => ({ p: [[x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0]], uv: [[x0 / 4, z0 / 4], [x0 / 4, z1 / 4], [x1 / 4, z1 / 4], [x1 / 4, z0 / 4]] });
    world.add(new THREE.Mesh(quadGeometry([
      strip(-R, -R, W + R, 0), strip(-R, H, W + R, H + R), strip(-R, 0, 0, H), strip(W, 0, W + R, H),
    ]), outerMat));

    // Trees: three instanced parts so ~300 trees cost three draw calls.
    const parts = [
      [new THREE.CylinderGeometry(0.11, 0.17, 0.62, 5).translate(0, 0.31, 0), lambert("#ffffff", { map: barkTex })],
      [new THREE.IcosahedronGeometry(0.52, 0).translate(0, 0.92, 0), lambert("#ffffff", { map: leafTex })],
      [new THREE.IcosahedronGeometry(0.36, 0).translate(0.08, 1.34, 0.04), lambert("#ffffff", { map: leafTex })],
    ];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const [geo, mat] of parts) {
      const inst = new THREE.InstancedMesh(geo, mat, trees.length);
      trees.forEach(([x, z], i) => {
        const k = 0.85 + ((x * 7.3 + z * 3.1) % 1) * 0.35;
        q.setFromAxisAngle(up, (x * 1.7 + z * 2.3) % (Math.PI * 2));
        m.compose(new THREE.Vector3(x, 0, z), q, s.set(k, k, k));
        inst.setMatrixAt(i, m);
        const shade = 0.8 + ((x * 3.7 + z * 5.9) % 1) * 0.35;
        inst.setColorAt(i, new THREE.Color(shade, shade, shade));
      });
      world.add(inst);
    }
  }

  // ---------- Models ----------
  const shadowGeo = new THREE.CircleGeometry(0.34, 8).rotateX(-Math.PI / 2);
  const shadowMat = basic("#000000", { transparent: true, opacity: 0.35, depthWrite: false });
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  function makeWanderer() {
    const group = new THREE.Group(), body = new THREE.Group(), sword = new THREE.Group();
    group.add(body, sword);
    const lathe = (pts, mat) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 7), mat);
    body.add(lathe([[0.42, 0], [0.4, 0.1], [0.3, 0.38], [0.18, 0.56]], lambert("#ffffff", { map: clothTex })));
    const mantle = lathe([[0.38, 0.44], [0.34, 0.52], [0.2, 0.64]], lambert("#ffffff", { map: mantleTex }));
    body.add(mantle);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.31, 7, 5), lambert("#ffffff", { map: clothTex }));
    hood.position.set(0, 0.8, 0); hood.scale.set(1, 0.95, 1);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), lambert(PAL.B));
    tip.position.set(-0.2, 1.04, 0); tip.rotation.z = 1.1;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), basic(PAL.k));
    face.position.set(0.21, 0.77, 0); face.scale.set(0.6, 0.85, 0.95);
    const eyeMat = basic(PAL.Y);
    const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(box(0.05, 0.1, 0.06), eyeMat); e.position.set(0.34, 0.79, s * 0.075); return e; });
    const feet = [-1, 1].map(s => { const f = new THREE.Mesh(box(0.18, 0.08, 0.12), lambert(PAL.n)); f.position.set(0.3, 0.04, s * 0.13); return f; });
    body.add(hood, tip, face, ...eyes, ...feet);

    const gold = lambert(PAL.Y), blade = lambert(PAL.W, { emissive: col(PAL.C), emissiveIntensity: 0.25 });
    const parts = [[box(0.05, 0.62, 0.12), blade, 0.45], [box(0.08, 0.06, 0.32), gold, 0.12], [box(0.05, 0.16, 0.05), lambert(PAL.N), 0.02], [box(0.08, 0.08, 0.08), gold, -0.08]];
    for (const [g, m, y] of parts) { const p = new THREE.Mesh(g, m); p.position.y = y; sword.add(p); }

    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = 0.01;
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.5, 10).rotateX(-Math.PI / 2), basic(PAL.C, { transparent: true, opacity: 0.6, depthWrite: false }));
    scene.add(group, shadow, ripple);
    return { group, body, sword, eyes, feet, shadow, ripple };
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

  const hero = makeWanderer();
  const reticle = new THREE.Mesh(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.18, 0, 0), new THREE.Vector3(-0.1, 0, -0.14), new THREE.Vector3(-0.1, 0, 0.14)]),
    basic(PAL.Y, { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(reticle);
  const slimeViews = new Map(), potionViews = new Map();
  const sparkGeo = new THREE.OctahedronGeometry(0.07, 0);
  const sparkMats = { hit: basic(PAL.Y), big: basic(PAL.G) };
  let sparks = [];
  const seenEffects = new WeakSet();

  function syncSet(list, views, make) {
    const alive = new Set(list);
    for (const [o, v] of views) if (!alive.has(o)) { scene.remove(v.group, v.shadow); views.delete(o); }
    for (const o of list) if (!views.has(o)) views.set(o, make());
  }

  const toWorld = (x, y) => [(x + 4) / PX_PER_TILE, (y + 4) / PX_PER_TILE];
  const smooth = (cur, target, dt, k) => cur + (target - cur) * (1 - Math.exp(-dt * k));
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
    const diff = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
    yaw += diff * (1 - Math.exp(-dt * 18));
    hero.group.rotation.y = yaw;
    hero.group.visible = !(p.hurt > 0 && Math.floor(t * 16) % 2);

    const b = hero.body;
    b.position.y = 0; b.rotation.z = 0; b.scale.set(1, 1, 1);
    hero.feet.forEach((f, i) => { f.position.x = 0.3; f.visible = !p.swimming; });
    if (p.jump > 0) {
      const squash = p.jump > C.JUMP_TIME * 0.8;
      b.scale.set(squash ? 1.25 : 0.88, squash ? 0.7 : 1.18, squash ? 1.25 : 0.88);
    } else if (p.moving && !p.swimming) {
      b.position.y = Math.abs(Math.sin(t * 12)) * 0.07;
      b.rotation.z = -0.1;
      hero.feet.forEach((f, i) => { f.position.x = 0.3 + Math.sin(t * 12 + i * Math.PI) * 0.1; });
    } else if (!p.swimming) {
      b.scale.y = 1 + Math.sin(t * 2.5) * 0.025;
    }
    const blink = (t % 3) < 0.15;
    hero.eyes.forEach(e => { e.scale.y = blink ? 0.15 : 1; });

    // Sword: floats at the side, winds up, then thrusts forward (matches the 2D hit timing).
    const sw = hero.sword;
    sw.visible = !p.swimming;
    if (p.attack > 0) {
      const windup = p.attack > C.ATTACK_TIME * 0.66;
      if (windup) { sw.position.set(-0.05, 0.75, 0.42); sw.rotation.set(0, 0, 0.7); }
      else { sw.position.set(0.5, 0.45, 0.2); sw.rotation.set(0, 0, -Math.PI / 2); }
    } else {
      sw.position.set(0.12, 0.5 + Math.sin(t * 3) * 0.05, 0.46);
      sw.rotation.set(0, 0, 0.15 + Math.sin(t * 1.7) * 0.06);
    }

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
      v.group.rotation.y = o.face > 0 ? 0 : Math.PI;
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

    // Aim marker on the ground, a short way out along the aim.
    reticle.position.set(px + Math.cos(p.aim) * 1.4, 0.02, pz + Math.sin(p.aim) * 1.4);
    reticle.rotation.y = -p.aim;
    reticle.visible = !p.swimming;

    // World animation and camera
    waterTex.offset.set((t * 0.06) % 1, (t * 0.03) % 1);
    camTarget.set(smooth(camTarget.x, px, dt, 8), 0, smooth(camTarget.z, pz, dt, 8));
    camera.position.copy(camTarget).add(CAM_OFFSET);
    camera.lookAt(camTarget);
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

  return { setMap, render, resize, snapCamera, screenToGame };
}
