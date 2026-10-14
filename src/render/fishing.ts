// Fishing visuals: the cast marker while winding up, the line and bobber (arcing out, bobbing, then
// dipping on a bite), and the caught koi leaping from the water to the hero.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { FISHING } from "../data/player.ts";
import { TIERS } from "../data/tiers.ts";
import type { Actions, Transform } from "../game/components.ts";
import { GROUND, onGround, WATER_Y, col, toWorld, type RenderContext } from "./context.ts";
import { makeKoiMesh, type KoiMesh } from "./koi.ts";
import type { Body } from "./models/body.ts";

export interface FishingView {
  /** Returns where the bobber sits in the water (world X/Z), if it's in. */
  update(hero: Body, pos: Transform, a: Actions, t: number): { x: number; z: number } | null;
}

export function createFishingView(ctx: RenderContext, world: THREE.Group): FishingView {
  const { scene, lambert, basic, particles } = ctx;
  const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 9 }, () => new THREE.Vector3()));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: col(PAL.W), transparent: true, opacity: 0.8 }));
  const bobber = new THREE.Group();
  bobber.add(
    new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), lambert(PAL.R, { emissive: col(PAL.R), emissiveIntensity: 0.4 })),
    new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lambert(PAL.W)),
  );
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 10).rotateX(-Math.PI / 2), basic(PAL.W, { transparent: true, opacity: 0.7, depthWrite: false, ...onGround(GROUND.marker) }));
  const castMarker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 8).rotateX(-Math.PI / 2),
    basic(PAL.C, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, ...onGround(GROUND.marker) }));
  castMarker.visible = false;
  scene.add(line, bobber, splash, castMarker);
  line.visible = bobber.visible = splash.visible = false;
  let leaper: KoiMesh | null = null, leaperFor: unknown = null;
  const tipPos = new THREE.Vector3(), bobPos = new THREE.Vector3(), mid = new THREE.Vector3();

  return {
    update(hero, pos, a, t) {
      const w = a.windup;
      castMarker.visible = !!w;
      if (w) {
        const [mx, mz] = toWorld(w.x, w.y);
        castMarker.position.set(mx, (w.water ? WATER_Y : 0) + 0.02, mz);
        castMarker.material.color.set(w.water ? PAL.C : PAL.w);
        castMarker.material.opacity = w.water ? 0.9 : 0.45;
        castMarker.rotation.y = t * 2;
        castMarker.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
      }
      const f = a.fishing;
      const show = !!(f && hero.rodTip && hero.sword.visible);
      line.visible = bobber.visible = show;
      splash.visible = false;
      let bobberAt: { x: number; z: number } | null = null;
      if (f && hero.rodTip && show) {
        hero.group.updateMatrixWorld(true);
        hero.rodTip.getWorldPosition(tipPos);
        const [bx, bz] = toWorld(f.x, f.y);
        if (f.phase === "cast") {                            // arc from the rod tip to the water
          const k = Math.min(1, f.t / FISHING.castTime);
          bobPos.set(tipPos.x + (bx - tipPos.x) * k, tipPos.y + (WATER_Y - tipPos.y) * k + Math.sin(k * Math.PI) * 0.8, tipPos.z + (bz - tipPos.z) * k);
        } else {
          const dip = f.phase === "bite" ? -0.08 + Math.sin(t * 30) * 0.03 : Math.sin(t * 3) * 0.015;
          bobPos.set(bx, WATER_Y + 0.02 + dip, bz);
          bobberAt = { x: bx, z: bz };
          if (f.phase === "bite") {
            splash.visible = true;
            splash.position.set(bx, WATER_Y + 0.01, bz);
            const s = (t * 3) % 1;
            splash.scale.setScalar(1 + s * 2);
            splash.material.opacity = 0.7 * (1 - s);
          }
        }
        bobber.position.copy(bobPos);
        // Line sags between the tip and the bobber.
        const linePos = lineGeo.attributes.position!;
        for (let i = 0; i < 9; i++) {
          const k = i / 8;
          mid.lerpVectors(tipPos, bobPos, k);
          mid.y -= Math.sin(k * Math.PI) * (f.phase === "bite" ? 0.05 : 0.25);
          linePos.setXYZ(i, mid.x, mid.y, mid.z);
        }
        linePos.needsUpdate = true;
        lineGeo.computeBoundingSphere();
      }

      const c = a.catchAnim, age = c ? t - c.t0 : 99;
      if (c && age < 0.7) {
        const [sx, sz] = toWorld(c.x, c.y);
        if (leaperFor !== c) {
          if (leaper) world.remove(leaper);
          const T = TIERS[c.rarity];
          leaper = makeKoiMesh(ctx, T.fishMain, T.fishAccent);
          leaper.scale.setScalar(2.2);
          world.add(leaper);
          leaperFor = c;
          for (let i = 0; i < 8; i++) {                      // splash droplets
            const a2 = Math.random() * Math.PI * 2;
            particles.spawn("water", sx, WATER_Y, sz, Math.cos(a2) * 1.2, 2.5 + Math.random() * 1.5, Math.sin(a2) * 1.2, 0.45);
          }
        }
        const k = age / 0.7, [hx, hz] = toWorld(pos.x, pos.y);
        leaper!.position.set(sx + (hx - sx) * k, WATER_Y + Math.sin(k * Math.PI) * 1.6 + k * 0.6, sz + (hz - sz) * k);
        leaper!.rotation.set(0, -Math.atan2(hz - sz, hx - sx), Math.sin(t * 25) * 0.5 + k * 6);
      } else if (leaper) {
        world.remove(leaper);
        leaper = null;
        leaperFor = null;
      }
      return bobberAt;
    },
  };
}
