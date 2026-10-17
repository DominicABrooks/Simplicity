// Cutscenes (src/data/cutscenes.ts): the first time the hero arrives somewhere with a scene to play, control is
// taken away and the scene plays out beat by beat: the hero walks himself where he's to go, the camera looks
// where the beat says, and the speaker has their say in the dialogue box (a click goes on, as ever). Q (or
// Escape) skips to the end, with everything the scene would have given already given. It lives on the hero (see
// Cutscene), so it's gone with the area; each scene plays once a run.
import type { Entity } from "../core/ecs.ts";
import { SCENES, type Beat, type Cue, type Scene } from "../data/cutscenes.ts";
import { GIFT_OF } from "../data/voices.ts";
import { HALF } from "../data/world.ts";
import { toast, type Game } from "./game.ts";
import { chatsWith, endTalk, receive, speak, talking } from "./talk.ts";

/** The cutscene playing, if one is. */
export const cutscene = (g: Game) => g.world.get(g.player, "cutscene") ?? null;

/** The scenes played this run, per game: each plays once (a new run starts afresh). */
const played = new WeakMap<Game, Set<string>>();
function playedIn(g: Game): Set<string> {
  let seen = played.get(g);
  if (!seen) {
    const fresh = new Set<string>();
    played.set(g, seen = fresh);
    g.events.on("reset", () => fresh.clear());
  }
  return seen;
}

/** What the game does on each cue, and when a scene that waits for the hero to come near can play: set by whoever owns them. */
const cues = new Map<Cue, (g: Game) => void>(), conditions = new Map<string, (g: Game) => boolean>();
export function onCue(cue: Cue, act: (g: Game) => void): void { cues.set(cue, act); }
export function onlyIf(scene: string, can: (g: Game) => boolean): void { conditions.set(scene, can); }
const cue = (g: Game, c: Cue | undefined) => { if (c) cues.get(c)?.(g); };
const canPlay = (g: Game, scene: Scene) => !playedIn(g).has(scene.id) && (conditions.get(scene.id)?.(g) ?? true);

/** Has this scene played, this run? */
export const scenePlayed = (g: Game, id: string): boolean => playedIn(g).has(id);

/** Play an area's scene the first time the hero arrives there (not while the credits are passing through). Call once, at start-up. */
export function watchCutscenes(g: Game): void {
  playedIn(g);
  g.events.on("area", ({ def }) => {
    if (g.state === "credits") return;
    const scene = SCENES.find(s => s.area === def.id && s.near === undefined && canPlay(g, s));
    if (scene && speakerOf(g, scene)) startCutscene(g, scene.id);
  });
}

/** A scene that waits for him to come near whoever speaks in it: is he near enough now? */
function sceneNear(g: Game): Scene | undefined {
  const hero = g.world.need(g.player, "transform");
  return SCENES.find(s => {
    if (s.near === undefined || s.area !== g.area.def.id || !canPlay(g, s)) return false;
    const them = speakerOf(g, s), at = them && g.world.get(them, "transform");
    return !!at && Math.hypot(at.x - hero.x, at.y - hero.y) <= s.near;
  });
}

/** Who speaks in a scene: the first one there of the right kind. */
const speakerOf = (g: Game, scene: Scene): Entity | undefined =>
  g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === scene.speaker)?.[0];

/** Which way they face at their post (a game angle; south if they've no post). */
const facingOf = (g: Game, e: Entity) => g.world.get(e, "sentry")?.post ?? Math.PI / 2;

export function startCutscene(g: Game, id: string): void {
  const scene = SCENES.find(s => s.id === id)!, hero = g.world.need(g.player, "transform");
  playedIn(g).add(id);
  if (talking(g)) endTalk(g);
  // This is their first talk: afterwards, talking to them goes on from here.
  chatsWith(g).set(scene.key, Math.max(1, chatsWith(g).get(scene.key) ?? 0));
  g.world.add(g.player, "cutscene", { scene: id, beat: 0, t: 0, spoken: false, cam: { x: hero.x + HALF, y: hero.y + HALF, zoom: 1 } });
}

/** Before the hero moves, every frame of a scene: nothing the player does moves him or swings at anything. */
export function holdInput(g: Game): void {
  if (!cutscene(g)) return;
  const input = g.input;
  input.keys.clear();
  input.attackPressed = input.attackReleased = input.jumpPressed = false;
  input.dashRequest = null;
  input.pointer = null;
}

/** After the hero's moved, every frame: play the beat (walk, hold, speak), point the camera, and on to the next. */
export function updateCutscene(g: Game, dt: number): void {
  if (g.state !== "play") return;
  if (!cutscene(g)) { const near = sceneNear(g); if (near) startCutscene(g, near.id); }
  const c = cutscene(g);
  if (!c) return;
  const scene = SCENES.find(s => s.id === c.scene)!, beat = scene.beats[c.beat]!, them = speakerOf(g, scene);
  if (!them) { endCutscene(g, scene); return; }
  const hero = g.world.need(g.player, "transform"), motion = g.world.need(g.player, "motion"), at = g.world.need(them, "transform");

  // Walking up to them, if the beat says to; then standing, facing them.
  const there = !beat.approach || walkUp(hero, at, facingOf(g, them), beat.approach, scene.pace * dt);
  motion.moving = !there;
  motion.aim = Math.atan2(at.y - hero.y, at.x - hero.x);
  if (there && c.t === 0) cue(g, beat.cue);
  if (there) c.t += dt;
  if (there && beat.say && !c.spoken && c.t >= (beat.hold ?? 0)) { speak(g, them, scene.key, beat.say); c.spoken = true; }
  c.cam = aim(beat, hero, at);

  const done = there && c.t >= (beat.hold ?? 0) && (!beat.say || (c.spoken && !talking(g)));
  if (!done) return;
  if (++c.beat >= scene.beats.length) { endCutscene(g, scene); return; }
  c.t = 0;
  c.spoken = false;
}

/** Skip to the end: whatever the scene's lines hand over is handed over, and the hero is where he'd have walked to. */
export function skipCutscene(g: Game): void {
  const c = cutscene(g);
  if (!c) return;
  const scene = SCENES.find(s => s.id === c.scene)!, them = speakerOf(g, scene);
  if (talking(g)) endTalk(g);
  if (them) {
    const hero = g.world.need(g.player, "transform"), at = g.world.need(them, "transform");
    for (const beat of scene.beats.slice(c.beat)) {
      if (beat.approach) walkUp(hero, at, facingOf(g, them), beat.approach, Infinity);
      if (beat !== scene.beats[c.beat] || c.t === 0) cue(g, beat.cue);   // the cues still to come
      for (const line of beat.say ?? []) { const kind = GIFT_OF.get(line); if (kind) receive(g, scene.key, kind); }
    }
  }
  endCutscene(g, scene);
}

function endCutscene(g: Game, scene: Scene): void {
  g.world.remove(g.player, "cutscene");
  g.world.need(g.player, "motion").moving = false;
  if (scene.after) toast(g, scene.after, true);
  cue(g, scene.then);
}

/** A step toward standing `gap` px in front of them (the way they face). True once there. */
function walkUp(hero: { x: number; y: number }, at: { x: number; y: number }, facing: number, gap: number, step: number): boolean {
  const tx = at.x + Math.cos(facing) * gap, ty = at.y + Math.sin(facing) * gap, dx = tx - hero.x, dy = ty - hero.y, d = Math.hypot(dx, dy);
  if (d <= step || d < 0.5) { hero.x = tx; hero.y = ty; return true; }
  hero.x += (dx / d) * step;
  hero.y += (dy / d) * step;
  return false;
}

/** Where the camera looks for a beat (px, centres). */
function aim(beat: Beat, hero: { x: number; y: number }, at: { x: number; y: number }): { x: number; y: number; zoom: number } {
  const on = beat.look === "hero" ? hero : beat.look === "speaker" ? at : { x: (hero.x + at.x) / 2, y: (hero.y + at.y) / 2 };
  return { x: on.x + HALF, y: on.y + HALF, zoom: beat.zoom };
}
