// The credits (STORY.md, "0:55"): after the King's had his say on the keep steps, the run plays back a shot at a time in
// the game's own world (src/game/credits.ts), the screen letterboxed, a line under each shot and a fade between them;
// then "The End", and how this run went in a line under it. Escape skips to The End; once it's up, a click or a key
// brings up who made the game, a word from him, a way to donate and a box to send him feedback (END_CARD), and from
// there a button restarts: a new run, from the stone by the Ranger's fire.
import { CREDITS_TIME as TIME, END_CARD } from "../data/ending.ts";
import { creditsShot, runSum, skipShots, updateCredits } from "../game/credits.ts";
import { endCredits } from "../game/ending.ts";
import { resetGame } from "../game/reset.ts";
import type { Game } from "../game/game.ts";

/** Straight to the card after The End, if the credits are up (getting about quickly in development: src/debug.ts). */
let skipToCard: (() => void) | null = null;
export const showEndCard = (): boolean => { skipToCard?.(); return skipToCard !== null; };

export function createCredits(g: Game): { draw(dt: number): void } {
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  };
  const root = make("div", ""), veil = make("div", "veil"), top = make("div", "bar top"), bottom = make("div", "bar bottom");
  const caption = make("p", "caption"), end = make("h1", "end", "The End"), sum = make("p", "sum"), more = make("small", "more", "click to go on");
  root.id = "credits";
  root.hidden = true;
  bottom.append(caption);
  const card = makeCard(() => finish());
  root.append(veil, top, bottom, end, sum, more, card.el);
  document.body.append(root);

  // Where the credits are: the shots playing, The End (and seconds it's been up), or the card after it.
  let phase: "reel" | "end" | "card" = "reel", t = 0;
  const finish = () => {
    root.hidden = true; card.el.hidden = true; document.body.classList.remove("in-credits");
    endCredits(g);
    resetGame(g);                                            // and start again from the beginning
  };
  const toEnd = () => {
    phase = "end";
    t = 0;
    skipShots(g);
    root.classList.add("ended");
    sum.textContent = runSum(g);
  };
  const toCard = () => { phase = "card"; card.el.hidden = false; };
  const endUp = () => phase === "end" && t >= TIME.fade + TIME.end;
  skipToCard = () => { if (!root.hidden) { toEnd(); toCard(); } };
  addEventListener("keydown", e => {
    if (root.hidden) return;
    if (!card.el.hidden) { e.stopPropagation(); return; }   // typing feedback: the keys are the box's, not the game's
    e.preventDefault();
    if (phase === "reel") { if (e.key === "Escape") toEnd(); }
    else if (endUp()) toCard();
  }, true);
  root.addEventListener("click", () => { if (endUp()) toCard(); });
  g.events.on("state", ({ state }) => {
    if (state !== "credits" || !root.hidden) return;
    root.hidden = false;
    root.classList.remove("ended");
    document.body.classList.add("in-credits");
    phase = "reel";
    t = 0;
  });

  return {
    draw(dt) {
      if (root.hidden) return;
      t += dt;
      if (phase === "reel") {
        if (updateCredits(g, dt)) { toEnd(); return; }
        const shot = creditsShot(g);
        veil.style.opacity = `${1 - (shot?.shown ?? 0)}`;
        caption.style.opacity = `${shot?.shown ?? 0}`;
        if (shot) caption.textContent = shot.says;
        return;
      }
      const k = Math.min(1, t / TIME.fade);
      end.style.opacity = sum.style.opacity = `${phase === "end" ? k : 0}`;
      more.style.opacity = endUp() ? "0.7" : "0";
    },
  };
}

// ---------- After The End ----------
/** Who made it, a word from him, the donation link, the feedback box, and a button to start again. */
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
  const send = make("button", "send", "Send"), said = make("span", "said"), home = make("button", "home", "Restart");
  send.type = home.type = "button";
  const row = make("div", "row");
  row.append(said, send);                                   // what came of it, then Send, at the right
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
