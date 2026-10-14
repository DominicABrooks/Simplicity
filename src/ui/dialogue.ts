// The dialogue box: whoever the hero is talking to, their name and their line typing out, at the bottom of
// the screen. It doesn't take clicks itself (any click goes on: see src/game/talk.ts).
import { TALK } from "../data/dialogue.ts";
import type { Game } from "../game/game.ts";
import { talking } from "../game/talk.ts";

export function createDialogue(g: Game): { draw(): void } {
  const el = document.createElement("div"), who = document.createElement("div"), say = document.createElement("p"), more = document.createElement("div");
  el.id = "dialogue";
  el.hidden = true;
  who.className = "who";
  say.className = "say";
  more.className = "more";
  el.append(who, say, more);
  document.body.append(el);
  let shown = "";
  return {
    draw() {
      const c = talking(g);
      el.hidden = !c;
      if (!c) { shown = ""; return; }
      const line = c.lines[c.line]!, text = line.slice(0, Math.floor(c.t * TALK.charsPerSecond));
      if (who.textContent !== c.name) who.textContent = c.name;
      if (text !== shown) { say.textContent = text; shown = text; }
      // Once the line's all there: what to press, and whether there's more to come.
      more.textContent = text.length < line.length ? "" : c.line + 1 < c.lines.length ? "click to continue" : "click to close";
    },
  };
}
