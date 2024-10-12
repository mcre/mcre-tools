import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/playwright",
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    baseURL: "http://localhost:3000",
    video: "on",
    screenshot: "on",
    trace: "on",
  },
});
