# Simplicity

A fantasy RPG that plays in 2D and looks like a late-90s 3D game: chunky low-poly models with PlayStation-style rendering, in the browser.

## Quick start

You need **Python 3** and an internet connection (three.js and the UI font load from CDNs). Nothing else to install to play.

1. Open a terminal in this folder (the one with this README).
2. Run the dev server:

   ```
   python tools/serve.py
   ```

   On macOS or Linux, use `python3` if `python` isn't found.
3. Open http://localhost:8123 in a browser.

The game is already built: `game/sprites.js` is generated from `art/` and committed. Rebuild only after changing the art (see the end of this file). The server disables browser caching, so a reload always picks up your edits. Opening `game/index.html` directly as a file won't work, because browsers block ES modules from `file://`.

## Play

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
- `game/tiers.js`: rarity colours shared by worn gear and inventory icons
- `tools/serve.py`: no-cache dev server

After editing anything in `art/`, rebuild:

```
pip install pillow
python tools/build.py
```
