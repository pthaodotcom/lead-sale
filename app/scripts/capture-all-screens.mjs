import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("screenshots");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function createRoleSession(browser, buttonText) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();
  await page.goto("https://ahamove-lead.vercel.app/#/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Click the demo account button
  await page.click(`button:has-text("${buttonText}")`);
  await page.waitForTimeout(200);

  // Submit login
  await page.click('button[type="submit"]:has-text("Đăng nhập")');
  try {
    await page.waitForSelector(".kpis, .quick-actions-bar, nav, table, .settings-page", { timeout: 12000 });
  } catch {
    await page.waitForTimeout(4000);
  }
  await page.waitForTimeout(1000);
  return { context, page };
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  console.log("=== 0. Login Screen ===");
  {
    const context = await browser.newContext({ viewport: { width: 1366, height: 850 }, deviceScaleFactor: 1.5 });
    const page = await context.newPage();
    await page.goto("https://ahamove-lead.vercel.app/#/", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT_DIR, "00_login_screen.png") });
    await context.close();
  }

  console.log("=== 1. Telesale Role ===");
  {
    const { context, page } = await createRoleSession(browser, "Telesale");
    await page.screenshot({ path: path.join(OUT_DIR, "01_telesale_dashboard.png"), fullPage: true });

    // Open CallLogModal from Quick Actions Bar
    console.log("Opening CallLogModal...");
    const quickLogBtn = await page.$('.quick-actions-bar button:has-text("Ghi nhận cuộc gọi")');
    if (quickLogBtn) {
      await quickLogBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, "02_call_log_modal_phone.png") });

      // Click Zalo channel
      const zaloBtn = await page.$('.seg button:has-text("Zalo")');
      if (zaloBtn) {
        await zaloBtn.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT_DIR, "03_call_log_modal_zalo.png") });
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // Open Quick Call Dialog from Quick Actions Bar
    console.log("Opening Quick CallDialog...");
    const quickCallBtn = await page.$('.quick-actions-bar button:has-text("Gọi khách hàng")');
    if (quickCallBtn) {
      await quickCallBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, "04_call_quick_dialog.png") });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // Open Appointment Create Dialog from Quick Actions Bar
    console.log("Opening Appointment Dialog...");
    const quickApptBtn = await page.$('.quick-actions-bar button:has-text("Tạo lịch hẹn")');
    if (quickApptBtn) {
      await quickApptBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, "05_appointment_dialog.png") });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // Tasks Page
    console.log("Capturing Tasks Page...");
    await page.goto("https://ahamove-lead.vercel.app/#/tasks", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "06_telesale_tasks.png"), fullPage: true });

    // Ticket Detail Page
    const firstTicket = await page.$(".ticket-table .record-link, .data-table .record-link");
    if (firstTicket) {
      await firstTicket.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT_DIR, "07_ticket_detail.png"), fullPage: true });
    }

    // Appointments Page
    console.log("Capturing Appointments Page...");
    await page.goto("https://ahamove-lead.vercel.app/#/appointments", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "08_telesale_appointments.png"), fullPage: true });

    // Leads List & Lead Show
    console.log("Capturing Leads List (Telesale)...");
    await page.goto("https://ahamove-lead.vercel.app/#/leads", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "09_telesale_leads.png"), fullPage: true });

    const leadLink = await page.$(".record-link");
    if (leadLink) {
      await leadLink.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT_DIR, "10_telesale_lead_show.png"), fullPage: true });
    }

    await context.close();
  }

  console.log("=== 2. Team Leader Role ===");
  {
    const { context, page } = await createRoleSession(browser, "Trưởng nhóm");
    await page.screenshot({ path: path.join(OUT_DIR, "11_leader_dashboard.png"), fullPage: true });

    // Dispatch Queue
    console.log("Capturing Dispatch Queue...");
    await page.goto("https://ahamove-lead.vercel.app/#/dispatch", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "12_leader_dispatch.png"), fullPage: true });

    // Leader Reports
    console.log("Capturing Leader Reports...");
    await page.goto("https://ahamove-lead.vercel.app/#/reports", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, "13_leader_reports.png"), fullPage: true });

    await context.close();
  }

  console.log("=== 3. Intake Staff Role ===");
  {
    const { context, page } = await createRoleSession(browser, "Tiếp nhận");
    await page.screenshot({ path: path.join(OUT_DIR, "14_intake_dashboard.png"), fullPage: true });

    // Leads List
    console.log("Capturing Intake Leads List...");
    await page.goto("https://ahamove-lead.vercel.app/#/leads", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "15_intake_leads.png"), fullPage: true });

    // Create Lead Form
    console.log("Capturing Create Lead Form...");
    await page.goto("https://ahamove-lead.vercel.app/#/leads/create", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "16_intake_lead_create.png"), fullPage: true });

    // Import Leads
    console.log("Capturing Import Leads...");
    await page.goto("https://ahamove-lead.vercel.app/#/import", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "17_intake_import.png"), fullPage: true });

    // Handover (Closed)
    console.log("Capturing Handover Page...");
    await page.goto("https://ahamove-lead.vercel.app/#/handover", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "18_intake_handover.png"), fullPage: true });

    // Intake Reports (Sources)
    console.log("Capturing Intake Source Reports...");
    await page.goto("https://ahamove-lead.vercel.app/#/reports", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, "19_intake_reports.png"), fullPage: true });

    // Intake Lead Show
    await page.goto("https://ahamove-lead.vercel.app/#/leads", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const intakeLeadLink = await page.$(".record-link");
    if (intakeLeadLink) {
      await intakeLeadLink.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT_DIR, "20_intake_lead_show.png"), fullPage: true });
    }

    await context.close();
  }

  console.log("=== 4. Admin Role ===");
  {
    const { context, page } = await createRoleSession(browser, "Quản trị");
    await page.screenshot({ path: path.join(OUT_DIR, "21_admin_users.png"), fullPage: true });

    await page.goto("https://ahamove-lead.vercel.app/#/admin/roles", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "22_admin_roles.png"), fullPage: true });

    await context.close();
  }

  await browser.close();
  console.log("\n=======================================================");
  console.log(">>> ALL SCREENSHOTS SUCCESSFULLY CAPTURED! <<<");
  console.log("=======================================================");
}

run().catch((e) => {
  console.error("Screenshot capture failed:", e);
  process.exit(1);
});
