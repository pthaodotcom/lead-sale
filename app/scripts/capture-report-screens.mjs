import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("screenshots/reports");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function createRoleSession(browser, buttonText) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();
  await page.goto("https://ahamove-lead.vercel.app/#/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Click demo account button
  await page.click(`button:has-text("${buttonText}")`);
  await page.waitForTimeout(200);

  // Submit login
  await page.click('button[type="submit"]:has-text("Đăng nhập")');
  await page.waitForSelector("nav", { timeout: 15000 });
  await page.waitForTimeout(1000);
  return { context, page };
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  console.log("=== Testing Leader Reports ===");
  {
    const { context, page } = await createRoleSession(browser, "Trưởng nhóm");
    await page.goto("https://ahamove-lead.vercel.app/#/reports", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // 1. Leader Report 1: Hiệu suất làm việc của chuyên viên Telesale
    await page.screenshot({ path: path.join(OUT_DIR, "01_leader_report_performance.png"), fullPage: true });

    // 2. Leader Report 2: Kết quả liên hệ và tư vấn theo chuyên viên
    const select = page.locator(".report-toolbar-card select").first();
    await select.selectOption("telesale_contact_result");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "02_leader_report_contact_result.png"), fullPage: true });

    // 3. Leader Report 3: Báo cáo tỷ lệ chuyển đổi Lead
    await select.selectOption("telesale_lead_conversion");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "03_leader_report_conversion.png"), fullPage: true });

    await context.close();
  }

  console.log("=== Testing Intake Reports ===");
  {
    const { context, page } = await createRoleSession(browser, "Tiếp nhận");
    await page.goto("https://ahamove-lead.vercel.app/#/reports", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // 4. Intake Report 1: Tỷ trọng số hồ sơ theo nguồn tiếp nhận
    await page.screenshot({ path: path.join(OUT_DIR, "04_intake_report_source_share.png"), fullPage: true });

    // 5. Intake Report 2: Trạng thái hồ sơ Lead theo nguồn tiếp nhận
    const select = page.locator(".report-toolbar-card select").first();
    await select.selectOption("intake_source_status");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "05_intake_report_source_status.png"), fullPage: true });

    await context.close();
  }

  await browser.close();
  console.log("Done capturing report screenshots!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
