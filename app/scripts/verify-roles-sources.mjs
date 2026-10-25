import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("screenshots/sources");
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

  // 1. Check Login Screen Test Accounts
  await page.goto("https://ahamove-lead.vercel.app/", { waitUntil: "networkidle" });
  await page.waitForSelector(".auth-test-list", { timeout: 15000 });
  await page.screenshot({ path: path.join(OUT_DIR, "01_login_no_viewer.png") });

  const testAccountsText = await page.locator(".auth-test-list").innerText();
  console.log("=== Test Accounts on Login ===\n" + testAccountsText);
  if (testAccountsText.includes("Xem báo cáo") || testAccountsText.includes("baocao@lead-sale.local")) {
    console.error("FAIL: 'Xem báo cáo' account still exists on login page!");
  } else {
    console.log("PASS: 'Xem báo cáo' account is completely removed!");
  }

  // 2. Login as Intake
  await page.click('button:has-text("tiepnhan@lead-sale.local")');
  await page.click('button[type="submit"]:has-text("Đăng nhập")');
  await page.waitForSelector("nav", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 3. Check Dashboard "Lead theo nguồn tiếp nhận"
  await page.screenshot({ path: path.join(OUT_DIR, "02_intake_dashboard_sources.png") });
  const dashboardSources = await page.locator('.panel:has-text("Lead theo nguồn tiếp nhận")').innerText();
  console.log("=== Dashboard Sources ===\n" + dashboardSources);

  // 4. Open "Tiếp nhận Lead" (/leads/create) to verify manual sources
  await page.goto("https://ahamove-lead.vercel.app/#/leads/create", { waitUntil: "networkidle" });
  await page.waitForSelector('select[name="sourceId"], select:near(:text("Nguồn Lead"))', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "03_manual_intake_sources_dropdown.png") });

  const sourceSelect = page.locator('select:near(:text("Nguồn Lead"))').first();
  const options = await sourceSelect.locator("option").allInnerTexts();
  console.log("=== Manual Source Options in Create Form ===\n", options);

  const hasForm = options.some((o) => o.includes("Form website") || o.includes("Form"));
  const hasFb = options.some((o) => o.includes("Facebook"));
  const hasHotline = options.some((o) => o.includes("Hotline"));
  const hasReferral = options.some((o) => o.includes("Tài xế cũ giới thiệu"));

  if (hasForm) {
    console.error("FAIL: 'Form website' should NOT be present when creating manually!");
  } else {
    console.log("PASS: 'Form website' is correctly excluded from manual creation!");
  }

  if (hasFb && hasHotline && hasReferral) {
    console.log("PASS: All 3 manual sources (Facebook, Hotline, Tài xế cũ giới thiệu) are present!");
  } else {
    console.error("FAIL: Missing expected manual sources!", { hasFb, hasHotline, hasReferral });
  }

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
