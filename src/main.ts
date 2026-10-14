// Transitional entry: the legacy JS reads its assets from globals, so set them from the generated
// modules, then load it. Replaced by the TypeScript/ECS bootstrap as the port proceeds.
import "./styles.css";
import { SPRITES } from "./assets/generated/sprites.ts";
import { PIXEL_FONT } from "./assets/generated/font.ts";

Object.assign(window, { SPRITES, PIXEL_FONT });
await import("./legacy/main.js");
