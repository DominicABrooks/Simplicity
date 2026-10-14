// The map (M): the area you're in, drawn on parchment, with you, camps and caves marked. The terrain
// is drawn once per area; the markers are redrawn every frame while the map is open.
import { PAL } from "../data/palette.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { CurrentArea, Game } from "../game/game.ts";
import type { TileMap } from "../world/map.ts";
import { byId, markHandled } from "./dom.ts";

/** Map pixels per tile. The canvas is shown at one UI pixel per map pixel, so it stays crisp. */
const S = 3;

const INK = {
  paper: "#e8dcc0",
  ground: "#cbc493",
  groundDot: "#bdb682",
  path: "#b39a6a",
  water: "#86a7c4",
  shore: "#5f7fa0",
  tree: "#7d8f5a",
  treeDot: "#5f6f45",
  edge: "rgba(90, 56, 38, 0.35)",
};

/** Deterministic per-tile noise, so the hand-drawn texture is the same every time. */
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

export interface MapView {
  toggle(): void;
  close(): void;
  isOpen(): boolean;
  /** Redraw the markers (call every frame; does nothing while closed). */
  draw(): void;
}

function drawTerrain(c: HTMLCanvasElement, map: TileMap): void {
  c.width = map.width * S;
  c.height = map.height * S;
  const g = c.getContext("2d")!;
  g.fillStyle = INK.paper;
  g.fillRect(0, 0, c.width, c.height);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.width || y >= map.height ? Tile.Tree : map.tiles[y]![x]!);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const t = at(x, y), px = x * S, py = y * S;
    if (t === Tile.Water) {
      g.fillStyle = INK.water;
      g.fillRect(px, py, S, S);
      // A darker line where the water meets land.
      g.fillStyle = INK.shore;
      if (at(x, y - 1) !== Tile.Water) g.fillRect(px, py, S, 1);
      if (at(x, y + 1) !== Tile.Water) g.fillRect(px, py + S - 1, S, 1);
      if (at(x - 1, y) !== Tile.Water) g.fillRect(px, py, 1, S);
      if (at(x + 1, y) !== Tile.Water) g.fillRect(px + S - 1, py, 1, S);
    } else if (t === Tile.Tree) {
      g.fillStyle = INK.tree;
      g.fillRect(px, py, S, S);
      g.fillStyle = INK.treeDot;                             // a scatter of canopy dots
      g.fillRect(px + Math.floor(hash(x, y) * S), py + Math.floor(hash(y, x) * S), 1, 1);
    } else if (t === Tile.Path) {
      g.fillStyle = INK.path;
      g.fillRect(px, py, S, S);
    } else {
      g.fillStyle = INK.ground;
      g.fillRect(px, py, S, S);
      if (hash(x, y) < 0.15) { g.fillStyle = INK.groundDot; g.fillRect(px + 1, py + 1, 1, 1); }
    }
  }
  // Aged edges.
  const grad = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.62);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, INK.edge);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
}

export function createMapView(g: Game): MapView {
  const panel = byId("map"), base = byId<HTMLCanvasElement>("mapBase"), marks = byId<HTMLCanvasElement>("mapMarks");
  const title = byId("mapTitle"), frame = panel.querySelector<HTMLElement>(".map-frame")!;
  const mg = marks.getContext("2d")!;
  /** A game position (cell top-left) -> map pixels, at the cell's centre. */
  const toMap = (x: number, y: number) => [((x + HALF) / T) * S, ((y + HALF) / T) * S] as const;

  const setArea = ({ def, layout }: CurrentArea) => {
    title.textContent = def.name.toUpperCase();
    drawTerrain(base, layout.map);
    marks.width = base.width;
    marks.height = base.height;
    // One UI pixel per map pixel, whatever the area's size.
    frame.style.width = `calc(var(--u) * ${base.width})`;
    frame.style.height = `calc(var(--u) * ${base.height})`;
  };
  setArea(g.area);
  g.events.on("area", setArea);

  /** A filled shape with a 1px ink outline. */
  const shape = (points: (readonly [number, number])[], fill: string) => {
    mg.beginPath();
    points.forEach(([x, y], i) => (i ? mg.lineTo(x, y) : mg.moveTo(x, y)));
    mg.closePath();
    mg.fillStyle = fill;
    mg.fill();
    mg.strokeStyle = PAL.K;
    mg.lineWidth = 1;
    mg.stroke();
  };

  function drawMarks(): void {
    mg.clearRect(0, 0, marks.width, marks.height);
    for (const prop of g.area.layout.props) {
      if (prop.kind === "camp") {
        // A camp: a little tent, and the fire beside it.
        const [tx, ty] = toMap(prop.tent.x + prop.tent.w / 2 - HALF, prop.tent.y + prop.tent.h / 2 - HALF);
        shape([[tx - 3.5, ty + 2.5], [tx, ty - 3.5], [tx + 3.5, ty + 2.5]], "#d8c8a0");
        const [fx, fy] = toMap(prop.fire.x, prop.fire.y);
        mg.fillStyle = PAL.K; mg.fillRect(Math.round(fx) - 2, Math.round(fy) - 2, 4, 4);
        mg.fillStyle = PAL.O; mg.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 2, 2);
      } else {
        // A cave: a dark arch in a grey rock.
        const cx = (prop.x / T) * S, cy = Math.min(marks.height - 3, Math.max(3, (prop.y / T) * S));
        shape([[cx - 5, cy + 2], [cx - 4, cy - 3], [cx, cy - 5], [cx + 4, cy - 3], [cx + 5, cy + 2]], "#8a8378");
        shape([[cx - 2, cy + 2], [cx - 2, cy - 1], [cx, cy - 2.5], [cx + 2, cy - 1], [cx + 2, cy + 2]], "#14101e");
      }
    }
    // You: a gold arrow pointing the way you're facing, gently pulsing.
    const p = g.world.get(g.player, "transform"), motion = g.world.get(g.player, "motion");
    if (!p || !motion) return;
    const [px, py] = toMap(p.x, p.y), a = motion.aim, r = 4 + Math.sin(performance.now() / 200) * 0.5;
    const pt = (ang: number, d: number) => [px + Math.cos(a + ang) * d, py + Math.sin(a + ang) * d] as const;
    shape([pt(0, r), pt(2.5, r * 0.8), pt(0, -r * 0.2), pt(-2.5, r * 0.8)], PAL.Y);
  }

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    if (open) drawMarks();
  }

  panel.addEventListener("mousedown", ev => { markHandled(ev); ev.preventDefault(); });   // and never take focus
  panel.addEventListener("contextmenu", ev => ev.preventDefault());
  panel.querySelector(".map-close")!.addEventListener("click", () => setOpen(false));

  return {
    toggle: () => setOpen(Boolean(panel.hidden)),
    close: () => setOpen(false),
    isOpen: () => !panel.hidden,
    draw: () => { if (!panel.hidden) drawMarks(); },
  };
}
