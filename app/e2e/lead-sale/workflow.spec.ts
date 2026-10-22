import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";

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
  await page.getByRole("button", { name: "Tạo hồ sơ", exact: true }).click();
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
  await page.getByLabel("Quyết định của tài xế").selectOption("agreed");
  await page.getByLabel("Ghi chú").fill("Đã tư vấn và hẹn đến đăng ký.");
  const date = new Date(Date.now() + 86400000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Ngày giờ hẹn").fill(local);
  await page.getByLabel("Nơi hẹn").fill("Văn phòng Hà Nội");
  await page.getByRole("button", { name: "Lưu lần liên hệ" }).click();
  await expect(page.locator(".timeline")).toContainText(
    "Đã tư vấn và hẹn đến đăng ký.",
  );
  await page.reload();
  await expect(page.locator(".timeline")).toContainText(
    "Đã tư vấn và hẹn đến đăng ký.",
  );
  await expect(page.locator(".timeline")).toContainText("Văn phòng Hà Nội");
  expect(errors).toEqual([]);
});

test("cảnh báo SĐT trùng và không tạo thêm hồ sơ", async ({ page }) => {
  await page.goto("/#/leads/create");
  await page.getByLabel("Họ và tên").fill("Tài Xế Trùng");
  await page.getByLabel("Số điện thoại").fill("+84901000000");
  await page.getByLabel("Thành phố đăng ký").fill("Hà Nội");
  await page.getByLabel("Nguồn Lead").selectOption("web");
  await expect(page.locator(".callout")).toContainText(
    "Số này đã có hồ sơ Nguyễn Văn Minh",
  );
  await expect(
    page.getByRole("link", { name: "Mở hồ sơ để bổ sung" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo hồ sơ", exact: true }),
  ).toBeDisabled();
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
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page
    .getByRole("menuitemradio", { name: /Nguyễn Hà Linh · Telesale/ })
    .click();
  await expect(
    page.getByRole("link", { name: "Tiếp nhận Lead", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#/leads/create");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền xem trang này" }),
  ).toBeVisible();
  await page.goto("/#/assignments/PC-0002/show");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền xem trang này" }),
  ).toBeVisible();
  await page.goto("/#/tasks/PC-0001");
  await expect(
    page.getByRole("heading", { name: "Ghi nhận liên hệ" }),
  ).toBeVisible();
  await page.goto("/#/settings");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền xem trang này" }),
  ).toBeVisible();
});

test("lọc báo cáo khớp số hồ sơ và xuất CSV", async ({ page }) => {
  await page.goto("/#/reports");
  await page.getByLabel("Nguồn", { exact: true }).selectOption("web");
  await expect(page.locator(".kpis .kpi").first().locator("strong")).toHaveText(
    "5",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV" }).click();
  expect((await download).suggestedFilename()).toBe("bao-cao-lead.csv");
});

test("điện thoại mở menu và màn hình chính không tràn ngang", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Mở menu" }).click();
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

for (const format of ["csv", "xlsx"] as const) {
  test(`nhập ${format}: lưu dòng hợp lệ, báo trùng và lỗi riêng từng dòng`, async ({
    page,
  }) => {
    const rows = [
      ["name", "phone", "city", "vehicle", "sourceId", "note"],
      [
        `Tài xế nhập ${format}`,
        "0901888111",
        "Hà Nội",
        "Motorbike",
        "web",
        "Dữ liệu thử",
      ],
      ["Hồ sơ trùng", "+84901000000", "Hà Nội", "Motorbike", "web", ""],
      ["Hồ sơ lỗi", "123", "Hà Nội", "Motorbike", "web", ""],
    ];
    let buffer: Buffer;
    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet("Lead").addRows(rows);
      buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    } else buffer = Buffer.from(rows.map((row) => row.join(",")).join("\n"));
    await page.goto("/#/import");
    await page.locator(".dropzone input[type=file]").setInputFiles({
      name: `lead.${format}`,
      mimeType:
        format === "csv"
          ? "text/csv"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
    await expect(page.locator(".data-table")).toContainText("Hợp lệ");
    await expect(page.locator(".data-table")).toContainText("Trùng");
    await page
      .getByRole("button", { name: "Nhập 3 dòng", exact: true })
      .click();
    await expect(page.locator(".import-results")).toContainText(
      `Đã lưu Tài xế nhập ${format}`,
    );
    await expect(page.locator(".import-results")).toContainText("Dòng 3: Lỗi");
    await expect(page.locator(".import-results")).toContainText("Dòng 4: Lỗi");
  });
}
