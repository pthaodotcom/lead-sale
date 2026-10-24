import { test, expect, type Browser, type Page } from "@playwright/test";
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
async function session(browser: Browser, role: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, role);
  return { context, page };
}
function wav() {
  const b = Buffer.alloc(16044);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  return b;
}
const DENIED = "Bạn không có quyền xem trang này";

test("Supabase thật: tiếp nhận → phân công → ghi nhận kèm ghi âm → lịch hẹn; quyền theo vai trò", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "intake");
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
  const leadUrl = page.url();
  await expect(page.getByText("Lịch sử tư vấn")).toHaveCount(0);

  const leader = await session(browser, "leader");
  await leader.page.goto(leadUrl);
  await leader.page.getByRole("button", { name: "Phân công tư vấn" }).click();
  const select = leader.page.getByLabel("Nhân viên Telesale");
  const sale = accounts.find((a) => a.role === "telesale")!;
  const option = select.locator("option", {
    hasText: new RegExp(sale.email.split("@")[0], "i"),
  });
  const assignee =
    (await option.count()) > 0
      ? await option.first().getAttribute("value")
      : await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(assignee!);
  await leader.page
    .getByRole("button", { name: "Tạo phiếu", exact: true })
    .click();
  await expect(leader.page.getByRole("dialog")).not.toBeVisible();
  await leader.page.getByRole("link", { name: /^PC-/ }).first().click();
  const ticketUrl = leader.page.url();

  const telesale = await session(browser, "telesale");
  const t = telesale.page;
  await t.goto(ticketUrl);
  const accept = t.getByRole("button", { name: "Nhận việc", exact: true });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await expect(accept).toHaveCount(0, { timeout: 15000 });
  await t.getByLabel("Quyết định của tài xế").selectOption("agreed");
  await t.getByLabel("Ghi chú").fill("Kiểm thử Supabase: tư vấn và hẹn.");
  const d = new Date(Date.now() + 2 * 86400000);
  await t
    .getByLabel("Ngày giờ hẹn")
    .fill(new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16));
  await t.getByLabel("Nơi hẹn").selectOption("văn phòng HN1");
  await t.getByLabel("Trạng thái phiếu sau liên hệ").selectOption("Open");
  const save = t.getByRole("button", { name: "Lưu lần liên hệ" });
  await expect(save).toBeDisabled();
  await t.getByLabel("Bằng chứng liên hệ").setInputFiles({
    name: "ghi-am-kiem-thu.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(t.getByText("ghi-am-kiem-thu.wav")).toBeVisible({
    timeout: 30000,
  });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(t.locator(".timeline")).toContainText(
    "Kiểm thử Supabase: tư vấn và hẹn.",
    { timeout: 30000 },
  );
  await t.reload();
  await expect(t.locator(".timeline")).toContainText(
    "Kiểm thử Supabase: tư vấn và hẹn.",
  );
  await expect(t.locator(".data-table")).toContainText("văn phòng HN1");
  await t.getByRole("button", { name: "ghi-am-kiem-thu.wav" }).click();
  await expect(t.locator("audio")).toBeVisible({ timeout: 15000 });
  for (const url of ["/#/reports", "/#/admin/users"]) {
    await t.goto(url);
    await expect(t.getByRole("heading", { name: DENIED })).toBeVisible();
  }
  await telesale.context.close();

  const admin = await session(browser, "admin");
  await expect(
    admin.page.getByRole("link", { name: "Hồ sơ Lead", exact: true }),
  ).toHaveCount(0);
  await admin.page.goto(leadUrl);
  await expect(admin.page.getByRole("heading", { name: DENIED })).toBeVisible();
  await expect(admin.page.getByText(phone)).toHaveCount(0);
  await admin.context.close();

  const viewer = await session(browser, "viewer");
  await viewer.page.goto("/#/leads");
  await expect(
    viewer.page.getByRole("heading", { name: DENIED }),
  ).toBeVisible();
  await viewer.context.close();

  // Keep an auditable synthetic record, closed so it is not left as work.
  await leader.page.goto(ticketUrl);
  await leader.page.reload();
  // Leader sees the Telesale's evidence-backed note within the team scope.
  await expect(leader.page.locator(".timeline")).toContainText(
    "Kiểm thử Supabase: tư vấn và hẹn.",
  );
  await leader.page.getByLabel("Chuyển phiếu sang").selectOption("Closed");
  await leader.page
    .getByLabel("Lý do")
    .fill("Hoàn tất kiểm thử giao diện với dữ liệu giả.");
  await leader.page
    .getByRole("button", { name: "Cập nhật phiếu", exact: true })
    .click();
  await expect(leader.page.locator(".callout")).toContainText("Phiếu đã đóng");
  await leader.context.close();
  expect(errors).toEqual([]);
});

test("Tiếp nhận và Trưởng nhóm dùng được trên điện thoại", async ({ page }) => {
  for (const [role, routes] of [
    ["intake", ["/leads", "/reports", "/handover"]],
    ["leader", ["/tasks", "/dispatch", "/reports"]],
  ] as const) {
    await login(page, role);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of routes) {
      await page.goto("/#" + route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Tài khoản" }).click();
    await page.getByRole("menuitem", { name: /Đăng xuất/ }).click();
  }
});
