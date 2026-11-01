import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  reporter: "list",
});
