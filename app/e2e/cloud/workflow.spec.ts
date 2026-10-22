import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const accounts: { email: string; password: string; role: string }[] =
  JSON.parse(readFileSync(".env.accounts.local", "utf8"));
async function login(page: Page, role: string) {
  const account = accounts.find((a) => a.role === role)!;
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tài khoản" })).toBeVisible({
    timeout: 30000,
  });
}
test("đăng nhập thật, tạo hồ sơ, nhận việc và ghi tư vấn; báo cáo không lộ hồ sơ", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "admin");
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await expect(page.getByText("Xem thử với vai trò")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const name = `Kiểm thử giao diện ${Date.now()}`;
  const phone = "09" + String(Date.now() % 100000000).padStart(8, "0");
  await page.goto("/#/leads/create");
  await page.getByLabel("Họ và tên").fill(name);
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Thành phố đăng ký").fill("Hà Nội");
  await page.getByLabel("Nguồn Lead").selectOption("web");
  await page.getByRole("button", { name: "Tạo hồ sơ", exact: true }).click();
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await page.getByRole("button", { name: "Phân công tư vấn" }).click();
  const select = page.getByLabel("Nhân viên Telesale");
  const assignee = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(assignee!);
  await page.getByRole("button", { name: "Tạo phiếu", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".data-table").getByRole("link", { name: /^PC-/ }).click();
  const ticketUrl = page.url();
  await page
    .getByLabel("Ghi chú")
    .fill("Dữ liệu giả để kiểm tra lưu từ giao diện lên Supabase.");
  await page.getByRole("button", { name: "Lưu lần liên hệ" }).click();
  await expect(page.locator(".timeline")).toContainText(
    "Dữ liệu giả để kiểm tra",
  );
  await page.reload();
  await expect(page.locator(".timeline")).toContainText(
    "Dữ liệu giả để kiểm tra",
  );
  const saleContext = await browser.newContext();
  const salePage = await saleContext.newPage();
  await login(salePage, "telesale");
  await salePage.goto(ticketUrl);
  await salePage
    .getByRole("button", { name: "Nhận việc", exact: true })
    .click();
  await expect(
    salePage.getByRole("button", { name: "Nhận việc", exact: true }),
  ).toHaveCount(0);
  await salePage
    .getByLabel("Ghi chú")
    .fill("Telesale đã nhận việc và liên hệ tài xế mẫu.");
  await salePage.getByRole("button", { name: "Lưu lần liên hệ" }).click();
  await expect(salePage.locator(".timeline")).toContainText(
    "Telesale đã nhận việc",
  );
  await saleContext.close();
  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await login(viewerPage, "viewer");
  await viewerPage.goto("/#/reports");
  await expect(
    viewerPage.getByRole("heading", {
      name: "Báo cáo",
      exact: true,
    }),
  ).toBeVisible();
  const downloadEvent = viewerPage.waitForEvent("download");
  await viewerPage.getByRole("button", { name: "Xuất CSV" }).click();
  const exportPath = await (await downloadEvent).path();
  const exported = readFileSync(exportPath!, "utf8");
  expect(exported).toContain("Tổng Lead");
  expect(exported).not.toContain(phone);
  expect(exported).not.toContain(name);
  await viewerPage.goto("/#/leads");
  await expect(
    viewerPage.getByRole("heading", {
      name: "Bạn không có quyền xem trang này",
    }),
  ).toBeVisible();
  await expect(viewerPage.getByText(phone, { exact: true })).toHaveCount(0);
  await viewerContext.close();
  // Keep an auditable synthetic record, closed so it does not remain work to do.
  await page.reload();
  await page.getByLabel("Chuyển phiếu sang").selectOption("Closed");
  await page
    .getByLabel("Lý do")
    .fill("Hoàn tất kiểm thử giao diện với dữ liệu giả.");
  await page
    .getByRole("button", { name: "Cập nhật phiếu", exact: true })
    .click();
  await expect(page.locator(".callout")).toContainText("Phiếu đã đóng");
  expect(errors).toEqual([]);
});

test("quản trị, báo cáo và hồ sơ dùng được trên điện thoại", async ({
  page,
}, testInfo) => {
  await login(page, "admin");
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  await page.goto("/#/admin/users");
  await expect(
    page.getByText("admin@lead-sale.local", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/leads", "/reports", "/handover"]) {
    await page.goto("/#" + route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("mobile.png"),
    fullPage: true,
  });
});
