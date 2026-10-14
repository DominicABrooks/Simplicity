// What's for sale, on a market stall's counter or a shop's: each kind of goods' colours and shape.
import * as THREE from "three";
import type { Goods } from "../world/area.ts";
import type { RenderContext } from "./context.ts";

export const WARES: Record<Goods, { colors: string[]; make: (ctx: RenderContext, c: string) => THREE.Mesh }> = {
  produce: { colors: ["#c8423a", "#5fb04a", "#e8963a", "#a8c84a"], make: (ctx, c) => new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), ctx.lambert(c)) },
  bread: { colors: ["#c8964a", "#b07a3a", "#d9b46a"], make: (ctx, c) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.14, 2, 6), ctx.lambert(c)); m.rotation.z = Math.PI / 2; return m; } },
  cloth: { colors: ["#3f6fd0", "#8a4fc0", "#c8423a", "#f5d562"], make: (ctx, c) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), ctx.lambert(c)); m.rotation.z = Math.PI / 2; return m; } },
  pottery: { colors: ["#b8613a", "#a8473a", "#d08a5a"], make: (ctx, c) => new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 7), ctx.lambert(c)) },
  fish: { colors: ["#9fb4c8", "#7f96b0", "#c0ccd8"], make: (ctx, c) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), ctx.lambert(c)); m.scale.set(2.2, 0.6, 0.8); return m; } },
  flowers: { colors: ["#e85a8a", "#f5d562", "#ffffff", "#c8423a", "#8a4fc0"], make: (ctx, c) => new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), ctx.basic(c)) },
  // Joints and hams: dark red with a pale edge of fat.
  meat: { colors: ["#9a2f2a", "#b8473a", "#7a2420"], make: (ctx, c) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), ctx.lambert(c)); m.scale.set(1.4, 0.8, 1); return m; } },
};
