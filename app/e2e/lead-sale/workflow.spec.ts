import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

// Demo starts as Admin, who no longer handles Leads (NOTE SỬA AD-01).
async function as(page: Page, name: RegExp) {
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await page.getByRole("menuitemradio", { name }).click();
}
const INTAKE = /Lê Ngọc Anh · Tiếp nhận/;
const LEADER = /Trần Minh Trang · Trưởng nhóm/;
const SALE = /Nguyễn Hà Linh · Telesale/;
const DENIED = "Bạn không có quyền xem trang này";

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

test("tiếp nhận → phân công → ghi nhận kèm ghi âm và lịch hẹn → tải lại vẫn còn", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await as(page, INTAKE);
  await page.getByRole("link", { name: "Tiếp nhận Lead", exact: true }).click();
  await page.getByLabel("Họ và tên").fill("Tài Xế E2E");
  await page.getByLabel("Số điện thoại").fill("+84912345678");
  await page.getByLabel("Thành phố đăng ký").fill("Hà Nội");
  await page.getByLabel("Nguồn Lead").selectOption("hotline");
  await page.getByRole("button", { name: "Tạo hồ sơ", exact: true }).click();
  await page
    .getByRole("link", { name: /Tài Xế E2E/ })
    .first()
    .click();
  const leadUrl = page.url();
  await expect(page.getByText("Lịch sử tư vấn")).toHaveCount(0);
  await as(page, LEADER);
  await page.goto(leadUrl);
  await page.getByRole("button", { name: "Phân công tư vấn" }).click();
  await page.getByLabel("Nhân viên Telesale").selectOption("sale-1");
  await page.getByRole("button", { name: "Tạo phiếu", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: /^PC-/ }).first().click();
  const ticketUrl = page.url();
  await as(page, SALE);
  await page.goto(ticketUrl);
  await page.getByRole("button", { name: "Nhận việc" }).click();
  await page.getByLabel("Quyết định của tài xế").selectOption("agreed");
  await page.getByLabel("Ghi chú").fill("Đã tư vấn và hẹn đến đăng ký.");
  const date = new Date(Date.now() + 86400000);
  const local = new Date(date.getTime() + 7 * 3600000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Thời gian hẹn", { exact: false }).fill(local);
  await page
    .getByLabel("Địa điểm hẹn", { exact: false })
    .selectOption("văn phòng HN1");
  await page.getByLabel("Trạng thái phiếu sau liên hệ").selectOption("Open");
  const save = page.getByRole("button", { name: "Lưu lần liên hệ" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Bằng chứng liên hệ").setInputFiles({
    name: "ghi-am.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.locator(".timeline")).toContainText(
    "Đã tư vấn và hẹn đến đăng ký.",
  );
  await page.reload();
  await expect(page.locator(".timeline")).toContainText(
    "Đã tư vấn và hẹn đến đăng ký.",
  );
  await expect(page.getByText("Danh sách lịch hẹn")).toBeVisible();
  await expect(page.locator(".data-table")).toContainText("văn phòng HN1");
  await page.getByRole("button", { name: "ghi-am.wav" }).click();
  await expect(page.locator("audio")).toBeVisible();
  await expect(page.getByText("Cuộc gọi Internet")).toHaveCount(0);
  await expect(page.getByText("Hủy kết quả nhập nhầm")).toHaveCount(0);
  await page.goto("/#/appointments");
  await expect(page.locator(".data-table")).toContainText("văn phòng HN1");
  await expect(
    page.getByRole("columnheader", { name: "Chuyên viên", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("cảnh báo SĐT trùng và không tạo thêm hồ sơ", async ({ page }) => {
  await page.goto("/");
  await as(page, INTAKE);
  await page.goto("/#/leads/create");
  await page.getByLabel("Họ và tên").fill("Tài Xế Trùng");
  await page.getByLabel("Số điện thoại").fill("+84901000000");
  await page.getByLabel("Thành phố đăng ký").fill("Hà Nội");
  await page.getByLabel("Nguồn Lead").selectOption("hotline");
  await expect(page.locator(".callout")).toContainText(
    "Số này đã có hồ sơ Nguyễn Văn Minh",
  );
  await expect(
    page.getByRole("button", { name: "Tạo hồ sơ", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("lead-sale.demo.v1")!).leads.length,
    ),
  ).toBe(20);
});

test("Telesale chỉ xử lý phiếu của mình, không có báo cáo", async ({
  page,
}) => {
  await page.goto("/");
  await as(page, SALE);
  await expect(
    page.getByRole("link", { name: "Báo cáo", exact: true }),
  ).toHaveCount(0);
  for (const url of [
    "/#/leads/create",
    "/#/tasks/PC-0002",
    "/#/reports",
    "/#/admin/users",
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: DENIED })).toBeVisible();
  }
  await page.goto("/#/tasks/PC-0001");
  await expect(
    page.getByRole("heading", { name: "Ghi nhận liên hệ" }),
  ).toBeVisible();
});

test("Admin chỉ quản trị tài khoản", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Người dùng" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Hồ sơ Lead", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#/leads");
  await expect(page.getByRole("heading", { name: DENIED })).toBeVisible();
  await page.goto("/#/admin/roles");
  await expect(
    page.getByRole("heading", { name: "Vai trò & phân quyền" }),
  ).toBeVisible();
});

test("báo cáo nguồn khớp số hồ sơ và xuất Excel", async ({ page }) => {
  await page.goto("/");
  await as(page, INTAKE);
  await page.goto("/#/reports");
  await page.getByLabel("Kỳ xem", { exact: true }).selectOption("all");
  await page.getByLabel("Nguồn Lead", { exact: true }).selectOption("web");
  await expect(page.locator(".report-data-table tbody tr")).toHaveCount(2);
  await expect(
    page.locator(".report-data-table .total-row td").nth(2),
  ).toHaveText("5");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  const values = JSON.stringify(workbook.worksheets[0].getSheetValues());
  expect(values).toContain("Form website");
  expect(values).not.toContain("Facebook");
});

test("điện thoại mở menu và màn hình chính không tràn ngang", async ({
  page,
}) => {
  await page.goto("/");
  await as(page, INTAKE);
  await page.setViewportSize({ width: 390, height: 844 });
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
    await page.goto("/");
    await as(page, INTAKE);
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
