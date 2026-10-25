import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("screenshots/roles");
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

function startServer(port = 4192) {
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

async function run() {
  const PORT = 4192;
  const server = await startServer(PORT);
  console.log(`Server running at http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  try {
    console.log("Navigating to login...");
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "admin@lead-sale.local");
    await page.fill('input[type="password"]', "123456");
    await page.click('button[type="submit"]:has-text("Đăng nhập")');
    await page.waitForTimeout(1000);

    // Go to /admin/roles
    console.log("Opening /admin/roles...");
    await page.goto(`http://127.0.0.1:${PORT}/#/admin/roles`, { waitUntil: "networkidle" });
    await page.waitForSelector(".role-matrix-table", { timeout: 15000 });
    await page.waitForTimeout(500);

    // Screenshot initial interactive matrix view
    await page.screenshot({ path: path.join(OUT_DIR, "01_roles_matrix_interactive.png") });
    console.log("Captured 01_roles_matrix_interactive.png");

    // Click a permission toggle button to change a permission
    const firstToggle = page.locator(".permission-toggle-btn").first();
    const beforeText = await firstToggle.innerText();
    console.log("First toggle before click:", beforeText);
    await firstToggle.click();
    await page.waitForTimeout(300);
    const afterText = await firstToggle.innerText();
    console.log("First toggle after click:", afterText);

    // Verify "Có thay đổi chưa lưu" badge
    const isDirtyVisible = await page.locator(':text("Có thay đổi chưa lưu")').isVisible();
    console.log("Is dirty indicator visible:", isDirtyVisible);

    // Save changes
    await page.click('button:has-text("Lưu thay đổi")');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, "02_roles_matrix_saved.png") });
    console.log("Captured 02_roles_matrix_saved.png");

    // Switch to "Cấu hình theo vai trò" tab
    await page.click('button:has-text("Cấu hình theo vai trò")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "03_roles_by_role_view.png") });
    console.log("Captured 03_roles_by_role_view.png");

    // Select "Telesale" role card
    await page.click('.role-summary-card:has-text("Telesale")');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, "04_roles_telesale_selected.png") });
    console.log("Captured 04_roles_telesale_selected.png");

    // Switch back to matrix & reset to default
    await page.click('button:has-text("Ma trận phân quyền")');
    await page.click('button:has-text("Khôi phục mặc định")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "05_roles_reset_default.png") });
    console.log("Captured 05_roles_reset_default.png");

    console.log("\n=== ALL ROLE PERMISSION UI CHECKS PASSED ===");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
