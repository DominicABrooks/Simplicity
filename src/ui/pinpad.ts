// The woodcutters' strongbox's four number wheels (src/game/lockbox.ts), close up, like an old combination lock: a brass
// plate with four wheels in a row, each a number from 0 to 9 with a little arrow above it to roll it up and one below to
// roll it down, round from 9 to 0 and back. Click the arrows (or the wheel itself, up; the scroll wheel either way), or
// with the keys: left and right pick a wheel, up and down turn it, a number sets it and moves on. Enter, or the button,
// tries the lid; Escape steps back without trying. The wheels stay where he left them, as a real lock's do. While it's
// up, keys go to the lock, not the hero.
import type { Game } from "../game/game.ts";
import { LOCKBOX, LOCKBOX_SAYS } from "../data/lockbox.ts";
import { setWheels, settingWheels } from "../game/lockbox.ts";

export function createPinPad(g: Game): { draw(): void } {
  const count = LOCKBOX.code.length, set = Array.from({ length: count }, () => 0);
  let at = 0;                                                // the wheel the keys turn
  const el = document.createElement("div"), plate = document.createElement("form"), hint = document.createElement("p");
  const row = document.createElement("div"), give = document.createElement("button");
  el.id = "pinpad";
  el.hidden = true;
  el.dataset.ui = "";                                        // clicks round it aren't swings at the world
  plate.tabIndex = -1;                                       // to hold the keys while it's up
  plate.setAttribute("aria-label", LOCKBOX_SAYS.label);
  hint.className = "hint";
  hint.textContent = LOCKBOX_SAYS.ask;
  row.className = "wheels";

  const faces: HTMLElement[] = [], wheelEls: HTMLElement[] = [];
  const show = () => {
    faces.forEach((f, i) => { f.textContent = String(set[i]); });
    wheelEls.forEach((w, i) => w.classList.toggle("at", i === at));
  };
  const turn = (i: number, by: number) => {
    at = i;
    set[i] = (set[i]! + by + 10) % 10;
    const f = faces[i]!;
    f.classList.remove("up", "down");
    void f.offsetWidth;                                      // so the roll plays again
    f.classList.add(by > 0 ? "up" : "down");
    show();
  };
  const arrow = (i: number, by: number) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = by > 0 ? "roll up" : "roll down";
    b.textContent = by > 0 ? "▲" : "▼";
    b.setAttribute("aria-label", `Wheel ${i + 1} ${by > 0 ? "up" : "down"}`);
    b.addEventListener("click", () => { turn(i, by); plate.focus(); });
    return b;
  };
  for (let i = 0; i < count; i++) {
    const wheel = document.createElement("div"), slot = document.createElement("div"), face = document.createElement("span");
    wheel.className = "wheel";
    slot.className = "window";
    face.className = "face";
    slot.append(face);
    slot.addEventListener("click", () => { turn(i, 1); plate.focus(); });
    slot.addEventListener("wheel", e => { e.preventDefault(); turn(i, e.deltaY < 0 ? 1 : -1); }, { passive: false });
    wheel.append(arrow(i, 1), slot, arrow(i, -1));
    row.append(wheel);
    faces.push(face);
    wheelEls.push(wheel);
  }
  give.type = "submit";
  give.className = "try";
  give.textContent = LOCKBOX_SAYS.try;
  plate.append(hint, row, give);
  el.append(plate);
  document.body.append(el);

  const close = (code: string | null) => { el.hidden = true; plate.blur(); setWheels(g, code); };
  plate.addEventListener("submit", e => { e.preventDefault(); close(set.join("")); });
  plate.addEventListener("keydown", e => {
    e.stopPropagation();                                     // the game doesn't hear him at the lock
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); close(null); }
    else if (k === "ArrowUp" || k === "w") { e.preventDefault(); turn(at, 1); }
    else if (k === "ArrowDown" || k === "s") { e.preventDefault(); turn(at, -1); }
    else if (k === "ArrowLeft" || k === "a") { e.preventDefault(); at = (at + count - 1) % count; show(); }
    else if (k === "ArrowRight" || k === "d") { e.preventDefault(); at = (at + 1) % count; show(); }
    else if (/^[0-9]$/.test(k)) { e.preventDefault(); set[at] = Number(k); at = Math.min(count - 1, at + 1); show(); }
    else if (k === "Enter") { e.preventDefault(); close(set.join("")); }
  });
  plate.addEventListener("keyup", e => e.stopPropagation());
  show();

  return {
    draw() {
      const open = settingWheels(g) !== null;
      if (open === !el.hidden) return;
      el.hidden = !open;
      if (!open) return;
      at = 0;
      show();
      plate.focus();
    },
  };
}
