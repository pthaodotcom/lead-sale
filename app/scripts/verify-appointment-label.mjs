import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("screenshots/dashboard");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  // Login as Telesale Specialist
  await page.goto("https://ahamove-lead.vercel.app/", { waitUntil: "networkidle" });
  await page.waitForSelector('button:has-text("telesale1@lead-sale.local")', { timeout: 15000 });
  await page.click('button:has-text("telesale1@lead-sale.local")');
  await page.click('button[type="submit"]:has-text("Đăng nhập")');
  await page.waitForSelector(".kpis", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Take screenshot of Dashboard
  await page.screenshot({ path: path.join(OUT_DIR, "01_telesale_dashboard_appointment_label.png") });

  const kpiText = await page.locator(".kpis").innerText();
  console.log("=== Dashboard KPIs ===\n" + kpiText);

  if (kpiText.includes("Lịch hẹn hôm nay")) {
    console.error("FAIL: 'Lịch hẹn hôm nay' still found in KPI cards!");
  } else if (kpiText.includes("Lịch hẹn")) {
    console.log("PASS: 'Lịch hẹn' label verified in KPI cards!");
  } else {
    console.error("FAIL: 'Lịch hẹn' not found in KPI cards!");
  }

  // Check filter tabs above ticket table
  const tabText = await page.locator(".seg-tabs").innerText().catch(() => "");
  console.log("=== Tabs above table ===\n" + tabText);
  if (tabText.includes("Lịch hẹn hôm nay")) {
    console.error("FAIL: 'Lịch hẹn hôm nay' still found in table filter tab!");
  } else if (tabText.includes("Lịch hẹn")) {
    console.log("PASS: 'Lịch hẹn' label verified in table filter tab!");
  }

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
