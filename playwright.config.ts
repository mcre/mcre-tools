import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error("Invalid PLAYWRIGHT_PORT");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  testDir: "./src/tests/playwright",
  retries: 2,
  workers: 1,
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `${baseURL}/ja`,
  },
  use: {
    actionTimeout: 0,
    baseURL,
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
