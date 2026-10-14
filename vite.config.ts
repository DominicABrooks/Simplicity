import { defineConfig } from "vitest/config";

// The site is served from https://dominicabrooks.github.io/Simplicity/, so built URLs need that base.
export default defineConfig({
  base: "/Simplicity/",
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 1500, // three.js on its own is ~1.2 MB unminified
  },
  server: { port: 8123, strictPort: true },
  preview: { port: 8123, strictPort: true },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
