// The hero on screen: the body follows the game state (walk, swim, jump, dash, polymorph, frozen),
// the weapon and floating hands animate per weapon, and the sword leaves a swoosh. Also the dash
// dust and afterimages, and the aim reticle.
import * as THREE from "three";
import { lerp, turn } from "../core/math.ts";
import { PAL } from "../data/palette.ts";
import { BOW, FISHING, JUMP_TIME, THRUST } from "../data/player.ts";
import type { Game } from "../game/game.ts";
import { heroParts, type HeroParts } from "../game/hero.ts";
import { WATER_Y, box, col, toWorld, type RenderContext } from "./context.ts";
import { dressBody, makeBody, type Body } from "./models/body.ts";

const SWOOSH_COLOR: Record<string, string> = { normal: PAL.W, magic: PAL.C, rare: PAL.Y };

export interface HeroView {
  body: Body;
  /** Pose the hero for this frame. Returns its world X/Z. */
  update(g: Game, t: number, dt: number): [number, number];
  /** Effects that trail the hero: dash dust and afterimages, and the aim reticle. */
  updateTrail(g: Game, dt: number): void;
}

export function createHeroView(ctx: RenderContext): HeroView {
  const { scene, lambert, basic, particles } = ctx;
  const hero = makeBody(ctx);
  let yaw = 0, punchSide = 0, lastAttack = 0;

  // ---------- Sword swoosh ----------
  // A flat arc from where the sweep began to where the blade is now, fading after the sweep.
  const swooshMat = basic(PAL.W, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const swoosh = new THREE.Mesh(new THREE.BufferGeometry(), swooshMat);
  swoosh.position.y = 0.5;
  hero.group.add(swoosh);
  function updateSwoosh(h: HeroParts): void {
    const a = h.actions, gear = h.hero.gear, k = a.swingK;
    const active = a.attack > 0 && gear?.weaponType === "blade" && k > 0.25 && k < 0.85;
    swoosh.visible = active;
    if (!active) return;
    const start = a.swingSide * 1.25, now = a.swingRel;
    const from = Math.min(-start, -now), len = Math.abs(now - start);
    if (len < 0.02) { swoosh.visible = false; return; }
    swoosh.geometry.dispose();
    swoosh.geometry = new THREE.RingGeometry(0.3, 0.95, 10, 1, from, len).rotateX(-Math.PI / 2);
    swooshMat.color.set(SWOOSH_COLOR[gear.weapon ?? "normal"] ?? PAL.W);
    swooshMat.opacity = k < 0.6 ? 0.45 : 0.45 * (1 - (k - 0.6) / 0.25);
  }

  // ---------- Hands ----------
  const grip = new THREE.Vector3(), handTarget = new THREE.Vector3();
  function animateHands(h: HeroParts, t: number, dt: number): void {
    const { motion: m, actions: a } = h, sw = hero.sword;
    // A new attack starts when the timer jumps up; alternate punching hands.
    if (a.attack > lastAttack + 1e-4) punchSide ^= 1;
    lastAttack = a.attack;
    hero.body.rotation.y = 0;
    hero.hands.forEach((hand, i) => {
      const side = i === 0 ? 1 : -1;
      // Resting: hovering at the sides, breathing with the body.
      let x = 0.12, y = 0.38 + Math.sin(t * 2.5 + i) * 0.02, z = side * 0.44;
      if (m.swimming) {                                      // paddle at the surface
        const p = t * 5 + i * Math.PI;
        x = 0.15 + Math.cos(p) * 0.12; y = 0.44 + Math.sin(p) * 0.05; z = side * 0.38;
      } else if (m.dash > 0) { x = -0.22; y = 0.45; }          // trail behind
      else if (m.jump > 0) { x = 0.05; y = 0.75; z = side * 0.42; }   // up in the air
      else if (m.moving) { x = 0.12 + Math.sin(t * 12 + i * Math.PI) * 0.12; y += Math.abs(Math.sin(t * 12)) * 0.04; }

      if (i === 1 && sw.visible && hero.bow && a.draw) {     // back hand pulls the bowstring
        sw.updateMatrix();
        hand.position.copy(grip.set(hero.bow.nockX - 0.02, 0, 0).applyMatrix4(sw.matrix));
        return;
      }
      if (i === 0 && sw.visible) {                           // front hand holds the weapon's grip
        sw.updateMatrix();
        hand.position.copy(grip.set(0, hero.gripY, 0).applyMatrix4(sw.matrix));
        return;
      }
      if (!sw.visible && a.attack > 0 && i === punchSide) {  // unarmed: punch
        const k = 1 - a.attack / THRUST.time;
        if (k < 0.34) { const u = k / 0.34; x = lerp(x, -0.06, u); y = lerp(y, 0.44, u); }          // pull back
        else if (k < 0.6) {                                                                          // jab
          const u = 1 - Math.pow(1 - (k - 0.34) / 0.26, 3);
          x = lerp(-0.06, 0.62, u); y = 0.47; z = lerp(z, side * 0.12, u);
          hero.body.rotation.y = side * 0.25 * u;          // twist into the punch
        } else { const u = (k - 0.6) / 0.4; x = lerp(0.62, x, u); y = lerp(0.47, y, u); z = lerp(side * 0.12, z, u); }
        hand.position.set(x, y, z);
        return;
      }
      hand.position.lerp(handTarget.set(x, y, z), 1 - Math.exp(-dt * 20));
    });
  }

  // ---------- Sheep (polymorph) ----------
  // A fluffy low-poly sheep: wool body and tufts, dark face and legs. Faces the way it walks.
  let sheep: THREE.Group | null = null, sheepBody: THREE.Group | null = null, sheepLegs: THREE.Mesh[] = [];
  let sheepYaw = 0, sheepLast: { x: number; z: number } | null = null, wasSheep = false;
  function buildSheep(): THREE.Group {
    sheep = new THREE.Group(); sheepBody = new THREE.Group();
    const wool = lambert(PAL.W), dark = lambert(PAL.k);
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0).scale(1.3, 0.9, 1), wool); body.position.y = 0.4;
    const tufts = [[-0.15, 0.62, 0.08], [0.08, 0.66, -0.06], [-0.05, 0.6, -0.16], [0.15, 0.58, 0.12]].map(([x, y, z]) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), wool); m.position.set(x!, y!, z!); return m;
    });
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0).scale(1.2, 1, 0.9), dark); head.position.set(0.4, 0.5, 0);
    const ears = [1, -1].map(s => { const m = new THREE.Mesh(box(0.06, 0.03, 0.12), dark); m.position.set(0.36, 0.56, s * 0.14); m.rotation.x = s * 0.4; return m; });
    const eyes = [1, -1].map(s => { const m = new THREE.Mesh(box(0.03, 0.03, 0.03), basic(PAL.W)); m.position.set(0.5, 0.53, s * 0.06); return m; });
    sheepLegs = [[0.18, 0.12], [0.18, -0.12], [-0.18, 0.12], [-0.18, -0.12]].map(([x, z]) => {
      const m = new THREE.Mesh(box(0.07, 0.24, 0.07), dark); m.position.set(x!, 0.12, z!); return m;
    });
    sheepBody.add(body, ...tufts, head, ...ears, ...eyes);
    sheep.add(sheepBody, ...sheepLegs);
    scene.add(sheep);
    return sheep;
  }
  function updateSheep(h: HeroParts, px: number, pz: number, t: number, dt: number): void {
    const { motion: m, status } = h, on = status.sheep > 0;
    if (!sheep && !on) return;
    const s = sheep ?? buildSheep();
    if (on !== wasSheep) {                                   // a puff of arcane sparks on change
      particles.burst(["arcaneLight", "arcane"], 12, px, 0.4, pz, 2, () => 1.5 + Math.random() * 2, 0.4);
      wasSheep = on;
      sheepLast = null;
    }
    s.visible = on && !(status.hurt > 0 && Math.floor(t * 16) % 2);
    if (!on) return;
    s.position.set(px, m.swimming ? -0.4 + Math.sin(t * 4) * 0.03 : 0, pz);
    if (sheepLast) {
      const dx = px - sheepLast.x, dz = pz - sheepLast.z;
      if (Math.hypot(dx, dz) > 0.002) sheepYaw = turn(sheepYaw, -Math.atan2(dz, dx), dt, 12);
    }
    sheepLast = { x: px, z: pz };
    s.rotation.y = sheepYaw;
    sheepBody!.position.y = m.moving ? Math.abs(Math.sin(t * 14)) * 0.06 : Math.sin(t * 2) * 0.01;   // trot
    sheepLegs.forEach((l, i) => { l.rotation.z = m.moving ? Math.sin(t * 14 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0; });
  }

  // ---------- Frozen and chilled ----------
  // Frozen: the hero sits inside a translucent block of ice. Chilled: snowflakes drift off them.
  let iceBlock: THREE.Mesh | null = null;
  function updateFrozen(h: HeroParts, px: number, pz: number, dt: number): void {
    if (!iceBlock) {
      iceBlock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0).scale(1, 1.35, 1),
        lambert(PAL.C, { transparent: true, opacity: 0.45, emissive: col(PAL.C), emissiveIntensity: 0.3, depthWrite: false }));
      scene.add(iceBlock);
    }
    iceBlock.visible = h.status.frozen > 0;
    iceBlock.position.set(px, 0.55, pz);
    iceBlock.rotation.y = 0.4;
    if (h.status.chill > 0 && Math.random() < dt * 12) {
      particles.spawn(Math.random() < 0.5 ? "ice" : "snow", px + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.6, pz + (Math.random() - 0.5) * 0.6, 0, 0.6, 0, 0.4);
    }
  }

  // ---------- Dash ----------
  let ghosts: { holder: THREE.Group; mat: THREE.MeshBasicMaterial; life: number }[] = [], ghostTimer = 0, wasDashing = false;
  const reticle = new THREE.Mesh(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.18, 0, 0), new THREE.Vector3(-0.1, 0, -0.14), new THREE.Vector3(-0.1, 0, 0.14)]),
    basic(PAL.Y, { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(reticle);

  return {
    body: hero,
    update(g, t, dt) {
      const h = heroParts(g), { pos, hero: stats, motion: m, status, actions: a } = h;
      const [px, pz] = toWorld(pos.x, pos.y);
      const hz = m.jump > 0 ? Math.sin((1 - m.jump / JUMP_TIME) * Math.PI) * 1.0 : 0;
      const swimY = m.swimming ? -0.48 + Math.sin(t * 4) * 0.03 : 0;
      hero.group.position.set(px, hz + swimY, pz);
      // Face the aim (locked to the swing direction mid-attack). Game angle a maps to yaw -a.
      yaw = turn(yaw, -(a.attack > 0 ? a.swingAim : m.aim), dt, 18);
      hero.group.rotation.y = yaw;
      hero.group.visible = !(status.hurt > 0 && Math.floor(t * 16) % 2) && !(status.sheep > 0);
      updateSheep(h, px, pz, t, dt);

      const gear = stats.gear;
      dressBody(ctx, hero, gear ?? {});
      const b = hero.body;
      b.position.y = 0; b.rotation.z = 0; b.scale.set(1, 1, 1);
      hero.feet.forEach(f => { f.position.x = hero.footX; f.visible = !m.swimming; });
      if (m.dash > 0) {
        b.rotation.z = -0.4; b.scale.set(1.15, 0.9, 0.9);    // lean hard into the dash
      } else if (m.jump > 0) {
        const squash = m.jump > JUMP_TIME * 0.8;
        b.scale.set(squash ? 1.25 : 0.88, squash ? 0.7 : 1.18, squash ? 1.25 : 0.88);
      } else if (m.moving && !m.swimming) {
        b.position.y = Math.abs(Math.sin(t * 12)) * 0.07;
        b.rotation.z = -0.1;
        hero.feet.forEach((f, i) => { f.position.x = hero.footX + Math.sin(t * 12 + i * Math.PI) * 0.1; });
      } else if (!m.swimming) {
        b.scale.y = 1 + Math.sin(t * 2.5) * 0.025;
      }
      const blink = t % 3 < 0.15;
      hero.eyes.forEach(e => { e.scale.y = blink ? 0.15 : 1; });

      // The weapon floats at the side, and poses per weapon and action.
      const sw = hero.sword, weapon = gear?.weaponType;
      sw.visible = !m.swimming && !!gear?.weapon;
      hero.ring.rotation.y = t * 1.8;                        // the ring orbits the hero
      hero.ring.position.y = Math.sin(t * 2.4) * 0.05;
      if (hero.bow) {
        const c = a.draw ? Math.min(1, a.draw.t / BOW.drawTime) : 0;
        if (a.draw) { sw.position.set(0.42, 0.5, 0.06); sw.rotation.set(0, 0, 0); }      // held out toward the aim
        else { sw.position.set(0.08, 0.45, 0.48); sw.rotation.set(0, 0, -0.25 + Math.sin(t * 1.7) * 0.04); }
        // Pull the string back to the nock; the nocked arrow rides on it.
        const nockX = -0.03 - 0.3 * c;
        hero.bow.nockX = nockX;
        const sp = hero.bow.string.geometry.attributes.position!;
        sp.setX(1, nockX); sp.needsUpdate = true;
        const ar = hero.bow.arrow;
        ar.visible = !!a.draw;
        ar.position.set(nockX + 0.02, 0, 0);
        ar.userData.tip.material.emissiveIntensity = c >= 1 ? 0.9 + Math.sin(t * 20) * 0.3 : 0;
      } else if (weapon === "rod" && a.windup) {
        const pull = Math.min(1, a.windup.t / 0.5);
        sw.position.set(0.1, 0.5, 0.3);
        sw.rotation.set(0, 0, 0.9 + pull * 0.35 + Math.sin(t * 40) * 0.02 * pull);
      } else if (weapon === "rod" && a.fishing) {
        const f = a.fishing;
        const k = f.phase === "cast" ? Math.min(1, f.t / FISHING.castTime) : 1;
        const shake = f.phase === "bite" ? Math.sin(t * 60) * 0.06 : 0;
        sw.position.set(0.15, 0.45, 0.3);
        sw.rotation.set(0, 0, 0.9 - k * 1.8 + shake);       // swing from behind the head to out over the water
      } else if (weapon === "rod" && a.attack <= 0) {
        sw.position.set(0.1, 0.4 + Math.sin(t * 3) * 0.03, 0.4);
        sw.rotation.set(0, 0, -0.35 + Math.sin(t * 1.7) * 0.04);
      } else if (a.attack > 0 && weapon === "blade") {
        const r = a.swingRel;
        sw.position.set(Math.cos(r) * 0.3, 0.5, Math.sin(r) * 0.3);
        sw.rotation.set(0, -r, -Math.PI / 2);
      } else if (a.attack > 0) {
        if (a.attack > THRUST.time * 0.66) { sw.position.set(-0.05, 0.75, 0.42); sw.rotation.set(0, 0, 0.7); }   // wind up
        else { sw.position.set(0.5, 0.45, 0.2); sw.rotation.set(0, 0, -Math.PI / 2); }                           // thrust
      } else {
        sw.position.set(0.12, 0.5 + Math.sin(t * 3) * 0.05, 0.46);
        sw.rotation.set(0, 0, 0.15 + Math.sin(t * 1.7) * 0.06);
      }

      animateHands(h, t, dt);
      updateSwoosh(h);

      hero.shadow.visible = !m.swimming;
      hero.shadow.position.set(px, 0.01, pz);
      hero.shadow.scale.setScalar(1 - hz * 0.4);
      hero.ripple.visible = m.swimming;
      hero.ripple.position.set(px, WATER_Y + 0.01, pz);
      hero.ripple.scale.setScalar(1 + ((t * 1.5) % 1) * 0.4);
      hero.ripple.material.opacity = 0.6 * (1 - ((t * 1.5) % 1));
      updateFrozen(h, px, pz, dt);
      return [px, pz];
    },

    updateTrail(g, dt) {
      const { pos, motion: m, status } = heroParts(g);
      const [px, pz] = toWorld(pos.x, pos.y);
      // Dash: dust puff on take-off, then fading afterimages.
      const dashing = m.dash > 0;
      if (dashing && !wasDashing) particles.burst("dust", 6, px, 0.08, pz, 1.5, () => 1 + Math.random(), 0.3);
      wasDashing = dashing;
      if (dashing && (ghostTimer -= dt) <= 0) {
        ghostTimer = 0.03;
        const mat = basic(PAL.C, { transparent: true, opacity: 0.45, depthWrite: false });
        const ghost = hero.body.clone();
        ghost.traverse(o => { if (o instanceof THREE.Mesh) o.material = mat; });
        const holder = new THREE.Group(); holder.add(ghost);
        holder.position.copy(hero.group.position); holder.rotation.copy(hero.group.rotation);
        scene.add(holder);
        ghosts.push({ holder, mat, life: 0.2 });
      }
      ghosts = ghosts.filter(gh => {
        gh.life -= dt;
        gh.mat.opacity = 0.45 * Math.max(0, gh.life / 0.2);
        if (gh.life > 0) return true;
        scene.remove(gh.holder);
        gh.mat.dispose();
        return false;
      });
      // Aim marker on the ground, a short way out along the aim.
      reticle.position.set(px + Math.cos(m.aim) * 1.4, 0.02, pz + Math.sin(m.aim) * 1.4);
      reticle.rotation.y = -m.aim;
      reticle.visible = !m.swimming && !(status.sheep > 0);
    },
  };
}
