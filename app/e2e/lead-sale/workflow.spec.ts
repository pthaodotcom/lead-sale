import { test, expect } from "@playwright/test";

test("tạo Lead → phân công → tư vấn và lịch hẹn → tải lại vẫn còn dữ liệu", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Tiếp nhận Lead", exact: true }).click();
  await page.getByLabel("Họ và tên").fill("Tài Xế E2E");
  await page.getByLabel("Số điện thoại").fill("+84912345678");
  await page.getByLabel("Thành phố đăng ký").fill("Hà Nội");
  await page.getByLabel("Nguồn Lead").selectOption("web");
  await page.getByRole("button", { name: "Tạo hồ sơ Lead" }).click();
  await page
    .getByRole("link", { name: /Tài Xế E2E/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Tài Xế E2E", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Phân công tư vấn" }).click();
  await page.getByLabel("Nhân viên Telesale").selectOption("sale-1");
  await page.getByRole("button", { name: "Tạo phiếu", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".data-table").getByRole("link", { name: /^PC-/ }).click();
  await page.getByLabel("Quyết định tài xế").selectOption("agreed");
  await page
    .getByLabel("Nội dung tư vấn")
    .fill("Đã tư vấn và hẹn đến đăng ký.");
  const date = new Date(Date.now() + 86400000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Ngày và giờ hẹn").fill(local);
  await page.getByLabel("Địa điểm hẹn").fill("Văn phòng Hà Nội");
  await page.getByRole("button", { name: "Lưu kết quả tư vấn" }).click();
  await expect(page.locator(".timeline")).toContainText(
    "Đã tư vấn và hẹn đến đăng ký.",
  );
  await page.reload();
  await expect(page.locator(".timeline")).toContainText(
    "Đã tư vấn và hẹn đến đăng ký.",
  );
  await page.getByRole("button", { name: /^Lịch hẹn/ }).click();
  await expect(page.locator(".appointment-row")).toContainText(
    "Văn phòng Hà Nội",
  );
  expect(errors).toEqual([]);
});

test("cảnh báo SĐT trùng và không tạo thêm hồ sơ", async ({ page }) => {
  await page.goto("/#/leads/create");
  await page.getByLabel("Họ và tên").fill("Tài Xế Trùng");
  await page.getByLabel("Số điện thoại").fill("+84901000000");
  await page.getByLabel("Thành phố đăng ký").fill("Hà Nội");
  await page.getByLabel("Nguồn Lead").selectOption("web");
  await page.getByRole("button", { name: "Tạo hồ sơ Lead" }).click();
  await expect(page.getByText(/Số điện thoại đã có trong hồ sơ/)).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("lead-sale.demo.v1")!).leads.length,
    ),
  ).toBe(20);
});

test("Telesale chỉ xử lý phiếu của mình và không sửa Lead", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Chọn vai trò dùng thử").selectOption("sale-1");
  await expect(
    page.getByRole("link", { name: "Tiếp nhận Lead", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#/leads/create");
  await expect(
    page.getByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
  ).toBeVisible();
  await page.goto("/#/assignments/PC-0002/show");
  await expect(
    page.getByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
  ).toBeVisible();
  await page.goto("/#/assignments/PC-0001/show");
  await expect(
    page.getByRole("heading", { name: "Ghi nhận tư vấn" }),
  ).toBeVisible();
  await page.goto("/#/settings");
  await expect(
    page.getByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
  ).toBeVisible();
});

test("lọc báo cáo khớp số hồ sơ và xuất CSV", async ({ page }) => {
  await page.goto("/#/reports");
  await page.getByLabel("Nguồn", { exact: true }).selectOption("web");
  await expect(
    page.locator(".report-stats > div").first().locator("strong"),
  ).toHaveText("5");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV đang lọc" }).click();
  expect((await download).suggestedFilename()).toBe("bao-cao-lead.csv");
});

test("điện thoại mở menu và màn hình chính không tràn ngang", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await page.getByRole("link", { name: "Hồ sơ Lead", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hồ sơ Lead", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
