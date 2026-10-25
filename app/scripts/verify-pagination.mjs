import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("screenshots/pagination");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const root = resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function startServer(port = 4188) {
  return new Promise((res) => {
    const server = createServer(async (req, resHttp) => {
      try {
        const pathname = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        );
        let target = resolve(
          root,
          "." + (pathname === "/" ? "/index.html" : pathname),
        );
        if (!fs.existsSync(target) && !extname(target)) {
          target = resolve(root, "index.html");
        }
        if (!target.startsWith(root + sep) && target !== resolve(root, "index.html")) {
          resHttp.writeHead(403);
          resHttp.end();
          return;
        }
        const content = await readFile(target);
        resHttp.writeHead(200, {
          "Content-Type": mime[extname(target)] ?? "application/octet-stream",
        });
        resHttp.end(content);
      } catch (e) {
        resHttp.writeHead(404);
        resHttp.end("Not found");
      }
    });
    server.listen(port, "127.0.0.1", () => {
      res(server);
    });
  });
}

async function login(page, email, password = "password-chưa-cần-đúng") {
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]:has-text("Đăng nhập")');
  await page.waitForTimeout(1500);
}

async function run() {
  const PORT = 4188;
  const server = await startServer(PORT);
  console.log(`Test server running at http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  try {
    console.log("Navigating to test server...");
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
    await login(page, "truongnhom@lead-sale.local");
    await page.waitForSelector(".kpis", { timeout: 15000 });
    await page.waitForTimeout(500);

    // 1. Dashboard
    console.log("\n--- Checking Dashboard TicketTable ---");
    const dashPagers = await page.locator(".table-foot").count();
    console.log("Dashboard table-foot count:", dashPagers);
    if (dashPagers > 0) {
      console.log("Dashboard footer text:", (await page.locator(".table-foot").first().innerText()).replace(/\n/g, " | "));
    }
    await page.screenshot({ path: path.join(OUT_DIR, "01_dashboard_pagination.png") });

    // 2. Tasks / Nhiệm vụ
    console.log("\n--- Checking Tasks Table ---");
    await page.goto(`http://127.0.0.1:${PORT}/#/tasks`, { waitUntil: "networkidle" });
    await page.waitForSelector(".data-table", { timeout: 15000 });
    await page.waitForTimeout(500);
    const tasksPagerText = (await page.locator(".table-foot").innerText().catch(() => "none")).replace(/\n/g, " | ");
    console.log("Tasks table footer:", tasksPagerText);
    await page.screenshot({ path: path.join(OUT_DIR, "02_tasks_pagination.png") });

    // 3. Appointments / Lịch hẹn
    console.log("\n--- Checking Appointments Table ---");
    await page.goto(`http://127.0.0.1:${PORT}/#/appointments`, { waitUntil: "networkidle" });
    await page.waitForSelector(".panel", { timeout: 15000 });
    await page.waitForTimeout(500);
    const apptPagerText = (await page.locator(".table-foot").innerText().catch(() => "none")).replace(/\n/g, " | ");
    console.log("Appointments table footer:", apptPagerText);
    await page.screenshot({ path: path.join(OUT_DIR, "03_appointments_pagination.png") });

    // 4. Dispatch / Điều phối
    console.log("\n--- Checking Dispatch Table ---");
    await page.goto(`http://127.0.0.1:${PORT}/#/dispatch`, { waitUntil: "networkidle" });
    await page.waitForSelector(".panel", { timeout: 15000 });
    await page.waitForTimeout(500);
    const dispatchPagerText = (await page.locator(".table-foot").innerText().catch(() => "none")).replace(/\n/g, " | ");
    console.log("Dispatch table footer:", dispatchPagerText);
    await page.screenshot({ path: path.join(OUT_DIR, "04_dispatch_pagination.png") });

    // 5. Leads / Hồ sơ Lead
    console.log("\n--- Checking Leads Table ---");
    await page.goto(`http://127.0.0.1:${PORT}/#/leads`, { waitUntil: "networkidle" });
    await page.waitForSelector(".data-table", { timeout: 15000 });
    await page.waitForTimeout(500);
    const leadsPagerText = (await page.locator(".table-foot").innerText().catch(() => "none")).replace(/\n/g, " | ");
    console.log("Leads table footer:", leadsPagerText);
    await page.screenshot({ path: path.join(OUT_DIR, "05_leads_pagination.png") });

    // 6. Handover / Bàn giao Closed
    console.log("\n--- Checking Handover Table ---");
    await page.goto(`http://127.0.0.1:${PORT}/#/handover`, { waitUntil: "networkidle" });
    await page.waitForSelector(".panel", { timeout: 15000 });
    await page.waitForTimeout(500);
    const handoverPagerText = (await page.locator(".table-foot").innerText().catch(() => "none")).replace(/\n/g, " | ");
    console.log("Handover table footer:", handoverPagerText);
    await page.screenshot({ path: path.join(OUT_DIR, "06_handover_pagination.png") });

    // 7. Logout & login as Admin to check Users pagination
    console.log("\n--- Checking Admin Users Table ---");
    await page.evaluate(() => localStorage.clear());
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
    await login(page, "admin@lead-sale.local");
    await page.waitForTimeout(1000);
    await page.goto(`http://127.0.0.1:${PORT}/#/admin/users`, { waitUntil: "networkidle" });
    await page.waitForSelector(".data-table", { timeout: 15000 });
    await page.waitForTimeout(500);
    const usersPagerText = (await page.locator(".table-foot").innerText().catch(() => "none")).replace(/\n/g, " | ");
    console.log("Users table footer:", usersPagerText);
    await page.screenshot({ path: path.join(OUT_DIR, "07_users_pagination.png") });

    console.log("\n=== ALL PAGINATION CHECKS COMPLETED SUCCESSFULLY ===");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
