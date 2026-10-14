# Simplicity

A fantasy RPG that plays in 2D and looks like a late-90s 3D game: chunky low-poly models with PlayStation-style rendering, in the browser.

## Play

Run the dev server (it disables browser caching so reloads always pick up edits; three.js loads from a CDN):

```
python tools/serve.py
```

Then open http://localhost:8123.

WASD or arrows to move (double-tap a direction to dash), the mouse to aim, Space to jump, J or click to attack in the aimed direction. Walk into water to swim. Slimes chase you, and potions restore two hearts.

Slimes drop loot. Walk over it to pick it up, and press I (or Tab) for the inventory: click an item to pick it up, click to place it, right-click to equip or unequip, and click outside the panel to drop what you're holding. Equipment adds damage, life, movement speed and faster dash recovery, and every piece shows on your character. You start with nothing equipped and a plain starter set in your bag.

## Layout

- [ART_STYLE.md](ART_STYLE.md): the rules every sprite follows
- `palette/simplicity.txt`: the 16-colour palette
- `art/`: pixel sprites as text, used for HUD icons and as reference designs
- `tools/build.py`: turns `art/` into PNG sheets and previews in `build/`, and `game/sprites.js` for the game
- `game/main.js`: gameplay (2D, 8 px per tile)
- `game/view.js`: the low-poly 3D renderer (three.js)
- `game/inventory.js`: items, loot rolls, the inventory grid and equipment
- `tools/serve.py`: no-cache dev server

After editing anything in `art/`, rebuild:

```
pip install pillow
python tools/build.py
```
