# Simplicity Art Style

Simplicity is a fantasy RPG that **plays in 2D and looks like a late-90s 3D game**: chunky, saturated low-poly models in the spirit of early World of Warcraft, rendered with PlayStation 1 limitations. Every gameplay rule happens on a flat 2D grid. The 3D view only presents it.

## The rule above all

**Gameplay is 2D; the renderer only presents it.** `game/main.js` owns positions, collision, hitboxes and timing in 8 px-per-tile units. `game/view.js` reads that state and draws it, and never changes it. Any new visual must be derivable from game state.

## World and camera

- One tile = one world unit. Game `x` becomes world X, game `y` becomes world Z, and height is visual only (jumps, hops, bobbing).
- The camera looks down at about 54° from the south and follows the player smoothly. It never rotates, so left and right on screen always match left and right in the game.
- The map edge is a forest, never a wall: the tree line wanders 1–4 tiles deep, trees sit slightly off-grid with varied size and colour, a dense decorative forest continues beyond the map into the fog, and bushes and rocks soften every treeline that faces open ground. Collision still follows the tiles exactly.
- Ground sits at height 0. Water (62% opaque, so fish show through) is sunk to −0.15 over a bed at −0.6, with earth walls along the shore, so every tile type reads as a little diorama.

## PlayStation rendering

These limits are the look. Don't remove them to make things "cleaner".

- **Low resolution:** the scene renders at about 300 lines and is scaled up with nearest-neighbour filtering. No antialiasing.
- **Vertex wobble:** vertices snap to a coarse screen grid (the `ps1()` material wrapper). Every material goes through it.
- **Fog** fades the world into the `void` colour at the edges of view.
- **Dithering** is on for lit materials.
- **No real-time shadows.** Characters and items get a soft black blob shadow that shrinks as they leave the ground.

## Models

- **Low poly, flat shaded.** Build from primitives: lathes and cones with 5–7 sides, level-0 icosahedrons, boxes. Budgets: characters about 300 triangles, props about 150.
- **WoW proportions.** Heads, hoods, weapons and trims are oversized. Silhouettes are bold and readable from above.
- **Creatures, not people.** No skin tones, hands or mouths. A face is a `void` opening with two glowing eyes (unlit material, so they always shine). Weapons float beside the body.
- Models are built facing **+X** (screen right). The hero turns to face the aim (the cursor, or the movement direction without a mouse); enemies face the way they're moving.

## The hero and gear

The hero starts **naked**, WoW-style: a small stone (`stone`) spirit with a round body, a `void` face with glowing eyes, stub feet and a plain `bark` wrap. Every equipped piece adds its own model, so the character's look is the sum of its gear:

| Slot | Model |
|---|---|
| Helm | Hood with a backward-leaning tip; the eyes move forward into its opening |
| Armor | Robe and mantle; the feet move forward to peek out from under the hem |
| Boots | Chunky boots with a trim cuff replace the stub feet |
| Weapon | The floating sword, or a fishing pole (oak pole, grip and reel) |
| Amulet | A chain and a glowing pendant on the chest |
| Ring | A small glowing ring orbiting the body |

**Rarity is visible.** The gear tier sets the cloth, trim and glow:

| Tier | Cloth | Trim and metal | Glow |
|---|---|---|---|
| Normal | `oak` / `bark` | `bark`, dull `stone` blade | none |
| Magic | `azure` / `deep` | `stone`, `bone` blade | soft `mana` |
| Rare | `arcane` / dark purple | `glow` gold | strong `glow` |

New gear types must follow the same rule: a distinct silhouette per slot, with colour and glow from the tier.

Tier colours live in one place, `game/tiers.js`, and both the 3D gear and the inventory icons read from it, so an item looks the same in the bag as it does worn. Item icons in `art/items/` are drawn in the magic (azure) colours; `ICON_SWAPS` in `tiers.js` maps each icon's pixels to tier colours. A new item type needs an entry there.

## Textures

- **Tiny and hand-painted:** 8–32 px canvases painted in code with palette colours, nearest-filtered, no mipmaps.
- **Texel density matches the screen.** One texel should be roughly one screen pixel. Ground textures span 4×4 tiles. A 32 px texture on a single tile aliases into moiré stripes.
- Detail lives in the texture, not the geometry: cloth folds, gold trim along hems, bark lines, leaf clumps.
- Ground stays dark and quiet (`pine` with `moss` blades). Bright, saturated colours are kept for things you can interact with.

## Light

- A warm sun from the top-left of the screen plus a cool sky-and-ground hemisphere light. Nothing else.
- Emissive colour is for things that should glow: eyes, potions, the blade.

## Palette

All colours come from the 16-colour palette in [`palette/simplicity.txt`](palette/simplicity.txt). Textures may mix in a lighter or darker step of a palette colour for painted detail, but every base colour is from the palette.

| Role | Colours |
|---|---|
| Outline, voids, fog | `ink` `void` |
| Light and metal | `bone` `stone` |
| Fire, danger, health | `ember` `blood` `amber` |
| Light sources, eyes, gold trim | `glow` |
| Nature | `moss` `pine` `oak` `bark` |
| Water, magic | `mana` `azure` `deep` `arcane` |

## Animation

Animation is procedural in `view.js`, driven by game state and timers. Keep it snappy and readable from above.

| State | Motion |
|---|---|
| idle | Slow breathing scale; eyes blink every 3 s |
| walk | Quick bob, forward lean, feet shuffle |
| swim | Sunk so only the hood shows, gentle bob, ripple ring |
| jump | Squash on take-off, stretch in the air, blob shadow shrinks |
| dash | Hard forward lean and stretch, a dust puff on take-off, fading `mana` afterimages |
| attack | Weapon winds up behind, then thrusts forward exactly when the hit lands in game logic |
| hurt | Model blinks while invulnerable |
| hit enemy | White flash plus a burst of tumbling octahedron sparks |
| fish | Koi just under the water surface: wander, wiggle their tails, turn back at the shore, dart away from the hero |
| fishing | Holding the button draws the pole back behind the head (trembling as it's held) and a spinning ring marks the landing spot, `mana` over water and faded `stone` over land; releasing swings it forward; the bobber arcs out on a sagging line; koi drift toward it; on a bite the bobber dips with a splash ring and a gold **!** pops over the hero; the catch leaps out of the water to the hero |

## UI and icons

UI panels (inventory, tooltips, ground labels) are dark `void`/`ink` panels with a `bark` border and an `oak` inner line, titled in Cinzel caps in `glow`. Item rarity is colour-coded everywhere: normal in `bone`, magic in soft azure (#7fa6ff), rare in `glow`. On the ground, magic items get a short light beam and rares a tall one.

Item icons are pixel art in `art/items/`, 8 px per inventory cell (a 1×3 blade is 8×24), outlined like every other icon. Empty equipment slots show the slot's icon as a faded grey silhouette.


The HUD stays as 8×8 pixel icons with a 1 px `ink` outline, drawn from `art/*.txt` by `tools/build.py` (hearts today). Pixel UI over a low-poly world is period-correct. The rules for those icons:

- 8×8 cells, faces right, outline added at render time, 3–4 colours (5 at most), lit from the top-left.
- Sprite text format: `@anim ms`, then 8-row frames separated by blank lines. `!tile` marks a sprite that is never outlined.

The pixel versions of the Wanderer, slime and potion in `art/` are kept as reference designs and for icons. The 3D models in `view.js` follow the same shapes and colours.
