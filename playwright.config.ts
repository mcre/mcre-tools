import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  testDir: "./src/tests/playwright",
  retries: 2,
  workers: 1,
  webServer: {
    command: "npm run build && npm run preview",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:4173/ja",
  },
  use: {
    actionTimeout: 0,
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
