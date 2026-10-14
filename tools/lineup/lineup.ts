// A lineup of townsfolk outfits, one to a cell, for checking clothes by eye. Not part of the game.
// ?set=garment|over|head|carry|pattern|census  &cam=game|front|side|back|three|top  &pose=stand|walk&ph=0.25  &n=0 (census page)
import * as THREE from "three";
import { createContext } from "../../src/render/context.ts";
import { dressCommoner, makeBody } from "../../src/render/models/body.ts";
import type { Dress } from "../../src/world/wardrobe.ts";
import { area as capital } from "../../src/areas/capital.ts";
import { area as castle } from "../../src/areas/castle.ts";
import { area as kingsroad } from "../../src/areas/kingsroad.ts";
import { residentsOf } from "../../src/world/residents.ts";

const q = new URLSearchParams(location.search);
const set = q.get("set") ?? "garment", cam = q.get("cam") ?? "three", pose = q.get("pose") ?? "stand", page = Number(q.get("n") ?? 0);

const base: Dress = {
  garment: "tunic", pattern: "plain", cloth: "#5d6a7d", second: "#a83a2a", trim: "#4f3a2a", over: "none", head: "bare",
  hair: "#5a3a22", longHair: q.has("long"), hose: "#6b4f3a", feather: false, pouch: true, brooch: true, shoes: "#3a2e24", carry: "none",
};
const G = ["tunic", "long tunic", "smock", "doublet", "gown", "kirtle", "robe"] as const;
const VALUES: Record<string, Partial<Dress>[]> = {
  garment: G.map(garment => ({ garment })),
  over: ["apron", "cloak", "surcoat", "shawl", "tabard", "vest"].flatMap(over => (["tunic", "gown", "robe"] as const).map(garment => ({ over, garment }) as Partial<Dress>)),
  head: ["bare", "coif", "kerchief", "wimple", "veil", "cap", "chaperon", "hood", "straw", "felt"].flatMap(head => [{ head }, { head, feather: true, over: "cloak" }] as Partial<Dress>[]),
  carry: ["basket", "sack", "bundle", "staff", "bucket", "tools", "book", "flowers"].flatMap(carry => [{ carry }, { carry, garment: "robe", over: "cloak" }] as Partial<Dress>[]),
  pattern: ["plain", "parti", "banded"].flatMap(pattern => (["tunic", "gown", "doublet", "smock"] as const).map(garment => ({ pattern, garment }) as Partial<Dress>)),
};

let cells: { d: Dress; size: number; label: string }[];
if (set === "census") {
  const people = residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props });
  cells = people.slice(page * 30, page * 30 + 30).map(r => ({ d: r.dress, size: r.age < 14 ? 0.62 + (r.age / 14) * 0.25 : 1, label: `${r.job} ${r.age}` }));
} else cells = VALUES[set]!.map(v => ({ d: { ...base, ...v }, size: 1, label: Object.entries(v).map(([k, x]) => (k === "feather" ? "+feather" : x)).join(" ") }));

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(innerWidth, innerHeight, false);
renderer.setScissorTest(true);
document.body.style.cssText = "margin:0;background:#222;font:11px monospace;color:#fff";
renderer.domElement.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;display:block";
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x40384a, 1.5));
const sun = new THREE.DirectionalLight(0xffe2b0, 2.4); sun.position.set(-3, 6, 2); scene.add(sun);
const ctx = createContext(scene);
ctx.snap.value.set(100000, 100000);
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: "#6a7a5a" })));

const n = cells.length, cols = Math.ceil(Math.sqrt((n * innerWidth) / innerHeight)), rows = Math.ceil(n / cols);
const cw = Math.floor(innerWidth / cols), ch = Math.floor(innerHeight / rows);
const yaw = { front: -Math.PI / 2, side: 0, back: Math.PI / 2, three: -Math.PI / 4, game: -Math.PI / 2, top: -Math.PI / 4 }[cam] ?? 0;
const views = cells.map(({ d, size, label }, i) => {
  const b = makeBody(ctx);
  dressCommoner(ctx, b, d);
  b.sword.visible = false; b.ripple.visible = false;
  const x = i * 20;
  b.group.position.set(x, 0, 0); b.group.scale.setScalar(size); b.group.rotation.y = yaw;
  b.shadow.position.set(x, 0.02, 0);
  const ph = Number(q.get("ph") ?? 0.25) * Math.PI * 2;
  if (pose === "walk") {
    b.feet.forEach((f, k) => { f.position.x = b.footX + Math.sin(ph + k * Math.PI) * 0.09; });
    b.hands.forEach((h, k) => { h.position.set(0.12 + Math.sin(ph + k * Math.PI + Math.PI) * 0.06, 0.38, (k ? -1 : 1) * 0.42); });
    b.body.rotation.z = -0.06;
  } else {
    b.feet.forEach(f => { f.position.x = b.footX; });
    b.hands.forEach((h, k) => { h.position.set(0.14, 0.36, (k ? -1 : 1) * 0.4); });
  }
  const camera = new THREE.PerspectiveCamera(30, cw / ch, 0.1, 100);
  if (cam === "game") camera.position.set(x, 11.5, 8.5).sub(new THREE.Vector3(x, 0, 0)).setLength(4.2).add(new THREE.Vector3(x, 0.5, 0));
  else if (cam === "top") camera.position.set(x, 4, 0.01);
  else camera.position.set(x, 1.1, 3.4);
  camera.lookAt(x, 0.6, 0);
  const tag = document.createElement("div");
  tag.textContent = label;
  tag.style.cssText = `position:fixed;left:${(i % cols) * cw + 4}px;top:${Math.floor(i / cols) * ch + 2}px;text-shadow:0 0 2px #000`;
  document.body.appendChild(tag);
  return camera;
});
renderer.setAnimationLoop(() => {
  views.forEach((camera, i) => {
    const vx = (i % cols) * cw, vy = innerHeight - (Math.floor(i / cols) + 1) * ch;
    renderer.setViewport(vx, vy, cw, ch); renderer.setScissor(vx, vy, cw, ch);
    scene.background = new THREE.Color(i % 2 ? "#7a8a6a" : "#74846a");
    renderer.render(scene, camera);
  });
});
