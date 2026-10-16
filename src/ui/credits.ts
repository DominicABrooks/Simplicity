// The credits (STORY.md, "0:55"): after the King's had his say on the keep steps, the screen goes dark and a few still
// pictures come up one after another, each with a line under it, showing how it all ends (src/data/ending.ts,
// CREDITS); then "The End". Escape skips to the end; once it's up, a click or a key brings up who made the game, a word
// from him, a way to donate and a box to send him feedback (END_CARD), and from there a button goes back to the game.
// The pictures are painted here, small and blocky like everything else, and scaled up.
import { CREDITS, CREDITS_TIME as TIME, END_CARD, type Still } from "../data/ending.ts";
import { endCredits } from "../game/ending.ts";
import type { Game } from "../game/game.ts";

/** Straight to the card after The End, if the credits are up (getting about quickly in development: src/debug.ts). */
let skipToCard: (() => void) | null = null;
export const showEndCard = (): boolean => { skipToCard?.(); return skipToCard !== null; };

/** The pictures' size, in their own pixels. */
const W = 160, H = 90;

export function createCredits(g: Game): { draw(dt: number): void } {
  const root = document.createElement("div"), frame = document.createElement("div"), canvas = document.createElement("canvas");
  const caption = document.createElement("p"), end = document.createElement("h1"), more = document.createElement("small");
  root.id = "credits";
  root.hidden = true;
  frame.className = "still";
  canvas.width = W; canvas.height = H;
  end.textContent = "The End";
  more.textContent = "click to go on";
  frame.append(canvas, caption);
  const card = makeCard(() => finish());
  root.append(frame, end, more, card.el);
  document.body.append(root);
  const paint = canvas.getContext("2d")!;

  // Where the credits are: seconds since they began, and which picture is up (-1 the dark before; CREDITS.length the end;
  // past that, the card).
  let t = 0, at = -1;
  const show = (i: number) => {
    at = i;
    t = 0;
    const still = CREDITS[i];
    if (still) { STILLS[still.still](paint); caption.textContent = still.says; }
  };
  const finish = () => { root.hidden = true; root.classList.remove("on"); card.el.hidden = true; frame.hidden = false; endCredits(g); };
  const toEnd = () => { show(CREDITS.length); t = TIME.fade; };
  const toCard = () => { at = CREDITS.length + 1; end.style.opacity = more.style.opacity = "0"; frame.hidden = true; card.el.hidden = false; };
  const endUp = () => at === CREDITS.length && t >= TIME.fade + TIME.end;
  skipToCard = () => { if (!root.hidden) toCard(); };
  addEventListener("keydown", e => {
    if (root.hidden) return;
    if (!card.el.hidden) { e.stopPropagation(); return; }   // typing feedback: the keys are the box's, not the game's
    e.preventDefault();
    if (at < CREDITS.length) { if (e.key === "Escape") toEnd(); }
    else if (endUp()) toCard();
  }, true);
  root.addEventListener("click", () => { if (endUp()) toCard(); });
  g.events.on("state", ({ state }) => {
    if (state !== "credits" || !root.hidden) return;
    root.hidden = false;
    void root.offsetWidth;                                   // laid out first, so the dark fades in over the game
    root.classList.add("on");
    show(-1);
  });

  return {
    draw(dt) {
      if (root.hidden) return;
      t += dt;
      if (at < 0) { frame.style.opacity = "0"; if (t >= TIME.dark) show(0); return; }
      if (at < CREDITS.length) {
        const fade = TIME.fade, last = fade * 2 + TIME.hold;
        frame.style.opacity = `${Math.max(0, Math.min(1, t / fade, (last - t) / fade))}`;
        if (t >= last) show(at + 1);
        return;
      }
      if (at > CREDITS.length) return;                       // the card's up
      frame.style.opacity = "0";
      end.style.opacity = `${Math.min(1, t / TIME.fade)}`;
      more.style.opacity = t >= TIME.fade + TIME.end ? "0.7" : "0";
    },
  };
}

// ---------- After The End ----------
/** Who made it, a word from him, the donation link, the feedback box, and the way back to the game. */
function makeCard(back: () => void): { el: HTMLElement } {
  const C = END_CARD, el = document.createElement("div"), make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  };
  el.className = "card";
  el.hidden = true;
  const donate = make("a", "donate", C.donateLabel);
  Object.assign(donate, { href: C.donateUrl, target: "_blank", rel: "noopener" });
  const box = make("textarea", "feedback");
  Object.assign(box, { maxLength: C.longest, rows: 4, placeholder: "What did you think?" });
  const send = make("button", "send", "Send"), said = make("span", "said"), home = make("button", "home", "Back to the game");
  send.type = home.type = "button";
  const row = make("div", "row");
  row.append(send, said);
  el.append(make("h2", "by", C.by), make("p", "help", C.help), ...C.note.map(n => make("p", "note", n)),
    make("p", "ask", C.donate), donate, make("p", "ask", C.ask), box, row, home);
  let sent = 0;
  send.addEventListener("click", () => {
    const text = box.value.trim().slice(0, C.longest);
    if (!text || send.disabled) return;
    if (sent >= C.most) { said.textContent = "That's plenty, thank you!"; return; }
    send.disabled = true;
    said.textContent = "Sending...";
    void sendFeedback(text).then(ok => {
      send.disabled = false;
      if (ok) { sent++; box.value = ""; }
      said.textContent = ok ? "Sent. Thank you!" : "Couldn't send that. Try again in a bit?";
    });
  });
  home.addEventListener("click", back);
  return { el };
}

/** Feedback to Dominic's Discord, by its webhook: just the words, pinging nobody. Whether it got there. */
async function sendFeedback(text: string): Promise<boolean> {
  try {
    const res = await fetch(END_CARD.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Simplicity feedback", content: text, allowed_mentions: { parse: [] } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- The pictures ----------
type Paint = CanvasRenderingContext2D;
const rect = (p: Paint, x: number, y: number, w: number, h: number, c: string) => { p.fillStyle = c; p.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
/** A filled disc (or an ellipse), blocky. */
function disc(p: Paint, cx: number, cy: number, rx: number, c: string, ry = rx): void {
  p.fillStyle = c;
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const half = rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
    if (half >= 0.5) p.fillRect(Math.round(cx - half), Math.round(cy + y), Math.round(half * 2), 1);
  }
}
/** A sky in bands, top colour to bottom, down to `to`. */
function sky(p: Paint, colours: readonly string[], to = H): void {
  const band = to / colours.length;
  colours.forEach((c, i) => rect(p, 0, i * band, W, band + 1, c));
}
/** A person, standing with their feet at (x, y): legs, body, head, and what's on it. */
function person(p: Paint, x: number, y: number, o: { body: string; skin?: string; hair?: string; legs?: string; tall?: number; hat?: string; wide?: number }): void {
  const tall = o.tall ?? 14, wide = o.wide ?? 5, legs = Math.round(tall * 0.3), body = Math.round(tall * 0.45), headR = Math.max(2, Math.round(tall * 0.13));
  rect(p, x - 2, y - legs, 1.5, legs, o.legs ?? "#3a2e28"); rect(p, x + 0.5, y - legs, 1.5, legs, o.legs ?? "#3a2e28");
  rect(p, x - wide / 2, y - legs - body, wide, body, o.body);
  const hy = y - legs - body - headR;
  disc(p, x, hy, headR, o.skin ?? "#e2b48c");
  if (o.hair) rect(p, x - headR, hy - headR, headR * 2, headR, o.hair);
  if (o.hat) rect(p, x - headR - 1, hy - headR - 1, headR * 2 + 2, 2, o.hat);
}
/** A crowd's heads and shoulders along the bottom of the picture. */
function crowd(p: Paint, y: number, seed: number): void {
  const coats = ["#6b3d2e", "#3f5466", "#7a6a3a", "#5a4a6a", "#8a5a3a", "#45604a"], hairs = ["#3a2a20", "#7a5a30", "#a8a090", "#2a2018", "#b07040"];
  for (let i = 0, x = 3; x < W; i++, x += 7 + ((i * seed) % 4)) {
    const h = ((i * 7 + seed) % 5) - 2;
    rect(p, x - 4, y + h, 8, H - y, coats[(i + seed) % coats.length]!);
    disc(p, x, y + h - 3, 3, "#d8a882");
    rect(p, x - 3, y + h - 6, 6, 2, hairs[(i * 3 + seed) % hairs.length]!);
  }
}
/** A row of town houses: gables against the sky, windows lit or not. */
function houses(p: Paint, base: number, lit: boolean, seed: number): void {
  const walls = ["#cdb48c", "#b89c74", "#d8c8a4", "#a88c68"], roofs = ["#7a3a2a", "#5a4a5a", "#8a4a32"];
  for (let i = 0, x = -4; x < W; i++, x += 22 + (i * seed) % 7) {
    const w = 20 + (i * seed) % 6, h = 24 + (i * 5 + seed) % 10;
    rect(p, x, base - h, w, h, walls[(i + seed) % walls.length]!);
    p.fillStyle = roofs[(i + seed) % roofs.length]!;
    p.beginPath(); p.moveTo(x - 1, base - h); p.lineTo(x + w / 2, base - h - 10); p.lineTo(x + w + 1, base - h); p.fill();
    for (const wx of [x + 4, x + w - 8]) rect(p, wx, base - h + 6, 4, 5, lit && (i + wx) % 3 === 0 ? "#f5d562" : "#3a3040");
  }
}
const STILLS: Record<Still, (p: Paint) => void> = {
  // King Osric at the market cross with the true chronicle, very red; the city round him, and the Old Mother on the wall.
  chronicle(p) {
    sky(p, ["#8fc4e8", "#a4d0ec", "#bcdcef", "#d4e8f2"], 58);
    rect(p, 0, 22, W, 6, "#9a958c"); for (let x = 0; x < W; x += 8) rect(p, x, 18, 5, 4, "#9a958c");   // the city wall
    disc(p, 128, 14, 9, "#4a6a5a", 5); disc(p, 139, 8, 3, "#4a6a5a");                                   // the Old Mother on it, watching
    rect(p, 134, 9, 6, 3, "#4a6a5a");
    p.fillStyle = "#3a5a4a"; p.beginPath(); p.moveTo(122, 12); p.lineTo(112, 2); p.lineTo(130, 9); p.fill();
    rect(p, 140, 7, 1, 1, "#f5d562");
    houses(p, 58, false, 3);
    rect(p, 0, 58, W, H - 58, "#b4a890");
    for (const [w, y] of [[36, 64], [28, 60], [20, 56]] as const) rect(p, 80 - w / 2, y, w, 4, "#a8a398");   // the cross's steps
    rect(p, 78, 28, 4, 28, "#b5b0a5"); rect(p, 73, 32, 14, 3, "#b5b0a5");
    person(p, 80, 56, { body: "#a8473a", skin: "#e05a4a", tall: 18, wide: 7, hat: "#f5d562" });            // the King, very red
    rect(p, 84, 40, 6, 12, "#f4ecd8"); rect(p, 84, 52, 6, 1, "#c8b890");                                  // eleven pages
    crowd(p, 74, 2);
  },
  // The Ranger walking home at evening to the house with the grey cloak at the window.
  ranger(p) {
    sky(p, ["#4a3a6a", "#8a4a6a", "#d8705a", "#f0a060", "#f5c87a"], 60);
    disc(p, 30, 54, 10, "#ffd890");
    rect(p, 0, 60, W, H - 60, "#5a5040");
    rect(p, 0, 62, W, 3, "#6a604c");
    rect(p, 88, 24, 46, 38, "#b89c74");
    p.fillStyle = "#5a3a2a"; p.beginPath(); p.moveTo(84, 24); p.lineTo(111, 6); p.lineTo(138, 24); p.fill();
    rect(p, 116, 44, 9, 16, "#4a3020");                                                                  // the door
    rect(p, 96, 32, 12, 12, "#f5d562"); rect(p, 98, 33, 8, 11, "#8a8a88"); rect(p, 100, 33, 4, 2, "#6e6e6c");   // the grey cloak at the window
    rect(p, 95, 31, 14, 1, "#4a3020"); rect(p, 95, 44, 14, 1, "#4a3020");
    person(p, 60, 72, { body: "#3f5a3a", tall: 18, wide: 6, hair: "#4a5a3a", legs: "#3a3020" });
    rect(p, 63, 56, 1, 18, "#6a4a2a");                                                                   // his staff
  },
  // The Vael over the King's Bridge in the morning, carrying the three eggs home: red, white and indigo.
  eggs(p) {
    sky(p, ["#f0c878", "#f5d898", "#f8e4b4", "#d8e8f0"], 52);
    rect(p, 0, 52, W, H - 52, "#3a6a8a");
    for (let y = 56; y < H; y += 5) for (let x = (y * 7) % 11; x < W; x += 13) rect(p, x, y, 5, 1, "#5a8aa8");
    rect(p, 0, 40, W, 6, "#b5b0a5"); rect(p, 0, 36, W, 4, "#a8a398");                                    // the bridge's deck and parapet
    for (const x of [10, 60, 110]) { p.fillStyle = "#9a958c"; p.beginPath(); p.arc(x + 25, 62, 22, Math.PI, 0); p.lineTo(x + 50, 46); p.lineTo(x, 46); p.fill(); }
    for (const x of [10, 60, 110]) { p.fillStyle = "#2a4a62"; p.beginPath(); p.arc(x + 25, 64, 16, Math.PI, 0); p.fill(); }
    rect(p, 0, 34, W, 2, "#c8c0b0");
    for (const x of [20, 70, 120, 150]) { rect(p, x, 22, 1, 12, "#5a4030"); rect(p, x + 1, 22, 6, 4, "#a8473a"); }   // standards
    const eggs = ["#c8402a", "#f0f0ea", "#4a3a9a"];
    [52, 76, 100].forEach((x, i) => {
      person(p, x, 36, { body: "#7a9a8a", skin: "#b8c8c0", tall: 17, wide: 5, hair: "#d8e0dc" });
      disc(p, x + 4, 25, 3, eggs[i]!, 4);
    });
    person(p, 124, 36, { body: "#7a9a8a", skin: "#b8c8c0", tall: 16, wide: 5, hair: "#d8e0dc" });
  },
  // Yssa and Widow Crane at cards by candlelight; the Widow has one up her sleeve.
  cards(p) {
    sky(p, ["#5a3a2a", "#6a4430", "#7a4e36"], 56);
    rect(p, 108, 10, 24, 22, "#2a3050"); rect(p, 119, 10, 2, 22, "#5a3a2a"); rect(p, 108, 20, 24, 2, "#5a3a2a");   // a window, night out
    rect(p, 114, 14, 1, 1, "#f0f0ff"); rect(p, 126, 25, 1, 1, "#f0f0ff");
    rect(p, 0, 56, W, H - 56, "#4a3022");
    person(p, 54, 72, { body: "#cfe4f0", skin: "#eef4f8", tall: 32, wide: 11, hair: "#ffffff" });         // Yssa, the frost gone out of her
    person(p, 106, 72, { body: "#2a2228", skin: "#e2b48c", tall: 30, wide: 11, hair: "#9a9590" });        // Widow Crane
    rect(p, 99, 52, 3, 4, "#f4ecd8");                                                                    // the card up her sleeve
    disc(p, 80, 64, 34, "#7a4a2a", 7);                                                                   // the table
    rect(p, 48, 66, 4, 24, "#5a3220"); rect(p, 108, 66, 4, 24, "#5a3220");
    for (const [x, y] of [[70, 62], [74, 63], [88, 61], [92, 62]] as const) rect(p, x, y, 3, 4, "#f4ecd8");
    rect(p, 80, 60, 2, 6, "#f4ecd8"); disc(p, 81, 57, 1.5, "#f5d562");                                  // a candle
    disc(p, 81, 58, 9, "rgba(245, 213, 98, 0.18)");
  },
  // Tam Appleby, a boy again, on the fence eating a turnip; a sheep looks on.
  turnip(p) {
    sky(p, ["#8fc4e8", "#a8d4ee", "#c4e2f2"], 46);
    disc(p, 36, 46, 40, "#7aa85a", 10); disc(p, 120, 48, 50, "#6a9a4a", 10);
    rect(p, 0, 50, W, H - 50, "#7aa85a");
    for (let i = 0; i < 40; i++) rect(p, (i * 37) % W, 54 + ((i * 13) % 34), 1, 2, "#5a8a3a");
    for (let x = 20; x < 120; x += 16) rect(p, x, 52, 2, 16, "#8a6a42");
    rect(p, 20, 55, 100, 2, "#a07a4a"); rect(p, 20, 61, 100, 2, "#a07a4a");
    person(p, 64, 56, { body: "#c87a3a", tall: 18, wide: 6, hair: "#a8602a" });                           // Tam, sat on the rail
    disc(p, 69, 43, 3, "#e8dce8"); disc(p, 69, 44, 2, "#9a4a8a", 1.5); rect(p, 68, 37, 1, 4, "#4a8a3a"); rect(p, 70, 38, 1, 3, "#4a8a3a");
    disc(p, 104, 74, 9, "#f0ece0", 6); disc(p, 94, 70, 3.5, "#3a3430", 3);                                // a sheep, looking at him
    rect(p, 99, 79, 2, 5, "#3a3430"); rect(p, 108, 79, 2, 5, "#3a3430");
    rect(p, 92, 69, 1, 1, "#f0f0f0");
  },
  // The Fells' house at night, tall and narrow; in its top window, a lantern of his own, and him asleep.
  lantern(p) {
    sky(p, ["#0e1024", "#141a34", "#1c2444", "#28304e"], 70);
    for (let i = 0; i < 30; i++) rect(p, (i * 53) % W, (i * 29) % 50, 1, 1, i % 7 ? "#c8d0f0" : "#ffffff");
    houses(p, 76, true, 5);
    rect(p, 62, 8, 36, 68, "#3a3446");                                                                   // the Fells' house, in shadow
    p.fillStyle = "#2a2434"; p.beginPath(); p.moveTo(58, 8); p.lineTo(80, -6); p.lineTo(102, 8); p.fill();
    rect(p, 70, 16, 20, 14, "#f5c862");                                                                  // the top room, lit
    rect(p, 72, 25, 14, 4, "#a86a3a"); disc(p, 76, 24, 2.5, "#8d8a84");                                  // asleep in his bed
    rect(p, 86, 18, 2, 1, "#4a3020"); rect(p, 85, 19, 4, 5, "#ffe8a0"); rect(p, 85, 24, 4, 1, "#4a3020");   // his lantern
    disc(p, 87, 21, 7, "rgba(255, 232, 160, 0.25)");
    rect(p, 69, 15, 22, 1, "#2a2434"); rect(p, 79, 16, 1, 14, "#2a2434");
    rect(p, 72, 42, 8, 8, "#8a8a88");                                                                    // and the grey cloak below
    rect(p, 0, 76, W, H - 76, "#22202c");
  },
};
