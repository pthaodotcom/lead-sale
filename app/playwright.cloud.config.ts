import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/cloud",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5175",
    headless: true,
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  reporter: "list",
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: !process.env.CI,
  },
});
