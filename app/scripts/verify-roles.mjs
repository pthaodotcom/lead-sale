import { chromium } from "@playwright/test";

async function runRoleTest(browser, roleName, buttonText, checkFn) {
  console.log(`\n=== Testing ${roleName} ===`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto("https://ahamove-lead.vercel.app/#/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Click the demo account button
  await page.click(`button:has-text("${buttonText}")`);
  await page.waitForTimeout(200);

  // Submit login
  await page.click('button[type="submit"]:has-text("Đăng nhập")');
  await page.waitForTimeout(3000);

  console.log(`Current URL for ${roleName}:`, page.url());
  await checkFn(page);

  await context.close();
}

async function verify() {
  const browser = await chromium.launch({ headless: true });

  // 1. Admin
  await runRoleTest(browser, "Admin", "Quản trị", async (page) => {
    const hasUserMgmt = await page.$("text=Quản lý người dùng");
    const hasRoleMgmt = await page.$("text=Vai trò & phân quyền");
    const hasLeadsMenu = await page.$('nav >> text="Hồ sơ Lead"');
    console.log("Admin sees 'Quản lý người dùng':", !!hasUserMgmt);
    console.log("Admin sees 'Vai trò & phân quyền':", !!hasRoleMgmt);
    console.log("Admin blocked from Leads menu (AC01):", !hasLeadsMenu);
    if (!hasUserMgmt || !hasRoleMgmt || hasLeadsMenu) throw new Error("Admin role checks failed");
  });

  // 2. Telesale
  await runRoleTest(browser, "Telesale", "Telesale", async (page) => {
    const quickActions = await page.$(".quick-actions-bar");
    const kpiNew = await page.$('text="Phiếu mới"');
    const kpiCallback = await page.$('text="Cần gọi lại"');
    const kpiToday = await page.$('text="Lịch hẹn hôm nay"');
    const kpiRebook = await page.$('text="Cần hẹn lại"');
    console.log("Telesale sees Quick Actions Bar:", !!quickActions);
    console.log("Telesale sees 4 KPI cards:", !!kpiNew && !!kpiCallback && !!kpiToday && !!kpiRebook);

    const actionCol = await page.$('th:has-text("Thao tác")');
    console.log("Telesale ticket table has 'Thao tác' column:", !!actionCol);

    const reportsMenu = await page.$('nav >> text="Báo cáo"');
    console.log("Telesale has NO Reports menu:", !reportsMenu);

    // Visit Lead detail via Leads list as Telesale to test AC07
    await page.goto("https://ahamove-lead.vercel.app/#/leads", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const leadLink = await page.$(".record-link");
    if (leadLink) {
      await leadLink.click();
      await page.waitForTimeout(1500);
      const telesaleEditNote = await page.$('textarea[placeholder*="Ghi chú chi tiết"]');
      console.log("AC07: Telesale has NO direct Lead Note edit textarea:", !telesaleEditNote);
      const telesaleInfoTable = await page.$(".profile-table");
      console.log("Telesale views 8-field Lead Profile table:", !!telesaleInfoTable);
      if (telesaleEditNote || !telesaleInfoTable) throw new Error("Telesale lead profile checks failed");
    }

    if (!quickActions || !kpiNew || !actionCol || reportsMenu) {
      throw new Error("Telesale role checks failed");
    }
  });

  // 3. Intake
  await runRoleTest(browser, "Intake", "Tiếp nhận", async (page) => {
    const intakeLeads = await page.$('nav >> text="Hồ sơ Lead"');
    const intakeHandover = await page.$('nav >> text="Bàn giao Closed"');
    const intakeReports = await page.$('nav >> text="Báo cáo"');
    const intakeInbox = await page.$('nav >> text="Hộp thư"');
    console.log("Intake sees Hồ sơ Lead:", !!intakeLeads);
    console.log("Intake sees Bàn giao Closed:", !!intakeHandover);
    console.log("Intake sees Báo cáo:", !!intakeReports);
    console.log("Intake has NO Hộp thư in menu:", !intakeInbox);

    // Visit Lead detail as Intake
    await page.goto("https://ahamove-lead.vercel.app/#/leads", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const leadLink = await page.$(".record-link");
    if (leadLink) {
      await leadLink.click();
      await page.waitForTimeout(1500);
      const intakeEditNote = await page.$('textarea[placeholder*="Ghi chú chi tiết"]');
      console.log("Intake HAS Lead Note edit textarea (AC07):", !!intakeEditNote);
      const statusForm = await page.$('text=Cập nhật trạng thái hồ sơ');
      console.log("Intake HAS status update form:", !!statusForm);
      if (!intakeEditNote || !statusForm) throw new Error("Intake lead edit checks failed");
    }

    if (!intakeLeads || !intakeHandover || !intakeReports || intakeInbox) {
      throw new Error("Intake role checks failed");
    }
  });

  // 4. Team Leader
  await runRoleTest(browser, "Team Leader", "Trưởng nhóm", async (page) => {
    const leaderDispatch = await page.$('nav >> text="Điều phối"');
    const leaderTasks = await page.$('nav >> text="Nhiệm vụ"');
    const leaderReports = await page.$('nav >> text="Báo cáo"');
    console.log("Leader sees Điều phối:", !!leaderDispatch);
    console.log("Leader sees Nhiệm vụ:", !!leaderTasks);
    console.log("Leader sees Báo cáo:", !!leaderReports);

    // Test Reports for Leader
    await page.goto("https://ahamove-lead.vercel.app/#/reports", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const r1 = await page.$('text=Hiệu suất làm việc của chuyên viên Telesale');
    const r2 = await page.$('text=Kết quả liên hệ và tư vấn theo chuyên viên');
    const r3 = await page.$('text=Tỷ lệ chuyển đổi Lead');
    console.log("Leader sees Report 1 (Hiệu suất):", !!r1);
    console.log("Leader sees Report 2 (Kết quả tư vấn):", !!r2);
    console.log("Leader sees Report 3 (Chuyển đổi):", !!r3);

    if (!leaderDispatch || !leaderTasks || !leaderReports || !r1 || !r2 || !r3) {
      throw new Error("Team Leader role checks failed");
    }
  });

  await browser.close();
  console.log("\n=======================================================");
  console.log(">>> ALL 4 ROLES SMOKE TEST 100% PASSED ON VERCEL! <<<");
  console.log("=======================================================");
}

verify().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
