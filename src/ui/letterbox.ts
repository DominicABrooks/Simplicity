// The black bars of a cutscene, sliding in top and bottom while one plays (src/game/cutscene.ts), with how
// to skip it in the corner of the bottom one.
import { cutscene } from "../game/cutscene.ts";
import type { Game } from "../game/game.ts";
import { SKIP_KEY } from "../input/input.ts";

export function createLetterbox(g: Game): { draw(): void } {
  const top = document.createElement("div"), bottom = document.createElement("div"), skip = document.createElement("span");
  top.className = "letterbox top";
  bottom.className = "letterbox bottom";
  skip.className = "skip";
  skip.textContent = `${SKIP_KEY.toLowerCase()}: skip`;
  bottom.append(skip);
  document.body.append(top, bottom);
  let on = false;
  return {
    draw() {
      const now = cutscene(g) !== null;
      if (now === on) return;
      on = now;
      top.classList.toggle("on", on);
      bottom.classList.toggle("on", on);
      document.body.classList.toggle("in-cutscene", on);
    },
  };
}
