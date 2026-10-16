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
import { createPaper } from "./ui/paper.ts";
import { enterInterior, updateInterior } from "./game/interiors.ts";
import { enterTownsfolk, knock, updateTownsfolk } from "./game/townsfolk.ts";
import { updateChatter } from "./game/chatter.ts";
import { startPetting, updatePetting } from "./game/petting.ts";
import { startResting, updateResting } from "./game/resting.ts";
import { sleeping, startSleeping, updateSleeping, wake } from "./game/sleeping.ts";
import { cutscene, holdInput, skipCutscene, updateCutscene, watchCutscenes } from "./game/cutscene.ts";
import { createLetterbox } from "./ui/letterbox.ts";
import { createCredits } from "./ui/credits.ts";
import { watchEnding } from "./game/ending.ts";
import { createSleepShade } from "./ui/sleepShade.ts";
import { createFeyFade } from "./ui/feyFade.ts";
import { createFeySayings } from "./ui/feySayings.ts";
import { createErlSpeech } from "./ui/erlSpeech.ts";
import { enterPets } from "./game/pets.ts";
import { createAudioPlayer } from "./audio/player.ts";
import { exposeDebug } from "./debug.ts";
import { useCurio } from "./game/quay.ts";
import { followAcorn, holdForFey } from "./game/underhill.ts";

const g = createGame();
const view = createRenderer(byId<HTMLCanvasElement>("screen"), g);
const inventory = createInventoryView(g.inventory, bakeItemIcons(), {
  onDrop: item => dropItem(g, item),
  onUse: item => (item.curio ? (inventory.close(), useCurio(g, item)) : item.type === "acorn" ? (inventory.close(), followAcorn(g, item)) : eatItem(g, item)),   // a letter is read with the bag shut
});
const hud = createHud(g, view);
const labels = createLabels(g, view);
const resetBar = createResetBar(g);
const dialogue = createDialogue(g);
const paper = createPaper(g);
const letterbox = createLetterbox(g);
const sleepShade = createSleepShade(g, view);
const feyFade = createFeyFade(g);
const feySayings = createFeySayings(g);
const erlSpeech = createErlSpeech(g, view);
watchCutscenes(g);
watchEnding(g);
const credits = createCredits(g);
const audio = createAudioPlayer();
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
g.events.on("area", () => enterInterior(g));              // and inside a house, whoever's home
g.events.on("area", () => enterPets(g));                  // and the dogs and cats
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
// talking, a click or Enter, Space or E goes on, and Escape ends it. In a cutscene the same goes on through
// what's said, nothing else does anything, and Escape skips the scene.
const SAY_ON = ["enter", " ", "e", "j"];
const input = bindInput(g, {
  toggleInventory: inventory.toggle, toggleJournal, toggleMap: map.toggle, closePanels,
  talkClick: at => {
    if (sleeping(g)) { wake(g); return true; }              // asleep: a click wakes him, and does nothing else
    if (talking(g)) { advanceTalk(g); return true; }
    if (cutscene(g)) return true;
    const hit = pickTarget(g, view, at);
    return knock(g, hit) || startResting(g, hit) || startSleeping(g, hit) || startPetting(g, hit) || startTalk(g, hit);   // a door: knock; a campfire: sit by it; a tent or a bed: sleep; a dog or cat: pet it; someone: talk
  },
  talkKey: k => {
    if (sleeping(g)) { wake(g); return true; }              // and so does any key
    if (cutscene(g) && k === "escape") { skipCutscene(g); return true; }
    if (cutscene(g) && !talking(g)) return k === "e";       // nobody to talk to but who the scene says
    if (talking(g)) {
      if (k === "escape") { endTalk(g); return true; }
      if (SAY_ON.includes(k)) { advanceTalk(g); return true; }
      return false;
    }
    return k === "e" && (knock(g, g.target) || startResting(g, g.target) || startSleeping(g, g.target) || startPetting(g, g.target) || startTalk(g, g.target));
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
  holdInput(g);                                            // in a cutscene, nothing the player does moves the hero
  updateResting(g, dt);                                    // before the hero moves: anything he does gets him up
  updateSleeping(g, dt);                                   // and asleep, nothing held moves him
  holdForFey(g);                                           // nor while the fair folk have him (src/game/underhill.ts)
  step(g, dt);
  updateCutscene(g, dt);                                   // after: the scene walks him, and says where to look
  updateTalk(g, dt);
  updateTownsfolk(g, g.hitstop > 0 ? 0 : dt);
  updateInterior(g);
  updateChatter(g, g.hitstop > 0 ? 0 : dt);              // and people who know each other stop for a word
  updatePetting(g, g.hitstop > 0 ? 0 : dt);
  view.render(g, g.hitstop > 0 ? 0 : dt);
  audio.play(g.sfx, g.world.get(g.player, "transform"));
  menu.setActive(MENU.inventory, inventory.isOpen());
  menu.setActive(MENU.map, map.isOpen());
  menu.setActive(MENU.journal, journal.isOpen());
  map.draw();
  hud.draw(menu.width());
  labels.draw();
  sleepShade.draw();
  resetBar.draw();
  dialogue.draw();
  paper.draw();
  letterbox.draw();
  credits.draw(dt);
  feyFade.draw(dt);                                        // deep in a fairy ring, the screen's own furniture fades
  feySayings.draw();                                       // and the fair folk talk to him
  erlSpeech.draw();                                        // and under the hill, their king
  requestAnimationFrame(frame);
}

// Debug handle for the browser console in development, and for the end-to-end specs (e2e/) in their build.
if (import.meta.env.DEV || import.meta.env.MODE === "e2e") exposeDebug(g, view);

resize();
resetGame(g);
setState(g, "title");
requestAnimationFrame(frame);
