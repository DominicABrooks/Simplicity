// Simplicity: a tiny top-down fantasy RPG. Gameplay is 2D (src/game, src/systems); the 3D view only
// draws it. This file wires the pieces together and runs the loop.
import "./styles.css";
import { createGame, setState } from "./game/game.ts";
import { dropItem, eatItem } from "./game/actions.ts";
import { resetGame } from "./game/reset.ts";
import { bindInput } from "./input/input.ts";
import { createRenderer } from "./render/renderer.ts";
import { step } from "./systems/index.ts";
import { byId } from "./ui/dom.ts";
import { createHud } from "./ui/hud.ts";
import { createInventoryView } from "./ui/inventory.ts";
import { createLabels } from "./ui/labels.ts";
import { bindOverlay, bindToasts, createResetBar } from "./ui/screens.ts";
import { bakeItemIcons } from "./ui/sprites.ts";

const g = createGame();
const view = createRenderer(byId<HTMLCanvasElement>("screen"), g);
const inventory = createInventoryView(g.inventory, bakeItemIcons(), {
  onDrop: item => dropItem(g, item),
  onUse: item => eatItem(g, item),
});
const hud = createHud(g, view);
const labels = createLabels(g, view);
const resetBar = createResetBar(g);
bindOverlay(g);
bindToasts(g);
g.events.on("reset", () => inventory.close());
g.events.on("state", ({ state }) => { if (state === "dead") inventory.close(); });
const input = bindInput(g, {
  toggleInventory: inventory.toggle,
  closeInventory: inventory.close,
  inventoryOwns: inventory.owns,
});

function resize(): void {
  const pixelSize = Math.max(2, Math.round(innerHeight / 300));
  // UI panels measure in game pixels too, so they scale in step with the world, stepping down a
  // size when the inventory (about 205 x 136 game pixels) wouldn't fit the window.
  const ui = Math.max(1, Math.min(pixelSize, Math.floor((innerHeight - 32) / 205), Math.floor((innerWidth - 32) / 136)));
  document.documentElement.style.setProperty("--u", `${ui}px`);
  inventory.setScale(ui);
  view.resize(pixelSize);
  hud.resize(pixelSize);
}
addEventListener("resize", resize);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const mouse = input.mouse();
  g.input.pointer = mouse && view.screenToGame(mouse.x, mouse.y);
  step(g, dt);
  view.render(g, g.hitstop > 0 ? 0 : dt);
  hud.draw();
  labels.draw();
  resetBar.draw();
  requestAnimationFrame(frame);
}

// Debug handle for the browser console in development: simplicity.world, simplicity.hero(), ...
if (import.meta.env.DEV) {
  Object.assign(window, {
    simplicity: { game: g, view, world: g.world, hero: () => g.world.need(g.player, "transform"), critters: () => view.critters() },
  });
}

resize();
resetGame(g);
setState(g, "title");
requestAnimationFrame(frame);
