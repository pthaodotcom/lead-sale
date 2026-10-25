import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("screenshots/tasks");
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

  // 1. Login as Telesale Specialist
  await page.goto("https://ahamove-lead.vercel.app/", { waitUntil: "networkidle" });
  await page.waitForSelector('button:has-text("telesale1@lead-sale.local")', { timeout: 15000 });
  await page.click('button:has-text("telesale1@lead-sale.local")');
  await page.click('button[type="submit"]:has-text("Đăng nhập")');
  await page.waitForSelector("nav", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 2. Go to /tasks
  await page.goto("https://ahamove-lead.vercel.app/#/tasks", { waitUntil: "networkidle" });
  await page.waitForSelector(".queue-nav", { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "01_telesale_tasks_menu.png") });

  // Verify sidebar texts
  const navText = await page.locator(".queue-nav").innerText();
  console.log("=== Queue Nav Items ===\n" + navText);
  if (navText.includes("Chưa nhận việc")) {
    console.error("FAIL: 'Chưa nhận việc' still found in queue nav!");
  } else {
    console.log("PASS: 'Chưa nhận việc' is completely gone from queue nav!");
  }

  // 3. Click first ticket in table if exists
  const firstTicket = page.locator("table tbody tr.clickable").first();
  if (await firstTicket.isVisible()) {
    await firstTicket.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "02_ticket_detail_form.png") });
    console.log("Captured ticket detail screenshot.");
  }

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
