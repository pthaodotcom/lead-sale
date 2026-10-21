import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/lead-sale",
  timeout: 30000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  reporter: "list",
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --mode demo --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
  },
});
