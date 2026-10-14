# Architecture

Simplicity plays in 2D and draws in 3D. The simulation is a small entity-component-system (ECS) in
plain TypeScript with no DOM or WebGL in it, so it runs (and is tested) in Node. The browser layers
sit around it: input fills in the controls, the renderer and UI read the state and draw it.

```
 keyboard, mouse ──> input ──> Input resource
                                    │
                     ┌──────────────▼──────────────┐
                     │ step(game, dt): systems run │  src/systems
                     │ in a fixed order over the   │
                     │ World and its resources     │  src/game, src/core
                     └──────┬───────────────┬──────┘
             events (toast, │               │ state + one-shot fx
             state, reset)  ▼               ▼
                        src/ui          src/render
                  (HUD, inventory,   (three.js view, one
                   toasts, overlay)   view per entity kind)
```

## Units and coordinates

- Game space is 2D, in **game pixels**: a tile is 8 px (`T`), the map is 64 x 44 tiles.
- Every position is the **top-left of an 8x8 cell**. Add `HALF` (4) for the cell's centre. Hit tests between
  two cells compare positions directly (`Math.hypot(a.x - b.x, a.y - b.y) < 5`).
- Collision checks a box at the feet, centred where the body is drawn (`blocked()` in `src/world/collision.ts`). Trees and
  water block by the tile; buildings block by their shapes (below). Moves go in steps of at most 2 px, so nothing
  fast skips through a thin post.
- The 3D view maps game x to world X and game y to world Z, one tile per world unit: `toWorld(x, y)` in
  `src/render/context.ts` gives the cell's centre.
- Speeds are px per second, times are seconds.

## The ECS

`src/core/ecs.ts` is about 100 lines. Entities are numbers. Components are plain data objects, one store per
component type, typed by the `Components` map in `src/game/components.ts`:

```ts
const e = world.create({ transform: { x, y }, health: { hp: 3, maxHp: 3 }, renderable: { kind: "slime" } });
for (const [e, { transform, health }] of world.query("transform", "health")) { ... }
world.need(e, "health");      // a component that must exist (throws otherwise)
world.destroy(e);             // safe while iterating a query: queries return snapshots
```

What an entity is depends only on its components:

| Entity | Components |
| --- | --- |
| Hero | `transform knockback health hero motion status actions renderable` |
| Slime | `transform knockback health enemy slime renderable` |
| Mage | `transform knockback health enemy mage renderable` |
| Potion, loot | `transform pickup renderable` |
| Arrow | `transform arrow renderable` |
| Spell bolt | `transform bolt renderable` |
| Lightning strike | `transform strike renderable` |

Entity factories live in `src/game/spawn.ts`.

### Resources

Singletons live on the `Game` object (`src/game/game.ts`) next to the world: the tile map, the seeded `Rng`,
the `Input` (held keys, one-frame presses and the cursor on the ground), the `Inventory` model, the event bus,
the effects queue, combat numbers, the game state (`title`, `play`, `dead`), the hero's entity id, the clock,
hitstop, camera shake, kills and the spawn timer.

### Systems

A system is a plain function `(game, dt) => void`. `step()` in `src/systems/index.ts` runs them in a fixed
order, and **order matters**: each system sees what the ones before it did this frame.

1. `resetHold`: hold R to restart.
2. `heroStatus`: status timers; polymorphed or frozen heroes drop their presses.
3. `heroMove`: aim, walk, swim, dash, jump.
4. `fishing`, `rod`, `bow`, `sword`, `thrust`: weapons. Each consumes the attack press it uses, so the
   thrust (punch, or the rod's bonk) only gets presses no weapon took.
5. `clearPresses`, then `pickups`.
6. Then, while the hero is alive: `arrows`, `enemyPhysics`, `mage`, `slime`, `deaths`, `spawner`, and the
   spell hazards, `bolts` and `strikes`.
7. `floaters` (combat numbers drift and fade).

During hitstop the world holds still for a few frames; only the camera shake decays.

### Talking to the outside

Systems never touch the DOM or three.js. They talk outward in two ways:

- **Events** (`game.events`, a typed `EventBus`): `toast`, `state` and `reset`. The UI subscribes.
- **Effects** (`game.fx`): one-shot visuals such as hit sparks, bursts, Frost Nova's ring, lightning and
  level-ups (`src/game/fx.ts`). The renderer consumes the queue every frame.

Combat numbers (`game.floaters`) are game state, since they age with game time and freeze during hitstop.
The HUD draws them.

## Areas

The world is a graph of **areas** joined by **exits** (caves, for now). Each area is one module in
`src/areas/`, named after its id, exporting an `AreaDef` (`src/world/area.ts`):

- `build()` returns its `AreaLayout`: the tile map (and solid boxes such as a tent), named arrival
  points (`entries`), `exits` (a box that takes you to an area and entry), and scenery `props`
  (a camp, a cave mouth). It must be deterministic.
- `life` says what lives there (enemies, potions, critters and decor). Leave it out for an empty area.

Props are data too: each kind (a camp, a cave, a curtain wall around any polygon, a house, a keep,
a cathedral, a bridge, a lamp in `town.ts`; a plaza, fountain, stall, statue, planter, bench, stock, bunting
and standard in `market.ts`) has one builder in `PROP_BUILDERS` (`src/render/props.ts`). Anything built is solid by
its shape: `propSolids()` (`src/world/solids.ts`) turns each prop into boxes, circles and capsules (thick
lines, for wall runs at any angle), which go in the area's `map.solids`; `src/world/shapes.ts` buckets them
into a grid, so a collision test only looks at the few nearby. The bigger buildings have ground plans
(`src/world/plans.ts`) that both their renderer and their shapes are made from, so what you see is what you
bump into. Built things also stand on `Wall` tiles, which mark the map (for the map view, spawning and
reachability) but don't block movement themselves. A new kind of building is a `Prop` variant, one builder
and its shapes. A builder can return
`occluders` (boxes around anything tall); `src/render/occlusion.ts` fades whichever of them, and
whichever trees, stand between the camera and the hero or the ground just around them.

Built to scale to thousands of areas:

- **Only one area is ever built.** `enterArea()` (`src/game/travel.ts`) destroys every entity but the
  hero, builds the new layout and fills it. The renderer frees the last area's geometry and materials
  (`src/render/dispose.ts`) before building the next, so GPU memory stays flat however far you travel.
  Layouts of the last few areas are cached (`src/world/layouts.ts`).
- **Only the home area ships with the game.** Every other area is its own chunk
  (`import.meta.glob` in `src/areas/index.ts`), downloaded the first time you go there. Listing every
  area's id costs nothing.
- **Links are checked, not trusted.** `tests/areas.test.ts` runs over every area: ids match file names,
  layouts are deterministic, arrival points are on open ground and outside exits, every exit leads to
  a real area and entry, and every exit can be walked to from every arrival point.

Travelling: walking into an exit sets `game.travel` and the `travel` state, which holds the world still.
`main.ts` fades out, loads the next area, calls `arrive()`, and fades back in.

## Rendering

`src/render/renderer.ts` owns the three.js scene, the camera and the low-res canvas. Builders get a
`RenderContext` (`src/render/context.ts`) with the PS1-style materials (vertex snapping, flat lambert),
the hand-painted textures and the particle pool, so nothing touches WebGL at import time.

Entities are drawn through a **registry** (`src/render/views.ts`): each `renderable.kind` has a view with
`create`, `update` and `remove`. The render system (`renderSystem.ts`) creates a view when an entity
appears, updates it every frame and removes it when the entity is destroyed. The hero has its own view
(`hero.ts`) for its pose, weapons, hands, swoosh, sheep form, ice block and dash afterimages. Terrain,
koi, fishing visuals, ambience and effects are their own modules. Grass covers all the ground; paths
and paving are overlays (`groundLayers.ts`) whose edges follow a noisy field instead of the tile grid,
so they blend into it while collision stays on tiles. Everything flat on the ground draws in ordered layers
(`GROUND` in `context.ts`: paving, paths, the plaza, stains, shadows, then markers like the aim arrow and target
ring on top), each pulled toward the camera in the depth test a little more than the last.

Rendering reads the game and never writes to it, except draining the effects queue.

## UI

`src/ui/` holds the pixel HUD (hearts, XP bar, combat text on a low-res canvas), the inventory panel
and tooltip (a view over the `Inventory` model in `src/items/inventory.ts`), ground labels, toasts, the
overlay and the reset bar. Clicks the UI handles are marked (`markHandled`) so the game doesn't also
treat them as attacks.

## How to...

**Add an enemy.** Add its tuning to `src/data/enemies.ts`. Add a brain component to `Components` and a
system that drives it (see `slimeSystem` or `mageSystem`), and put the system in `WORLD_SYSTEMS`. Spawn it
from `spawnEnemy()` in `src/game/spawn.ts` with `enemy` (add the kind to `EnemyKind`), `health`, `knockback`, your brain and
`renderable: { kind: "yourKind" }`. Add `"yourKind"` to `RenderKind` and a view to `VIEWS`. Weapons,
knockback, hit flashes and deaths already work on anything with an `enemy` component; give it its own XP
and drops in `deathSystem` (it gets the slime's otherwise). Give it a journal page: an entry in `BESTIARY` (`src/data/bestiary.ts`) and a portrait pose in `src/render/portraits.ts`.

**Add an item.** Add a base type to `BASES` in `src/data/items.ts`, an icon in `art/items/`, and its colour
mapping in `ICON_SWAPS` (`src/data/tiers.ts`). If it's worn, dress it in `dressBody()`
(`src/render/models/body.ts`). New stats go in `AFFIXES` and `Inventory.stats()`.

**Add a spell.** Add it to `SPELLS` (and a school in `SCHOOLS` if it's a school's signature) in
`src/data/enemies.ts`, then handle its release in `releaseSpell()` in `src/systems/mage.ts`. Bolts reuse the
`bolt` component; a new ground effect is an entity with its own component, system and view.

**Add an area.** Make `src/areas/<id>.ts` exporting `area: AreaDef` (see `capital.ts` for a hand-laid town
built from props). Give it entries, and exits that point at other areas' entries, and add the matching exits there.
`npm test` checks every link. Nothing else needs registering.

**Add a system.** Write `(g: Game, dt: number) => void`, put it in the list in `src/systems/index.ts` at the
point in the order where its inputs are ready, and add a test in `tests/`.

## Tests

`npm test` runs Vitest in Node. The map, loot rolls, sprites and font are checked against fixtures captured
from the original game, so generation can't drift. Gameplay tests drive `step()` directly: build a game,
place entities, set the `Input`, and step.
