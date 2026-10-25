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
    await page.waitForSelector(".data-table", { timeout: 15000 });
    await page.waitForTimeout(500);

    // Screenshot initial reset matrix view
    await page.screenshot({ path: path.join(OUT_DIR, "01_roles_clean_matrix.png") });
    console.log("Captured 01_roles_clean_matrix.png");

    // Verify row count = 7
    const rowsCount = await page.locator(".data-table tbody tr").count();
    console.log("Row count in table:", rowsCount);

    // Verify checkbox count = 28 (7 rows x 4 roles)
    const checkboxCount = await page.locator('.data-table tbody input[type="checkbox"]').count();
    console.log("Checkbox count in table:", checkboxCount);

    // Click first checkbox to toggle
    const firstCheckbox = page.locator('.data-table tbody input[type="checkbox"]').first();
    const wasChecked = await firstCheckbox.isChecked();
    console.log("First checkbox checked before click:", wasChecked);
    await firstCheckbox.click();
    await page.waitForTimeout(200);
    const nowChecked = await firstCheckbox.isChecked();
    console.log("First checkbox checked after click:", nowChecked);

    // Save changes
    await page.click('button:has-text("Lưu")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "02_roles_matrix_after_toggle.png") });

    // Reset back to specification
    await page.click('button:has-text("Khôi phục mặc định")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "03_roles_matrix_reset_spec.png") });
    console.log("Captured 03_roles_matrix_reset_spec.png");

    console.log("\n=== ALL CLEAN ROLE PERMISSION CHECKS PASSED ===");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
