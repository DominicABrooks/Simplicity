import { defineConfig, devices } from "@playwright/test";

// End-to-end specs (e2e/): the real game, built as for the site but with the debug handle on (`--mode e2e`),
// played in headless Chromium. WebGL runs on SwiftShader, so no GPU is needed (CI has none).
const PORT = 4319;

export default defineConfig({
  testDir: "e2e",
  // CI renders WebGL in software, slowly: one test at a time there, each given longer.
  timeout: process.env.CI ? 300_000 : 120_000,
  expect: { timeout: process.env.CI ? 45_000 : 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 3,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}/Simplicity/`,
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 }, launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
    },
  ],
  webServer: {
    command: `npx vite build --mode e2e --outDir dist-e2e --emptyOutDir && npx vite preview --mode e2e --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/Simplicity/`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
