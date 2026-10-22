import { test, expect } from "@playwright/test";

test("tài xế tự đăng ký, hồ sơ xuất hiện trong CRM và không trùng khi đăng ký lại", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/dang-ky-tai-xe");
  await expect(
    page.getByRole("heading", { name: "Trở thành đối tác tài xế" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByLabel("Họ và tên").fill("Tài Xế Form Công Khai");
  await page.getByLabel("Số điện thoại", { exact: false }).fill("123");
  await page.getByLabel("Thành phố đăng ký").fill("Hà Nội");
  await page.getByLabel("Tôi đồng ý").check();
  await page.getByRole("button", { name: "Gửi đăng ký" }).click();
  await expect(page.getByRole("alert")).toContainText("10 chữ số");
  await page
    .getByLabel("Số điện thoại", { exact: false })
    .fill("+84 912 345 678");
  await page.getByLabel("Quận / huyện").fill("Cầu Giấy");
  await page.getByLabel("Khung giờ tiện nghe máy").selectOption("afternoon");
  await page.getByLabel("CCCD", { exact: true }).check();
  await page.getByRole("radio", { name: "Xe Van" }).check();
  await page
    .getByLabel("Bạn cần tư vấn thêm")
    .fill("Muốn tìm hiểu đăng ký xe Van.");
  await page.getByRole("button", { name: "Gửi đăng ký" }).click();
  await expect(
    page.getByRole("heading", { name: "Đã lưu đăng ký xem thử" }),
  ).toBeVisible();
  const first = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("lead-sale.demo.v1")!);
    return db.leads.find(
      (lead: { phone: string }) => lead.phone === "0912345678",
    );
  });
  expect(first).toMatchObject({
    sourceId: "web",
    status: "New",
    vehicle: "Van",
    profile: {
      district: "Cầu Giấy",
      callTime: "afternoon",
      documents: { cccd: true },
    },
  });
  await page.reload();
  await page.getByLabel("Họ và tên").fill("Tên đăng ký lần hai");
  await page.getByLabel("Số điện thoại", { exact: false }).fill("0912345678");
  await page.getByLabel("Thành phố đăng ký").fill("TP. Hồ Chí Minh");
  await page.getByLabel("Tôi đồng ý").check();
  await page.getByRole("button", { name: "Gửi đăng ký" }).click();
  await expect(
    page.getByRole("heading", { name: "Đã lưu đăng ký xem thử" }),
  ).toBeVisible();
  const db = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lead-sale.demo.v1")!),
  );
  expect(
    db.leads.filter((lead: { phone: string }) => lead.phone === "0912345678"),
  ).toEqual([first]);
  expect(
    db.receptions.filter(
      (reception: { leadId: string }) => reception.leadId === first.id,
    ),
  ).toHaveLength(2);
  await page.goto(`/#/leads/${first.id}/show`);
  await page.getByRole("button", { name: "Lần tiếp nhận" }).click();
  await expect(page.getByRole("table")).toContainText("Tên đăng ký lần hai");
  await expect(page.getByRole("table")).toContainText("Tài xế tự đăng ký");
  expect(errors).toEqual([]);
});

test("form có thể điền trên điện thoại và có link chia sẻ trong CRM", async ({
  page,
}) => {
  await page.goto("/#/leads");
  await expect(page.getByLabel("Đường link form tài xế")).toHaveValue(
    /#\/dang-ky-tai-xe$/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/dang-ky-tai-xe");
  await expect(page.getByLabel("Họ và tên")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".playwright-mcp/public-intake-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: ".playwright-mcp/public-intake-desktop.png",
    fullPage: true,
  });
});
