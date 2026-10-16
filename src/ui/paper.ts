// The scrap of paper a woodwarden hands the hero at the barricade, with a stub of crayon: the player writes the
// King's watchword on it and hands it back (src/game/watchword.ts). Enter, or the button, hands it back; Escape
// keeps it, unwritten. While it's out, keys go to the paper, not the hero.
import type { Game } from "../game/game.ts";
import { handBack, PAPER_LENGTH, writingFor } from "../game/watchword.ts";

export function createPaper(g: Game): { draw(): void } {
  const el = document.createElement("div"), sheet = document.createElement("form"), hint = document.createElement("p");
  const line = document.createElement("input"), give = document.createElement("button");
  el.id = "paper";
  el.hidden = true;
  el.dataset.ui = "";                                        // clicks round it aren't swings at the world
  hint.className = "hint";
  hint.textContent = "Write the watchword";
  line.className = "crayon";
  line.maxLength = PAPER_LENGTH;
  line.autocomplete = "off";
  line.spellcheck = false;
  line.setAttribute("aria-label", "The watchword");
  give.type = "submit";
  give.textContent = "Hand it back";
  sheet.append(hint, line, give);
  el.append(sheet);
  document.body.append(el);

  const close = (text: string | null) => { el.hidden = true; line.blur(); handBack(g, text); };
  sheet.addEventListener("submit", e => { e.preventDefault(); close(line.value); });
  line.addEventListener("keydown", e => {
    e.stopPropagation();                                     // the game doesn't hear him writing
    if (e.key === "Escape") { e.preventDefault(); close(null); }
  });
  line.addEventListener("keyup", e => e.stopPropagation());

  return {
    draw() {
      const open = writingFor(g) !== null;
      if (open === !el.hidden) return;
      el.hidden = !open;
      if (open) { line.value = ""; line.focus(); }
    },
  };
}
