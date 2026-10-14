// Simplicity: a tiny top-down fantasy RPG. Gameplay is 2D (src/game, src/systems); the 3D view only
// draws it. This file wires the pieces together and runs the loop.
import "./styles.css";
import { createGame, setState, toast } from "./game/game.ts";
import { dropItem, eatItem } from "./game/actions.ts";
import { resetGame } from "./game/reset.ts";
import { bindInput } from "./input/input.ts";
import { pickTarget, updateTarget } from "./input/targeting.ts";
import { createRenderer } from "./render/renderer.ts";
import { step } from "./systems/index.ts";
import { byId } from "./ui/dom.ts";
import { createHud } from "./ui/hud.ts";
import { createInventoryView } from "./ui/inventory.ts";
import { createLabels } from "./ui/labels.ts";
import { bindFade, bindOverlay, bindToasts, createResetBar } from "./ui/screens.ts";
import { loadArea } from "./areas/index.ts";
import { arrive } from "./game/travel.ts";
import { bakeItemIcons } from "./ui/sprites.ts";
import { createJournal } from "./ui/journal.ts";
import { createMenuBar } from "./ui/menuBar.ts";
import { createMapView } from "./ui/mapView.ts";
import { FEATURES } from "./data/features.ts";
import { advanceTalk, endTalk, startTalk, talking, updateTalk } from "./game/talk.ts";
import { createDialogue } from "./ui/dialogue.ts";
import { enterTownsfolk, updateTownsfolk } from "./game/townsfolk.ts";

const g = createGame();
const view = createRenderer(byId<HTMLCanvasElement>("screen"), g);
const inventory = createInventoryView(g.inventory, bakeItemIcons(), {
  onDrop: item => dropItem(g, item),
  onUse: item => eatItem(g, item),
});
const hud = createHud(g, view);
const labels = createLabels(g, view);
const resetBar = createResetBar(g);
const dialogue = createDialogue(g);
bindOverlay(g);
bindToasts(g);
bindFade(g);
const MENU = { inventory: 0, map: 1, journal: 2 } as const;
const menu = createMenuBar([
  { icon: "bag", label: "Inventory", key: "I", onClick: () => inventory.toggle() },
  { icon: "map", label: "Map", key: "M", onClick: () => map.toggle() },
  { icon: "book", label: "Journal", key: "L", onClick: () => journal.toggle(), ...(FEATURES.journal ? {} : { disabled: "Coming Soon" }) },
]);
const map = createMapView(g);
// The journal still loads and saves kill counts while it's switched off, so nothing is lost.
const journal = createJournal(g, unread => menu.setAlert(MENU.journal, unread && FEATURES.journal));
const toggleJournal = () => { if (FEATURES.journal) journal.toggle(); };
const closePanels = () => { inventory.close(); journal.close(); map.close(); };
g.events.on("reset", () => inventory.close());
g.events.on("area", () => enterTownsfolk(g));             // the townsfolk come out onto the streets
g.events.on("state", ({ state }) => { if (state === "dead") closePanels(); });

// Walking into a cave: fade out, load the next area (its module is downloaded on the first visit),
// arrive, fade back in. The fade takes at least TRAVEL_FADE ms, so it reads even when loading is instant.
const TRAVEL_FADE = 300;
g.events.on("state", ({ state }) => {
  const to = g.travel;
  if (state !== "travel" || !to) return;
  closePanels();
  Promise.all([loadArea(to.area), new Promise(r => setTimeout(r, TRAVEL_FADE))])
    .then(([def]) => arrive(g, def))
    .catch(err => {
      // Couldn't get there (say the connection dropped): step back out of the exit and stay put.
      console.error(err);
      const here = g.area.layout.entries, back = Object.keys(here)[0]!;
      const p = g.world.need(g.player, "transform");
      Object.assign(p, here[back]);
      g.travel = null;
      setState(g, "play");
      toast(g, "The way is blocked");
    });
});
// Talking: clicking someone friendly (or E with them targeted) talks instead of attacking; while they're
// talking, a click or Enter, Space or E goes on, and Escape ends it.
const SAY_ON = ["enter", " ", "e", "j"];
const input = bindInput(g, {
  toggleInventory: inventory.toggle, toggleJournal, toggleMap: map.toggle, closePanels,
  talkClick: at => { if (talking(g)) { advanceTalk(g); return true; } return startTalk(g, pickTarget(g, view, at)); },
  talkKey: k => {
    if (talking(g)) {
      if (k === "escape") { endTalk(g); return true; }
      if (SAY_ON.includes(k)) { advanceTalk(g); return true; }
      return false;
    }
    return k === "e" && startTalk(g, g.target);
  },
});

function resize(): void {
  const pixelSize = Math.max(2, Math.round(innerHeight / 300));
  // UI panels measure in game pixels too, so they scale in step with the world, stepping down a
  // size when the inventory (about 205 x 136 game pixels) or the journal (about 290 x 220) wouldn't fit.
  const ui = Math.max(1, Math.min(pixelSize, Math.floor((innerHeight - 32) / 220), Math.floor((innerWidth - 32) / 290)));
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
  updateTarget(g, view, mouse, input.overUi());
  step(g, dt);
  updateTalk(g, dt);
  updateTownsfolk(g, g.hitstop > 0 ? 0 : dt);
  view.render(g, g.hitstop > 0 ? 0 : dt);
  menu.setActive(MENU.inventory, inventory.isOpen());
  menu.setActive(MENU.map, map.isOpen());
  menu.setActive(MENU.journal, journal.isOpen());
  map.draw();
  hud.draw(menu.width());
  labels.draw();
  resetBar.draw();
  dialogue.draw();
  requestAnimationFrame(frame);
}

// Debug handle for the browser console in development: simplicity.world, simplicity.hero(), ...
if (import.meta.env.DEV) {
  Object.assign(window, {
    simplicity: { game: g, view, world: g.world, hero: () => g.world.need(g.player, "transform"), critters: () => view.critters(), memory: () => view.memory() },
  });
}

resize();
resetGame(g);
setState(g, "title");
requestAnimationFrame(frame);
