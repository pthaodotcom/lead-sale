import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/core",
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
