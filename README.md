# Simplicity

A fantasy RPG drawn in 8×8 pixel sprites.

- [ART_STYLE.md](ART_STYLE.md): the rules every sprite follows
- `palette/simplicity.txt`: the 16-colour palette
- `art/`: sprites as text, one file per entity
- `tools/build.py`: turns `art/` into PNG sheets and GIF previews in `build/`

```
pip install pillow
python tools/build.py
```
