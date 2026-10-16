// The debug handle, on `window.simplicity`: in development for the browser console (simplicity.hero(), ...),
// and in the end-to-end build (`vite build --mode e2e`) for the Playwright specs in e2e/ to read the game
// and set a scene up. Never in the published game: main.ts only calls this behind those two flags.
import { AREA_IDS, loadArea } from "./areas/index.ts";
import { STARTER_KIT } from "./data/items.ts";
import { LAIRS, type Lair, type LairName } from "./game/lairs.ts";
import { isFrozen, isGod, setFrozen, setGod } from "./game/cheats.ts";
import { setState, type Game } from "./game/game.ts";
import { HOMECOMING } from "./data/ending.ts";
import { CALDER_FIGHT, CALDERS_HEAD } from "./data/rift.ts";
import { T } from "./data/world.ts";
import { bossSystem } from "./game/bosses.ts";
import { calderFightSystem } from "./game/calderfight.ts";
import { crowdOf } from "./game/crowd.ts";
import { skipCutscene, startCutscene } from "./game/cutscene.ts";
import { endTalk } from "./game/talk.ts";
import { isCommoner, loadCensus, walkersOf } from "./game/townsfolk.ts";
import { deathSystem } from "./systems/enemies.ts";
import { cinderFightSystem } from "./game/cinderfight.ts";
import { rimeFightSystem } from "./game/rimefight.ts";
import { laidToRest } from "./game/ghost.ts";
import { landGreatKoi } from "./game/greatkoi.ts";
import { takeBow } from "./game/hunterhut.ts";
import { passBarricade } from "./game/watchword.ts";
import { passYssa } from "./game/yssa.ts";
import { showEndCard } from "./ui/credits.ts";
import { creditsFrom } from "./game/credits.ts";
import type { ShotId } from "./data/ending.ts";
import { hauntingOf } from "./game/ghost.ts";
import { startEerie } from "./game/eerie.ts";
import type { EerieId } from "./data/eerie.ts";
import { isDoor, whoIsHome } from "./game/townsfolk.ts";
import { resetGame } from "./game/reset.ts";
import { makeItem } from "./items/items.ts";
import { enterArea } from "./game/travel.ts";
import { ZONES } from "./game/zones.ts";
import { layoutOf } from "./world/layouts.ts";
import type { KitPiece } from "./data/items.ts";
import type { Renderer } from "./render/renderer.ts";

export function exposeDebug(g: Game, view: Renderer): void {
  /** Level him and dress him: `kit` worn, `bag` and the rest of the starter kit in the bag, at full health. */
  function kitOut(ready: { level: number; kit: readonly KitPiece[]; bag?: readonly KitPiece[] }): void {
    Object.assign(g.world.need(g.player, "hero"), { level: ready.level, xp: 0 });
    const kit = ready.kit.map(([type, rarity, mods, name]) => makeItem(type, rarity, { ...mods }, name));
    const bag = (ready.bag ?? []).map(([type, rarity, mods, name]) => makeItem(type, rarity, { ...mods }, name));
    g.inventory.reset(kit);                                  // worn, and the level's raw stats with it
    for (const item of bag) g.inventory.add(item);
    for (const [type, name] of STARTER_KIT) if (![...kit, ...bag].some(k => k.type === type)) g.inventory.add(makeItem(type, "normal", {}, name));
    const health = g.world.need(g.player, "health");
    health.hp = health.maxHp;
  }
  /** A fresh run, straight into a boss's lair and face to face with them, at the level and in the gear a player
   *  would have by then (the rest of the starter kit, and anything else they'd be carrying, in the bag). */
  async function boss(who: string = "cinder"): Promise<string> {
    const lair = Object.hasOwn(LAIRS, who) ? LAIRS[who as LairName] : null;
    if (!lair) return `No boss "${who}". Try: ${Object.keys(LAIRS).join(", ")}`;
    const def = await loadArea(lair.area);
    resetGame(g);
    setState(g, "play");
    enterArea(g, def, lair.entry);
    const ready: Lair["ready"] = lair.ready;
    kitOut(ready);
    const health = g.world.need(g.player, "health");
    Object.assign(g.world.need(g.player, "transform"), lair.stage(g));
    return `${who}: level ${lair.ready.level}, ${health.maxHp} hearts; god ${isGod(g) ? "on" : "off"}, freeze ${isFrozen(g) ? "on" : "off"}`;
  }
  /**
   * The end of the story path (src/game/ending.ts), from any point along it: a fresh run with Calder beaten for real
   * (his fight started, his health at nothing, the crack shut), his head in the bag, and then on to the stage asked for:
   * "stone" (by the glowing rift stone), "home" (at the fountain stone at dawn), "castle" (in at the castle gate, a
   * crowd behind him), "king" (a few steps from the King on the keep steps: the scene starts), "credits", or "card"
   * (after The End). `crowd` is how many follow him (castle and on). `full`: the rest of the run done too, for the
   * credits to show it all: Cinder and Rime beaten for real, the barricade and both of Yssa's words passed, the King's
   * audience heard, the hunter's bow taken, the Great Koi landed and the Grey Ringer laid to rest. `shot`: the credits
   * start from that shot (greyed, slimes, chronicle, eggs, hatch, rime, ringer, milk, fells).
   */
  async function ending(stage: string = "stone", crowd = 8, full = false, shot?: string): Promise<string> {
    const STAGES = ["stone", "home", "castle", "king", "credits", "card"];
    if (!STAGES.includes(stage)) return `No stage "${stage}". Try: ${STAGES.join(", ")}`;
    await boss("calder");
    if (full) {
      g.state = "travel";                                    // held still meanwhile: no fight gets going behind his back

      passBarricade(g); passYssa(g, "name"); passYssa(g, "river"); takeBow(g); laidToRest(g); landGreatKoi(g, 0, 0);
      for (const who of ["cinder", "rime"] as const) {
        const lair = LAIRS[who];
        enterArea(g, await loadArea(lair.area), lair.entry);
        Object.assign(g.world.need(g.player, "transform"), lair.stage(g));
        (who === "cinder" ? cinderFightSystem : rimeFightSystem)(g, 1 / 60);
        const them = g.world.query("renderable", "health").find(([, c]) => c.renderable.kind === who);
        if (!them) return `${who} didn't come`;
        them[1].health.hp = 0;
        bossSystem(g, 1 / 60);
        deathSystem(g);
        endTalk(g);
      }
      enterArea(g, await loadArea("throneroom"), "door");      // his audience, heard
      skipCutscene(g);
      endTalk(g);
      const lair = LAIRS.calder;
      enterArea(g, await loadArea(lair.area), lair.entry);
      Object.assign(g.world.need(g.player, "transform"), lair.stage(g));
      g.state = "play";
    }
    const dt = 1 / 60;
    calderFightSystem(g, dt);                                // he's close enough: the fight starts
    const calder = g.world.query("renderable", "health").find(([, c]) => c.renderable.kind === "calder");
    if (!calder) return "Calder didn't come";
    calder[1].health.hp = 0;
    bossSystem(g, dt);
    deathSystem(g);
    calderFightSystem(g, dt);
    calderFightSystem(g, CALDER_FIGHT.crack.shut);           // and the crack groans shut
    endTalk(g);
    for (const [e, { pickup }] of g.world.query("pickup")) if (pickup.kind === "loot" && pickup.item.name === CALDERS_HEAD[3]) g.world.destroy(e);
    g.inventory.add(makeItem(...CALDERS_HEAD));
    const hero = g.world.need(g.player, "transform");
    if (stage === "stone") {
      Object.assign(hero, g.area.layout.entries.stone);      // on the trail, a couple of steps below it
      return "By the rift stone: walk onto it";
    }
    g.hour = HOMECOMING.dawn;
    if (stage === "home") { enterArea(g, await loadArea("capital"), "stone"); return "Home at dawn: up the high street to Castle Street"; }
    // Grown-ups of the Market Quarter fall in behind him, and come with him into the castle.
    const people = await loadCensus();
    crowdOf(g).following = walkersOf(people, "capital").filter(r => r.age >= 14 && isCommoner(r)).slice(0, crowd).map(r => r.id);
    enterArea(g, await loadArea("castle"), "town");
    if (stage === "castle") return `At the castle gate, ${crowd} behind him: up to the keep steps`;
    const king = g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "king")![1].transform;
    Object.assign(hero, { x: king.x, y: king.y + 8 * T });   // near enough that the scene starts
    if (stage === "king") return "A few steps from the King";
    if (shot) creditsFrom(g, shot as ShotId);               // the credits from that shot on
    startCutscene(g, "homecoming");
    skipCutscene(g);                                         // the head laid down, and the credits begin
    if (stage === "card") showEndCard();
    return stage === "card" ? "After The End" : "The credits";
  }
  /** A fresh run, arriving in an area the way a player would usually come in (or by `entry`), at the level and in the
   *  gear they'd have by then, with the gates behind them open (src/game/zones.ts). */
  /** Set the time of day (any number: it wraps round to 0-24). */
  function setHour(h: number): number {
    g.hour = ((h % 24) + 24) % 24;
    return g.hour;
  }
  async function area(id: string = "witchwood", entry?: string): Promise<string> {
    if (!AREA_IDS.includes(id)) return `No area "${id}". Try: ${AREA_IDS.join(", ")}`;
    const def = await loadArea(id), zone = ZONES[id], entries = Object.keys(layoutOf(def).entries);
    const at = entry ?? zone?.entry ?? entries[0]!;
    if (!entries.includes(at)) return `No way into ${id} called "${at}". Try: ${entries.join(", ")}`;
    resetGame(g);
    setState(g, "play");
    zone?.passed?.(g);
    enterArea(g, def, at);
    if (zone?.ready) kitOut(zone.ready);
    return `${def.name} (${at}): level ${g.world.need(g.player, "hero").level}, ${g.world.need(g.player, "health").maxHp} hearts`;
  }
  Object.assign(window, {
    simplicity: {
      game: g, view, world: g.world,
      hero: () => g.world.need(g.player, "transform"),
      critters: () => view.critters(),
      memory: () => view.memory(),
      /** How the churchyard's haunting stands (see src/game/ghost.ts). */
      haunting: () => hauntingOf(g),
      /** The city after dark (src/game/eerie.ts): eerie("watcher") makes one happen now, if it can here (at night, in the streets). */
      eerie: (id: EerieId = "watcher") => (startEerie(g, id) ? `${id}` : `${id} can't happen here and now`),
      /** Playtesting the bosses: boss("cinder") or boss("ringer") starts a fresh run in their lair (or load the page with ?boss=cinder,
       *  adding &god and/or &freeze); god() and freeze() flip the switches in src/game/cheats.ts, or set them with true/false. */
      boss,
      /** Getting about: area("hollow") or area("capital", "castle") starts a fresh run there (or load the page with ?area=hollow,
       *  and &entry=stone for another way in; &god and &freeze work here too). */
      area,
      /** The ending: ending("home") and so on (see above), or load the page with ?ending=home (&crowd=12, &full). */
      ending,
      /** The time of day: hour(23) makes it 11 at night (or load the page with ?hour=23); with nothing, the hour it is now. */
      hour: (h?: number) => (h === undefined ? g.hour : setHour(h)),
      god: (on = !isGod(g)) => `god ${setGod(g, on) ? "on" : "off"}`,
      freeze: (on = !isFrozen(g)) => `freeze ${setFrozen(g, on) ? "on" : "off"}`,
      /** The front doors in this area you can knock at, their names, and how many are home behind each. */
      doors: () => g.world.query("targetable", "transform").flatMap(([e, c]) =>
        isDoor(e) ? [{ id: e, name: c.targetable.name, x: c.transform.x, y: c.transform.y, home: whoIsHome(g, e).length }] : []),
    },
  });
  // ?boss=cinder (with &god, &freeze): straight into the fight, after main.ts has put the title up. ?area=hollow (with
  // &entry=stone): straight there. ?hour=23 (0 to 24, fractions too): that time of day, there or wherever you start.
  const q = new URLSearchParams(location.search), who = q.get("boss"), where = q.get("area"), at = q.get("hour"), end = q.get("ending");
  if (q.has("god")) setGod(g, true);
  if (q.has("freeze")) setFrozen(g, true);
  if (at !== null && Number.isFinite(Number(at))) setHour(Number(at));
  // A lair can set its own hour (the Ringer comes at night): the asked-for one wins.
  if (end !== null) void ending(end || "stone", Number(q.get("crowd") ?? 8), q.has("full"), q.get("shot") ?? undefined).then(said => console.info(said));
  else if (who) void boss(who).then(() => { if (at !== null && Number.isFinite(Number(at))) setHour(Number(at)); });
  else if (where) void area(where, q.get("entry") ?? undefined).then(said => console.info(said));
}
